import "server-only";

import { isPlatformBillingConfigured } from "@/lib/billing/platform-billing";
import {
  createProductOrder,
  startProductPaystack,
} from "@/lib/billing/product-checkout";
import {
  daysRemaining,
  membershipSwitchAmount,
  unusedFraction,
} from "@/lib/billing/proration";
import { getRecurringConfig } from "@/lib/billing/recurring";
import { applyPaidUpgrade } from "@/lib/billing/upgrade-apply";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Self-serve mid-cycle UPGRADE proration (Phase 3).
 *
 * When a host on a paid membership upgrades to a higher tier part-way through a
 * billing period, they should NOT pay the full new price — they still hold unused
 * paid time on the old plan. The correct charge is only the prorated DELTA that
 * tops the remaining period up to the new tier (membershipSwitchAmount).
 *
 * The Paystack rail prorates cleanly (founder decision — PayPal proration is a
 * follow-up): the saved reusable card authorization needs no payer approval, so
 * we can rewrite the ONE membership row in place (R3), PRESERVE the current period
 * (the host keeps their remaining time at the higher tier), and collect the delta
 * as a one-time top-up. The renewal cron then re-charges the NEW price at
 * period_end. Both the preview and the action recompute the delta server-side —
 * the client is never trusted with money.
 *
 * Everything here is gated behind paystack_recurring_enabled: while OFF (beta),
 * getUpgradeQuote reports `prorated:false` and the caller falls back to today's
 * full-price checkout, so no proration path can run before go-live.
 */

function resolveCycle(
  ...vals: Array<string | null | undefined>
): "monthly" | "annual" {
  for (const v of vals) {
    if (v === "annual") return "annual";
    if (v === "monthly") return "monthly";
  }
  return "monthly";
}

function priceForCycle(
  product: { price: number | string; annual_price: number | string | null },
  cycle: "monthly" | "annual",
): number {
  return cycle === "annual"
    ? Number(product.annual_price ?? product.price)
    : Number(product.price);
}

export type UpgradeQuote =
  | {
      ok: true;
      currency: string;
      /** The full new-plan price (what today's non-prorated path charges). */
      fullPrice: number;
      /** What will actually be charged now — the delta when prorating, else full. */
      amountNow: number;
      /** True when the mid-cycle prorated delta applies (Paystack recurring on). */
      prorated: boolean;
      /** Whole days of paid time remaining on the current period (0 when none). */
      daysRemaining: number;
      cycle: "monthly" | "annual";
      /** Which payment rails to offer the host in the confirm step. */
      rails: { paystack: boolean; paypal: boolean };
    }
  | { ok: false; error: string };

/**
 * Price out an upgrade for the confirm dialog — server-authoritative. `subId` is
 * the host's current membership row (null for a first-time paid switch). Reports
 * the prorated delta only when the Paystack recurring rail is enabled AND there
 * is unused paid time to credit; otherwise the full new price (today's behaviour).
 */
export async function getUpgradeQuote(input: {
  subId: string | null;
  newProductId: string;
}): Promise<UpgradeQuote> {
  const admin = createAdminClient();
  const recurring = await getRecurringConfig();

  const { data: newProduct } = await admin
    .from("products")
    .select("id, price, annual_price, currency, billing_cycle, is_active")
    .eq("id", input.newProductId)
    .maybeSingle();
  if (!newProduct || !newProduct.is_active) {
    return { ok: false, error: "That plan isn't available." };
  }

  let sub: {
    product_id: string | null;
    billing_cycle: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    locked_base_amount: number | null;
  } | null = null;
  if (input.subId) {
    const { data } = await admin
      .from("subscriptions")
      .select(
        "product_id, billing_cycle, current_period_start, current_period_end, locked_base_amount",
      )
      .eq("id", input.subId)
      .maybeSingle();
    sub = data ?? null;
  }

  const cycle = resolveCycle(sub?.billing_cycle, newProduct.billing_cycle);
  const currency = newProduct.currency ?? "ZAR";
  const fullPrice = priceForCycle(newProduct, cycle);

  // Old price at the SAME cycle so the delta is a like-for-like difference. WS-5:
  // a Founding host's current price is their FROZEN locked base, not the live list
  // price — so the upgrade delta is computed against what they actually pay.
  let oldPrice = 0;
  if (sub?.locked_base_amount != null && Number(sub.locked_base_amount) > 0) {
    oldPrice = Number(sub.locked_base_amount);
  } else if (sub?.product_id) {
    const { data: oldProduct } = await admin
      .from("products")
      .select("price, annual_price")
      .eq("id", sub.product_id)
      .maybeSingle();
    if (oldProduct) oldPrice = priceForCycle(oldProduct, cycle);
  }

  const now = new Date();
  const frac = unusedFraction(
    sub?.current_period_start,
    sub?.current_period_end,
    now,
  );
  // Prorate only when: a recurring rail is armed, the host is on a paid plan with
  // unused period, and the delta is meaningful. Both rails prorate the same delta —
  // Paystack via a saved-card top-up, PayPal via a single-approval setup-fee sub.
  const prorated =
    (recurring.paystack || recurring.paypal) &&
    !!sub?.product_id &&
    frac > 0 &&
    fullPrice > oldPrice;
  const delta = membershipSwitchAmount(
    fullPrice,
    oldPrice,
    sub?.current_period_start,
    sub?.current_period_end,
    now,
  );

  return {
    ok: true,
    currency,
    fullPrice,
    amountNow: prorated ? delta : fullPrice,
    prorated,
    daysRemaining: daysRemaining(sub?.current_period_end, now),
    cycle,
    rails: { paystack: true, paypal: recurring.paypal },
  };
}

export type UpgradeRunResult =
  | { ok: true; redirectUrl?: string }
  | { ok: true; proceed: "full" }
  | { ok: false; error: string };

/**
 * Execute a prorated Paystack upgrade: rewrite the membership row in place to the
 * new tier (preserving the period), then collect the delta as a one-time top-up
 * and hand off to the Paystack card form. Returns `{ proceed: "full" }` when there
 * is nothing to prorate (no unused period) so the caller runs the normal
 * full-price checkout that opens a fresh cycle instead.
 *
 * Ordering is COLLECT-BEFORE-GRANT: the delta order carries the upgrade
 * (upgrade_subscription_id / upgrade_plan_key) and the tier is switched by
 * applyPaidUpgrade from the settle paths — Paystack return, PayPal capture, EFT
 * received — i.e. only once the delta is really paid. Handing off to the card
 * form grants nothing: abandon the checkout and the host stays on the tier they
 * have paid for. (This previously rewrote the plan at hand-off, which left a real
 * R513.79 delta pending on an already-upgraded host.)
 */
export async function runProratedPaystackUpgrade(input: {
  hostId: string;
  userId: string;
  email: string;
  subId: string;
  planKey: string;
  newProductId: string;
  origin: string | null;
}): Promise<UpgradeRunResult> {
  // Only run when the rail is armed AND billing is wired — otherwise defer to the
  // caller's state-only / full-price fallback (belt-and-braces with the caller).
  const recurring = await getRecurringConfig();
  if (!recurring.paystack || !(await isPlatformBillingConfigured())) {
    return { ok: true, proceed: "full" };
  }

  const admin = createAdminClient();

  const { data: sub } = await admin
    .from("subscriptions")
    .select(
      "id, product_id, billing_cycle, current_period_start, current_period_end, locked_base_amount",
    )
    .eq("id", input.subId)
    .maybeSingle();
  if (!sub) return { ok: false, error: "Subscription not found." };

  const { data: newProduct } = await admin
    .from("products")
    .select(
      "id, name, price, annual_price, currency, billing_cycle, product_type",
    )
    .eq("id", input.newProductId)
    .maybeSingle();
  if (!newProduct || newProduct.product_type === "product") {
    return { ok: false, error: "That plan isn't available." };
  }

  const cycle = resolveCycle(sub.billing_cycle, newProduct.billing_cycle);
  const newPrice = priceForCycle(newProduct, cycle);

  // WS-5: a Founding host's baseline is their frozen locked base, not list price.
  let oldPrice = 0;
  if (sub.locked_base_amount != null && Number(sub.locked_base_amount) > 0) {
    oldPrice = Number(sub.locked_base_amount);
  } else if (sub.product_id) {
    const { data: oldProduct } = await admin
      .from("products")
      .select("price, annual_price")
      .eq("id", sub.product_id)
      .maybeSingle();
    if (oldProduct) oldPrice = priceForCycle(oldProduct, cycle);
  }

  const now = new Date();
  const frac = unusedFraction(
    sub.current_period_start,
    sub.current_period_end,
    now,
  );
  // No unused period to credit → nothing to prorate; let the caller charge full
  // price and open a fresh cycle (membershipSwitchAmount would return full anyway).
  if (!(frac > 0)) return { ok: true, proceed: "full" };

  const delta = membershipSwitchAmount(
    newPrice,
    oldPrice,
    sub.current_period_start,
    sub.current_period_end,
    now,
  );
  const currency = newProduct.currency ?? "ZAR";

  // A delta that rounds to zero (equal prices at this cycle) → there is nothing
  // to collect, so switch the tier straight away. PRESERVE the period (R3): the
  // host keeps their remaining paid days, now at the higher tier; the saved
  // Paystack card authorization is untouched and the renewal cron re-charges the
  // NEW price at period_end.
  if (!(delta > 0)) {
    await admin
      .from("subscriptions")
      .update({ billing_cycle: cycle })
      .eq("id", sub.id);
    await applyPaidUpgrade(admin, {
      id: sub.id,
      product_id: newProduct.id,
      amount: 0,
      currency,
      upgrade_subscription_id: sub.id,
      upgrade_plan_key: input.planKey,
    });
    return { ok: true };
  }

  // Collect the delta as a one-time top-up (activate_on_pay:false → no fresh
  // billing cycle; the link ONLY collects the difference). The order CARRIES the
  // upgrade — applyPaidUpgrade switches the tier when the delta settles, never
  // before — so an abandoned checkout leaves the host on the tier they paid for.
  const order = await createProductOrder(
    {
      productId: newProduct.id,
      email: input.email,
      createdBy: input.userId,
      amountOverride: delta,
      activateOnPay: false,
      upgradeSubscriptionId: sub.id,
      upgradePlanKey: input.planKey,
      label: `Upgrade to ${newProduct.name} (prorated)`,
    },
    input.origin,
  );
  if (!order.ok) return order;

  const pay = await startProductPaystack(order.token, input.origin, false);
  if (pay.ok) return { ok: true, redirectUrl: pay.authorizationUrl };
  // Init failed — hand back the pay page (host can retry / pay by EFT). Still no
  // tier granted until that order settles.
  return { ok: true, redirectUrl: order.url };
}
