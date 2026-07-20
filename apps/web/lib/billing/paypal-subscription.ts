import "server-only";

import { accrueAffiliateAndNotify } from "@/lib/affiliate/notify";
import { isPayPalRecurringEnabled } from "@/lib/billing/recurring";
import { convertCurrency, convertZarToUsd } from "@/lib/fx";
import { getPlatformPayPal } from "@/lib/payments/platform-paypal";
import { grantSubscriptionCredits } from "@/lib/credits/wallet";
import {
  cancelPayPalSubscription,
  createPayPalBillingPlan,
  createPayPalCatalogProduct,
  createPayPalSubscription,
  getPayPalSubscription,
  type PayPalCreds,
} from "@/lib/paypal";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PayPal native recurring subscriptions (Wielo platform rail).
 *
 * PayPal has no merchant-initiated recurring charge, so — unlike the Paystack
 * rail — we use PayPal's own Subscriptions API: a Billing Plan (created once per
 * product+cycle+price, cached in product_billing_plans) and a Subscription the
 * payer approves. PayPal then auto-charges each cycle and fires webhooks
 * (/api/paypal-webhook) that this module settles.
 *
 * Correctness rules baked in:
 *  - R2: the PayPal plan is a FIXED USD amount; the ZAR ledger is recorded from
 *    the amount actually charged (USD→ZAR at charge-time fx), never a stale price.
 *  - R3: one subscriptions row per membership; provider handle rewritten in place.
 *  - R4: activation + first payment arrive in any order — both are idempotent and
 *    keyed by paypal_subscription_id / the PayPal sale id.
 */

type Admin = ReturnType<typeof createAdminClient>;

// custom_id rides on every PayPal webhook + the subscription record, correlating
// the PayPal subscription back to the host + product + cycle it belongs to.
export function encodeCustomId(
  hostId: string,
  productId: string,
  cycle: "monthly" | "annual",
): string {
  return `${hostId}|${productId}|${cycle}`;
}

export function decodeCustomId(
  raw: string | null | undefined,
): { hostId: string; productId: string; cycle: "monthly" | "annual" } | null {
  if (!raw) return null;
  const [hostId, productId, cycle] = raw.split("|");
  if (!hostId || !productId) return null;
  return {
    hostId,
    productId,
    cycle: cycle === "annual" ? "annual" : "monthly",
  };
}

function addMonths(d: Date, n: number): string {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x.toISOString();
}

// Resolve the plans.key a product grants (FK-valid), else preserve/free — mirrors
// activateMappedPlan so all activation paths agree on the tier.
async function resolvePlanKey(
  admin: Admin,
  product: { plan_key: string | null; slug: string | null },
  fallback: string,
): Promise<string> {
  const desired = product.plan_key ?? product.slug;
  if (desired) {
    const { data: planRow } = await admin
      .from("plans")
      .select("key")
      .eq("key", desired)
      .maybeSingle();
    if (planRow) return planRow.key;
  }
  return fallback;
}

/**
 * Create-or-reuse the PayPal Billing Plan for (product, cycle) at the current ZAR
 * price. Keyed by ZAR amount so a price change mints a NEW plan version and
 * supersedes the old (existing subscribers keep their grandfathered plan). The
 * PayPal plan amount is the fx-converted USD, frozen at create time. Returns the
 * PayPal plan id or null.
 */
export async function ensurePayPalPlan(
  admin: Admin,
  input: {
    product: {
      id: string;
      name: string;
      price: number | string;
      annual_price: number | string | null;
      currency: string;
    };
    cycle: "monthly" | "annual";
    creds: PayPalCreds;
  },
): Promise<string | null> {
  const environment = input.creds.env;
  const zarAmount =
    input.cycle === "annual"
      ? Number(input.product.annual_price ?? input.product.price)
      : Number(input.product.price);
  if (!(zarAmount > 0)) return null;

  // Reuse an active plan at this exact ZAR amount.
  const { data: existing } = await admin
    .from("product_billing_plans")
    .select("provider_plan_id")
    .eq("product_id", input.product.id)
    .eq("provider", "paypal")
    .eq("cycle", input.cycle)
    .eq("amount", zarAmount)
    .eq("environment", environment)
    .eq("status", "active")
    .maybeSingle();
  if (existing?.provider_plan_id) return existing.provider_plan_id;

  // Mint a new PayPal Catalog Product + Billing Plan (USD price, fx at create).
  const usd = await convertZarToUsd(zarAmount);
  if (!(usd > 0)) return null;
  const catalogId = await createPayPalCatalogProduct({
    name: input.product.name,
    description: `Wielo · ${input.product.name}`,
    creds: input.creds,
  });
  if (!catalogId) return null;
  const planId = await createPayPalBillingPlan({
    productId: catalogId,
    name: `${input.product.name} (${input.cycle})`,
    cycle: input.cycle,
    amount: usd,
    currency: "USD",
    creds: input.creds,
  });
  if (!planId) return null;

  // Supersede any prior active plan version for this (product, cycle, env), then
  // record the new one. If the insert races (unique active index), fall back to
  // whatever won.
  await admin
    .from("product_billing_plans")
    .update({ status: "superseded" })
    .eq("product_id", input.product.id)
    .eq("provider", "paypal")
    .eq("cycle", input.cycle)
    .eq("environment", environment)
    .eq("status", "active");
  const { error: insErr } = await admin.from("product_billing_plans").insert({
    product_id: input.product.id,
    provider: "paypal",
    cycle: input.cycle,
    amount: zarAmount,
    currency: input.product.currency ?? "ZAR",
    provider_amount: usd,
    provider_currency: "USD",
    environment,
    provider_product_id: catalogId,
    provider_plan_id: planId,
    status: "active",
  });
  if (insErr) {
    const { data: won } = await admin
      .from("product_billing_plans")
      .select("provider_plan_id")
      .eq("product_id", input.product.id)
      .eq("provider", "paypal")
      .eq("cycle", input.cycle)
      .eq("amount", zarAmount)
      .eq("environment", environment)
      .eq("status", "active")
      .maybeSingle();
    return won?.provider_plan_id ?? planId;
  }
  return planId;
}

export type StartPayPalSubResult =
  | { ok: true; approveUrl: string; subscriptionId: string }
  | { ok: false; error: string };

/**
 * Start a PayPal subscription checkout for a host buying a plan. Ensures the
 * billing plan exists, creates the subscription (custom_id correlates host +
 * product + cycle), and returns the approval URL. Activation happens when the
 * payer returns (confirmPayPalSubscriptionReturn) or on the ACTIVATED webhook.
 */
export async function startPayPalSubscriptionCheckout(input: {
  hostId: string;
  productId: string;
  cycle: "monthly" | "annual";
  returnUrl: string;
  cancelUrl: string;
}): Promise<StartPayPalSubResult> {
  const admin = createAdminClient();
  const creds = await getPlatformPayPal();
  if (!creds) return { ok: false, error: "PayPal isn't configured." };

  const { data: product } = await admin
    .from("products")
    .select("id, name, price, annual_price, currency, product_type, is_active")
    .eq("id", input.productId)
    .maybeSingle();
  if (!product || !product.is_active || product.product_type === "product") {
    return { ok: false, error: "That plan isn't available." };
  }

  const planId = await ensurePayPalPlan(admin, {
    product,
    cycle: input.cycle,
    creds,
  });
  if (!planId) {
    return { ok: false, error: "Couldn't prepare the PayPal plan." };
  }

  const { data: host } = await admin
    .from("hosts")
    .select("user_id")
    .eq("id", input.hostId)
    .maybeSingle();
  let email: string | undefined;
  if (host?.user_id) {
    const { data: profile } = await admin
      .from("user_profiles")
      .select("email")
      .eq("id", host.user_id)
      .maybeSingle();
    email = profile?.email ?? undefined;
  }

  const sub = await createPayPalSubscription({
    planId,
    returnUrl: input.returnUrl,
    cancelUrl: input.cancelUrl,
    customId: encodeCustomId(input.hostId, product.id, input.cycle),
    subscriberEmail: email,
    brandName: "Wielo",
    creds,
  });
  if (!sub) return { ok: false, error: "Couldn't start PayPal checkout." };
  return {
    ok: true,
    approveUrl: sub.approveUrl,
    subscriptionId: sub.subscriptionId,
  };
}

/**
 * Activate (or refresh) the host's subscription row for a PayPal subscription —
 * idempotent, called from the return page AND the ACTIVATED webhook (R4, either
 * order). Reads the live PayPal subscription to confirm it is ACTIVE and to
 * resolve the host/product from custom_id, then upserts the ONE membership row
 * with the PayPal handles (R3). Does NOT record money — that's the SALE.COMPLETED
 * path. Returns true when the subscription is active + linked.
 */
export async function activatePayPalSubscription(
  admin: Admin,
  subscriptionId: string,
): Promise<boolean> {
  const creds = await getPlatformPayPal();
  if (!creds) return false;
  const remote = await getPayPalSubscription(subscriptionId, creds);
  if (!remote) return false;
  if (remote.status !== "ACTIVE") return false;

  const ids = decodeCustomId(remote.customId);
  if (!ids) return false;

  const { data: product } = await admin
    .from("products")
    .select("id, plan_key, slug, product_type, billing_cycle")
    .eq("id", ids.productId)
    .maybeSingle();
  if (!product || product.product_type === "product") return false;
  const isMembership = product.product_type === "membership";

  // Existing row for this (host, product)?
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id, plan")
    .eq("host_id", ids.hostId)
    .eq("product_id", ids.productId)
    .maybeSingle();

  const plan = await resolvePlanKey(admin, product, existing?.plan ?? "free");
  const now = new Date();
  const periodEnd =
    remote.nextBillingTime ?? addMonths(now, ids.cycle === "annual" ? 12 : 1);

  const patch = {
    product_id: ids.productId,
    plan,
    billing_cycle: ids.cycle,
    status: "active" as const,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd,
    paypal_subscription_id: subscriptionId,
    paypal_plan_id: remote.planId,
    failed_payment_count: 0,
    grace_period_ends_at: null,
    cancel_at_period_end: false,
    cancelled_at: null,
    cancellation_reason: null,
  };

  // One active membership per host: retire any OTHER active membership before
  // activating/switching to this one (mirrors activateMappedPlan).
  if (isMembership) {
    await retireOtherMemberships(admin, ids.hostId, ids.productId);
  }

  if (existing) {
    await admin.from("subscriptions").update(patch).eq("id", existing.id);
  } else {
    await admin.from("subscriptions").insert({ host_id: ids.hostId, ...patch });
  }
  return true;
}

// Retire active memberships OTHER than keepProductId (the product-less signup
// baseline counts) so the one-active-membership trigger accepts the write.
async function retireOtherMemberships(
  admin: Admin,
  hostId: string,
  keepProductId: string,
): Promise<void> {
  const { data: active } = await admin
    .from("subscriptions")
    .select("id, product_id")
    .eq("host_id", hostId)
    .in("status", ["trialing", "active", "past_due"]);
  const others = (active ?? []).filter((s) => s.product_id !== keepProductId);
  const pids = others.map((s) => s.product_id).filter((x): x is string => !!x);
  const memIds = new Set<string>();
  if (pids.length) {
    const { data: mems } = await admin
      .from("products")
      .select("id")
      .in("id", pids)
      .eq("product_type", "membership");
    for (const m of mems ?? []) memIds.add(m.id);
  }
  const retire = others
    .filter((s) => !s.product_id || memIds.has(s.product_id))
    .map((s) => s.id);
  if (retire.length) {
    await admin
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .in("id", retire);
  }
}

/**
 * Record a PayPal renewal payment (PAYMENT.SALE.COMPLETED) and extend the period.
 * Idempotent on the PayPal SALE id (platform_ledger.provider_reference =
 * `pp_sale_{saleId}`, UNIQUE) — only the writer that inserts it extends the sub,
 * so a redelivered webhook can't double-charge or double-extend (R3/R4). The ZAR
 * amount is derived from the USD actually charged, at charge-time fx (R2).
 */
export async function recordPayPalSaleCompleted(
  admin: Admin,
  input: {
    saleId: string;
    subscriptionId: string;
    amountUsd: number;
    environment: "live" | "test";
  },
): Promise<void> {
  const reference = `pp_sale_${input.saleId}`;

  // Resolve the Wielo subscription by the PayPal subscription id.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, host_id, product_id, plan, billing_cycle")
    .eq("paypal_subscription_id", input.subscriptionId)
    .maybeSingle();
  // If we can't map it yet (activation webhook not processed), still record the
  // money against no sub rather than lose it; the reconcile cron links it later.

  let userId: string | null = null;
  if (sub?.host_id) {
    const { data: host } = await admin
      .from("hosts")
      .select("user_id")
      .eq("id", sub.host_id)
      .maybeSingle();
    userId = host?.user_id ?? null;
  }

  const cycle = sub?.billing_cycle === "annual" ? "annual" : "monthly";
  const now = new Date();
  const periodStart = now.toISOString();
  const periodEnd = addMonths(now, cycle === "annual" ? 12 : 1);

  // R2: ZAR of record = the USD charged, converted at today's fx.
  const amountZar = await convertCurrency(input.amountUsd, "USD", "ZAR");

  // Insert-wins claim (UNIQUE provider_reference). Conflict → already recorded.
  const { data: inserted, error } = await admin
    .from("platform_ledger")
    .insert({
      user_id: userId,
      host_id: sub?.host_id ?? null,
      subscription_id: sub?.id ?? null,
      plan: sub?.plan ?? null,
      billing_cycle: cycle,
      type: "charge",
      status: "completed",
      amount: amountZar,
      currency: "ZAR",
      provider: "paypal",
      provider_reference: reference,
      environment: input.environment,
      paid_at: now.toISOString(),
      period_start: periodStart,
      period_end: periodEnd,
      reason: "Subscription renewal (PayPal)",
    })
    .select("id");
  if (error || !inserted || inserted.length === 0) return; // already settled

  if (sub) {
    await admin
      .from("subscriptions")
      .update({
        status: "active",
        current_period_start: periodStart,
        current_period_end: periodEnd,
        failed_payment_count: 0,
        grace_period_ends_at: null,
      })
      .eq("id", sub.id);

    await admin.from("subscription_history").insert({
      subscription_id: sub.id,
      host_id: sub.host_id,
      event: "subscription_charged",
      to_plan: sub.plan,
      to_status: "active",
      amount_charged: amountZar,
      currency: "ZAR",
      notes: "PayPal subscription payment",
    });

    if (sub.product_id) {
      try {
        await grantSubscriptionCredits(admin, {
          hostId: sub.host_id,
          productId: sub.product_id,
          periodStart,
        });
      } catch {
        // Credits must never break a settled renewal.
      }
    }
  }

  await accrueAffiliateAndNotify(admin, inserted[0].id);
}

/**
 * Terminal state from PayPal (CANCELLED / SUSPENDED / EXPIRED). Guarded: only act
 * on the subscription row that still carries THIS PayPal id, so a stale event for
 * a subscription already swapped to a new plan can't cancel the live one.
 */
export async function markPayPalSubscriptionEnded(
  admin: Admin,
  input: {
    subscriptionId: string;
    status: "cancelled" | "paused";
    reason?: string;
  },
): Promise<void> {
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, status")
    .eq("paypal_subscription_id", input.subscriptionId)
    .maybeSingle();
  if (!sub) return;
  if (["cancelled", "expired"].includes(sub.status)) return;
  await admin
    .from("subscriptions")
    .update({
      status: input.status,
      ...(input.status === "cancelled"
        ? {
            cancelled_at: new Date().toISOString(),
            cancellation_reason: input.reason ?? "PayPal subscription ended",
          }
        : {}),
    })
    .eq("id", sub.id);
}

/**
 * A PayPal recurring charge failed (BILLING.SUBSCRIPTION.PAYMENT.FAILED). Enter
 * dunning: past_due + 5-day grace + notify. Mirrors the Paystack decline path.
 */
export async function markPayPalPaymentFailed(
  admin: Admin,
  subscriptionId: string,
): Promise<void> {
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, host_id, status, failed_payment_count")
    .eq("paypal_subscription_id", subscriptionId)
    .maybeSingle();
  if (!sub) return;

  const fails = Number(sub.failed_payment_count ?? 0) + 1;
  const update: Record<string, unknown> = { failed_payment_count: fails };
  if (sub.status === "active" || sub.status === "trialing") {
    update.status = "past_due";
    update.grace_period_ends_at = new Date(
      Date.now() + 5 * 86_400_000,
    ).toISOString();
  }
  await admin.from("subscriptions").update(update).eq("id", sub.id);

  if (sub.status === "active" || sub.status === "trialing") {
    await admin.from("subscription_history").insert({
      subscription_id: sub.id,
      host_id: sub.host_id,
      event: "subscription_payment_failed",
      to_status: "past_due",
      notes: `PayPal charge failed (attempt ${fails}) — grace started`,
    });
  }
  try {
    await admin.rpc("notify_subscription_event", {
      p_host_id: sub.host_id,
      p_subscription_id: sub.id,
      p_kind: "subscription_failed",
      p_extra: {},
      p_dedupe_key: `subscription_failed:${sub.id}:${fails}`,
    });
  } catch {
    // Never break the money path over a notification.
  }
}

export type PayPalReconcileSummary = {
  enabled: boolean;
  checked: number;
  extended: number;
  ended: number;
  errors: number;
};

/**
 * Reconcile PayPal subscriptions against provider state (Phase 4 — time-driven).
 *
 * PayPal drives recurring charges + fires webhooks (/api/paypal-webhook), but a
 * webhook can be missed (delivery failure past PayPal's retry horizon, an outage).
 * This cross-checks every live sub whose period is at/past due against PayPal's own
 * record and repairs the drift:
 *  - ACTIVE with a later next_billing_time than our period_end → a renewal we never
 *    recorded; extend the period so the host isn't wrongly restricted. It does NOT
 *    fabricate a ledger row — money is booked ONLY from the real PAYMENT.SALE.
 *    COMPLETED event (idempotent on the sale id, R2/R4), which PayPal redelivers;
 *    inventing a charge here would double-count or guess the fx.
 *  - CANCELLED / EXPIRED → mark the local row ended (guarded to the matching id).
 *  - SUSPENDED → left for the PAYMENT.FAILED dunning path.
 *
 * Gated by paypal_recurring_enabled → a no-op while the rail is OFF.
 */
export async function reconcilePayPalSubscriptions(
  admin: Admin = createAdminClient(),
): Promise<PayPalReconcileSummary> {
  const summary: PayPalReconcileSummary = {
    enabled: false,
    checked: 0,
    extended: 0,
    ended: 0,
    errors: 0,
  };

  if (!(await isPayPalRecurringEnabled())) return summary;
  summary.enabled = true;

  const creds = await getPlatformPayPal();
  if (!creds) return summary;

  const dueBefore = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: subs } = await admin
    .from("subscriptions")
    .select("id, status, current_period_end, paypal_subscription_id")
    .in("status", ["active", "past_due"])
    .not("paypal_subscription_id", "is", null)
    .lte("current_period_end", dueBefore)
    .limit(100);

  for (const sub of subs ?? []) {
    const subscriptionId = sub.paypal_subscription_id as string;
    summary.checked += 1;
    try {
      const remote = await getPayPalSubscription(subscriptionId, creds);
      if (!remote) {
        summary.errors += 1;
        continue;
      }
      if (remote.status === "ACTIVE") {
        // A renewal happened at PayPal that our webhook missed → repair ACCESS by
        // extending to the provider's next-billing date (money settles separately).
        if (
          remote.nextBillingTime &&
          sub.current_period_end &&
          new Date(remote.nextBillingTime).getTime() >
            new Date(sub.current_period_end).getTime()
        ) {
          await admin
            .from("subscriptions")
            .update({
              status: "active",
              current_period_end: remote.nextBillingTime,
              failed_payment_count: 0,
              grace_period_ends_at: null,
            })
            .eq("id", sub.id);
          summary.extended += 1;
        }
      } else if (["CANCELLED", "EXPIRED"].includes(remote.status)) {
        await markPayPalSubscriptionEnded(admin, {
          subscriptionId,
          status: "cancelled",
          reason: `PayPal ${remote.status} (reconcile)`,
        });
        summary.ended += 1;
      }
      // SUSPENDED → leave to the PAYMENT.FAILED dunning path.
    } catch (err) {
      summary.errors += 1;
      console.error(
        `subscription-reconcile: paypal sub ${subscriptionId} errored:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return summary;
}

/**
 * Cancel a host's live PayPal subscription at PayPal (used by rebuild-on-upgrade
 * and host cancellation). Best-effort; the webhook flips the local row.
 */
export async function cancelHostPayPalSubscription(
  subscriptionId: string,
  reason: string,
): Promise<boolean> {
  const creds = await getPlatformPayPal();
  if (!creds) return false;
  return cancelPayPalSubscription(subscriptionId, reason, creds);
}
