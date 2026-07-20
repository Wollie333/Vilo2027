import "server-only";

import { accrueAffiliateAndNotify } from "@/lib/affiliate/notify";
import {
  countHostListings,
  resolveMembershipAmount,
} from "@/lib/billing/membershipAmount";
import {
  membershipSwitchAmount,
  unusedFraction,
} from "@/lib/billing/proration";
import {
  isFoundingOffersOpen,
  isPayPalRecurringEnabled,
} from "@/lib/billing/recurring";
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
    // WS-5: the effective ZAR amount to bill (Founding lock + per-listing). When
    // omitted we fall back to the product's live list price. Plans are keyed by
    // amount, so a 599 Founding host gets a distinct plan from a 999 list host —
    // the existing ZAR-keyed versioning handles this transparently.
    amountOverride?: number | null;
  },
): Promise<string | null> {
  const environment = input.creds.env;
  const zarAmount =
    input.amountOverride != null && input.amountOverride > 0
      ? Number(input.amountOverride)
      : input.cycle === "annual"
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
    .select(
      "id, name, price, annual_price, per_listing_amount, founding_price, founding_annual_price, founding_per_listing_amount, currency, product_type, is_active",
    )
    .eq("id", input.productId)
    .maybeSingle();
  if (!product || !product.is_active || product.product_type === "product") {
    return { ok: false, error: "That plan isn't available." };
  }

  // WS-5: bill the lock-aware amount (Founding lock + per-additional-listing) so a
  // Founding host on PayPal recurs at their frozen price, not the live list price.
  // Priority: an EXISTING lock on the host's sub → else the Founding rate while the
  // Founding-offers window is open (a fresh conversion) → else the live list price.
  const { data: lockSub } = await admin
    .from("subscriptions")
    .select("is_founding, locked_base_amount, locked_per_listing_amount")
    .eq("host_id", input.hostId)
    .eq("product_id", product.id)
    .maybeSingle();
  const foundingOffer =
    (lockSub?.locked_base_amount == null ||
      Number(lockSub.locked_base_amount) <= 0) &&
    product.founding_price != null &&
    (await isFoundingOffersOpen())
      ? {
          locked_base_amount:
            input.cycle === "annual"
              ? (product.founding_annual_price ?? product.founding_price)
              : product.founding_price,
          locked_per_listing_amount: product.founding_per_listing_amount ?? 0,
        }
      : null;
  const listingCount = await countHostListings(admin, input.hostId);
  const effectiveAmount = resolveMembershipAmount({
    cycle: input.cycle,
    listingCount,
    product,
    lock: lockSub?.locked_base_amount != null ? lockSub : foundingOffer,
  });

  const planId = await ensurePayPalPlan(admin, {
    product,
    cycle: input.cycle,
    creds,
    amountOverride: effectiveAmount,
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
 * Mid-cycle UPGRADE on the PayPal rail — single approval, prorated (R5).
 *
 * PayPal native subs bill the full plan immediately, so a plain new subscription
 * would overcharge a host who still holds unused paid time. Instead we mint a
 * PER-UPGRADE billing plan whose one-time **setup_fee is the prorated delta**
 * (charged at approval) and whose recurring amount is the go-forward full price,
 * then create the subscription with **start_time = the current period end** so the
 * first recurring charge is deferred to renewal. Net effect in ONE approval: the
 * host pays only the delta now and recurs at the new tier from period end. The
 * setup-fee sale's SALE.COMPLETED is settled by recordPayPalSaleCompleted, which
 * reads PayPal's next_billing_time (still the deferred start) so it does NOT grant
 * a free cycle. The old sub is cancelled when the new one activates
 * (retireOtherMemberships). Falls back to a normal full-price sub when there is no
 * unused period to prorate.
 */
export async function startPayPalUpgradeCheckout(input: {
  hostId: string;
  subId: string;
  newProductId: string;
  cycle: "monthly" | "annual";
  returnUrl: string;
  cancelUrl: string;
}): Promise<StartPayPalSubResult> {
  const admin = createAdminClient();
  if (!(await isPayPalRecurringEnabled())) {
    return { ok: false, error: "PayPal recurring isn't enabled." };
  }
  const creds = await getPlatformPayPal();
  if (!creds) return { ok: false, error: "PayPal isn't configured." };

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, product_id, current_period_start, current_period_end")
    .eq("id", input.subId)
    .maybeSingle();
  if (!sub) return { ok: false, error: "Subscription not found." };

  const { data: product } = await admin
    .from("products")
    .select("id, name, price, annual_price, currency, product_type, is_active")
    .eq("id", input.newProductId)
    .maybeSingle();
  if (!product || !product.is_active || product.product_type === "product") {
    return { ok: false, error: "That plan isn't available." };
  }

  const newPrice =
    input.cycle === "annual"
      ? Number(product.annual_price ?? product.price)
      : Number(product.price);
  let oldPrice = 0;
  if (sub.product_id) {
    const { data: old } = await admin
      .from("products")
      .select("price, annual_price")
      .eq("id", sub.product_id)
      .maybeSingle();
    if (old) {
      oldPrice =
        input.cycle === "annual"
          ? Number(old.annual_price ?? old.price)
          : Number(old.price);
    }
  }

  const now = new Date();
  const frac = unusedFraction(
    sub.current_period_start,
    sub.current_period_end,
    now,
  );
  // No unused period to prorate → a plain full-price native sub is correct.
  if (!(frac > 0) || !sub.current_period_end) {
    return startPayPalSubscriptionCheckout({
      hostId: input.hostId,
      productId: input.newProductId,
      cycle: input.cycle,
      returnUrl: input.returnUrl,
      cancelUrl: input.cancelUrl,
    });
  }

  const deltaZar = membershipSwitchAmount(
    newPrice,
    oldPrice,
    sub.current_period_start,
    sub.current_period_end,
    now,
  );

  // Ensure the base (catalog product + plan) exists, then read the catalog id to
  // hang a per-upgrade plan (setup_fee = delta) off it.
  await ensurePayPalPlan(admin, { product, cycle: input.cycle, creds });
  const { data: planRow } = await admin
    .from("product_billing_plans")
    .select("provider_product_id")
    .eq("product_id", product.id)
    .eq("provider", "paypal")
    .eq("cycle", input.cycle)
    .eq("environment", creds.env)
    .eq("status", "active")
    .maybeSingle();
  const catalogId = planRow?.provider_product_id;
  if (!catalogId) {
    return { ok: false, error: "Couldn't prepare the PayPal plan." };
  }

  const fullUsd = await convertZarToUsd(newPrice);
  if (!(fullUsd > 0)) return { ok: false, error: "Couldn't price the plan." };
  const deltaUsd = deltaZar > 0 ? await convertZarToUsd(deltaZar) : 0;

  const upgradePlanId = await createPayPalBillingPlan({
    productId: catalogId,
    name: `${product.name} (${input.cycle}) upgrade`,
    cycle: input.cycle,
    amount: fullUsd,
    setupFeeUsd: deltaUsd > 0 ? deltaUsd : undefined,
    creds,
  });
  if (!upgradePlanId) {
    return { ok: false, error: "Couldn't prepare the upgrade." };
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

  const created = await createPayPalSubscription({
    planId: upgradePlanId,
    startTime: sub.current_period_end, // defer recurring to period end
    returnUrl: input.returnUrl,
    cancelUrl: input.cancelUrl,
    customId: encodeCustomId(input.hostId, product.id, input.cycle),
    subscriberEmail: email,
    brandName: "Wielo",
    creds,
  });
  if (!created) return { ok: false, error: "Couldn't start PayPal checkout." };
  return {
    ok: true,
    approveUrl: created.approveUrl,
    subscriptionId: created.subscriptionId,
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
    // Grab their PayPal handles BEFORE we mark them cancelled — a retired
    // membership's native sub must also be cancelled at PayPal, or it keeps
    // auto-charging the host after they've moved to a new plan.
    const { data: retiring } = await admin
      .from("subscriptions")
      .select("id, paypal_subscription_id")
      .in("id", retire);
    await admin
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .in("id", retire);
    for (const r of retiring ?? []) {
      if (r.paypal_subscription_id) {
        try {
          await cancelHostPayPalSubscription(
            r.paypal_subscription_id,
            "Superseded by a plan change",
          );
        } catch {
          // Best-effort — the local row is already retired; a failed remote
          // cancel is caught by the reconcile cron (CANCELLED/EXPIRED sweep).
        }
      }
    }
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
  // Period end = PayPal's OWN next_billing_time (the end of the period this charge
  // paid for), falling back to a computed cycle if unavailable. This trusts the
  // provider's schedule (R4) and is essential for a deferred UPGRADE sub: the
  // one-time setup-fee (proration delta) fires a SALE.COMPLETED too, but PayPal's
  // next_billing_time still points at the deferred start (the current period end),
  // so we DON'T wrongly grant a free extra cycle for the delta.
  let periodEnd = addMonths(now, cycle === "annual" ? 12 : 1);
  try {
    const creds = await getPlatformPayPal();
    if (creds) {
      const remote = await getPayPalSubscription(input.subscriptionId, creds);
      if (
        remote?.nextBillingTime &&
        new Date(remote.nextBillingTime).getTime() > now.getTime()
      ) {
        periodEnd = remote.nextBillingTime;
      }
    }
  } catch {
    // Fall back to the computed cycle — never break settlement over a read.
  }

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
      product_id: sub?.product_id ?? null, // H1.2 — direct product attribution for affiliate accrual + reporting (null when the sale beats ACTIVATED; re-linked by reconcile, H1.3)
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
      // H1.3 — if the SALE beats ACTIVATED (no local sub yet) the row is orphaned
      // (null user/host/sub). Tag it with the PayPal sub id so the reconcile sweep
      // can find + re-attach it once the subscription exists. Cleaned on re-link.
      reason: sub
        ? "Subscription renewal (PayPal)"
        : `Subscription renewal (PayPal) [ppsub:${input.subscriptionId}]`,
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
  relinked: number;
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
    relinked: 0,
    errors: 0,
  };

  if (!(await isPayPalRecurringEnabled())) return summary;
  summary.enabled = true;

  const creds = await getPlatformPayPal();
  if (!creds) return summary;

  const dueBefore = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: subs } = await admin
    .from("subscriptions")
    .select(
      "id, status, current_period_end, paypal_subscription_id, host_id, plan, product_id",
    )
    .in("status", ["active", "past_due"])
    .not("paypal_subscription_id", "is", null)
    .lte("current_period_end", dueBefore)
    .limit(100);

  for (const sub of subs ?? []) {
    const subscriptionId = sub.paypal_subscription_id as string;
    summary.checked += 1;
    try {
      // H1.3 — re-attach any orphaned pp_sale rows now that this sub is mapped.
      summary.relinked += await relinkOrphanPayPalSales(admin, sub);

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
 * H1.3 — Re-attach orphaned PayPal sale rows to their subscription.
 *
 * recordPayPalSaleCompleted books the money even when PAYMENT.SALE.COMPLETED beats
 * BILLING.SUBSCRIPTION.ACTIVATED (the local sub isn't mapped yet), leaving a
 * platform_ledger row with null user/host/subscription whose `reason` is tagged
 * `[ppsub:<paypal_subscription_id>]`. That charge counts in the admin ZAR total but
 * is invisible in the host's billing history forever — the old reconcile never
 * re-linked it (the comment lied). Once the local subscription exists, back-fill the
 * attribution, accrue any affiliate commission it now qualifies for, and clean the tag.
 *
 * Idempotent: the update is compare-and-set on `subscription_id IS NULL`, so a
 * concurrent link or a second reconcile tick can't double-attach or double-accrue.
 */
async function relinkOrphanPayPalSales(
  admin: Admin,
  sub: {
    id: string;
    host_id: string | null;
    plan: string | null;
    product_id: string | null;
    paypal_subscription_id: string | null;
  },
): Promise<number> {
  if (!sub.paypal_subscription_id || !sub.host_id) return 0;
  // PayPal subscription ids (e.g. I-BW452GLLEP1G) contain no LIKE metacharacters,
  // so the tag can be matched literally; brackets are literal in SQL LIKE.
  const tag = `[ppsub:${sub.paypal_subscription_id}]`;
  const { data: orphans } = await admin
    .from("platform_ledger")
    .select("id")
    .eq("provider", "paypal")
    .is("subscription_id", null)
    .like("provider_reference", "pp_sale\\_%")
    .like("reason", `%${tag}%`)
    .limit(50);
  if (!orphans || orphans.length === 0) return 0;

  const { data: host } = await admin
    .from("hosts")
    .select("user_id")
    .eq("id", sub.host_id)
    .maybeSingle();

  let relinked = 0;
  for (const row of orphans) {
    const { data: won } = await admin
      .from("platform_ledger")
      .update({
        user_id: host?.user_id ?? null,
        host_id: sub.host_id,
        subscription_id: sub.id,
        plan: sub.plan,
        product_id: sub.product_id,
        reason: "Subscription renewal (PayPal)",
      })
      .eq("id", row.id)
      .is("subscription_id", null) // compare-and-set — don't clobber a concurrent link
      .select("id");
    if (!won || won.length === 0) continue; // another tick won it
    relinked += 1;
    // Now that the row is attributed to a host, accrue affiliate if that host was
    // referred (a no-op at orphan time — there was no host to resolve).
    await accrueAffiliateAndNotify(admin, row.id);
  }
  return relinked;
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
