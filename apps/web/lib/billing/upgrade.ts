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
import { grantSubscriptionCredits } from "@/lib/credits/wallet";
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
  } | null = null;
  if (input.subId) {
    const { data } = await admin
      .from("subscriptions")
      .select(
        "product_id, billing_cycle, current_period_start, current_period_end",
      )
      .eq("id", input.subId)
      .maybeSingle();
    sub = data ?? null;
  }

  const cycle = resolveCycle(sub?.billing_cycle, newProduct.billing_cycle);
  const currency = newProduct.currency ?? "ZAR";
  const fullPrice = priceForCycle(newProduct, cycle);

  // Old price at the SAME cycle so the delta is a like-for-like difference.
  let oldPrice = 0;
  if (sub?.product_id) {
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
 * Ordering is deliberate: the delta order + checkout are created FIRST, and the
 * plan is only rewritten once the checkout is confirmed started — so a failed
 * order/init never leaves a host upgraded without a pending charge. (Once handed
 * off, this is grant-then-collect per R5's activate_on_pay:false top-up model; an
 * abandoned delta self-corrects at renewal via the dunning path.)
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
      "id, product_id, billing_cycle, current_period_start, current_period_end",
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

  let oldPrice = 0;
  if (sub.product_id) {
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

  // Rewrite the ONE membership row in place to the new tier, PRESERVING the
  // period (R3): the host keeps their remaining paid days, now at the higher
  // tier; the saved Paystack card authorization is untouched and the renewal cron
  // re-charges the NEW price at period_end.
  const rewrite = async (): Promise<void> => {
    await admin
      .from("subscriptions")
      .update({
        product_id: newProduct.id,
        plan: input.planKey,
        billing_cycle: cycle,
        status: "active",
        cancel_at_period_end: false,
        cancelled_at: null,
        cancellation_reason: null,
      })
      .eq("id", sub.id);

    // The higher tier's recurring credit allotment applies to the current period
    // straight away (idempotent per product+period).
    if (sub.current_period_start) {
      try {
        await grantSubscriptionCredits(admin, {
          hostId: input.hostId,
          productId: newProduct.id,
          periodStart: sub.current_period_start,
        });
      } catch {
        // Credits must never block an upgrade.
      }
    }

    await admin.from("subscription_history").insert({
      subscription_id: sub.id,
      host_id: input.hostId,
      event: "plan_change",
      to_plan: input.planKey,
      to_status: "active",
      notes: `Upgraded (prorated delta ${currency} ${delta.toFixed(2)})`,
    });
  };

  // A delta that rounds to zero (equal prices at this cycle) → just switch the
  // tier, no charge to collect.
  if (!(delta > 0)) {
    await rewrite();
    return { ok: true };
  }

  // Collect the delta as a one-time top-up (activate_on_pay:false → the plan is
  // switched here, the link ONLY collects the difference). Jump straight to the
  // Paystack card form.
  const order = await createProductOrder(
    {
      productId: newProduct.id,
      email: input.email,
      createdBy: input.userId,
      amountOverride: delta,
      activateOnPay: false,
      label: `Upgrade to ${newProduct.name} (prorated)`,
    },
    input.origin,
  );
  if (!order.ok) return order;

  const pay = await startProductPaystack(order.token, input.origin, false);

  // Checkout is confirmed started → now commit the plan switch, then send the
  // host to pay the delta.
  await rewrite();

  if (pay.ok) return { ok: true, redirectUrl: pay.authorizationUrl };
  // Init failed after the switch — hand back the pay page (host can retry / EFT).
  return { ok: true, redirectUrl: order.url };
}
