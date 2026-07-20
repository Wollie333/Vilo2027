import "server-only";

import { accrueAffiliateAndNotify } from "@/lib/affiliate/notify";
import { getPlatformPaystackSecret } from "@/lib/billing/platform-billing";
import { isPaystackRecurringEnabled } from "@/lib/billing/recurring";
import { nextPeriod, renewalReference } from "@/lib/billing/renewal-schedule";
import { grantSubscriptionCredits } from "@/lib/credits/wallet";
import { decryptSecret } from "@/lib/crypto/payments";
import { chargeAuthorization, verifyTransaction } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Paystack recurring-renewal engine (hybrid model). A Wielo cron pings the
 * subscription-renewal-worker, which calls runPaystackRenewals: for every
 * subscription whose period is due and which has a saved reusable card
 * authorization, re-charge the CURRENT price via /transaction/charge_authorization
 * and extend the period on success (or start dunning on a decline).
 *
 * Idempotency is per-(subscription, period, attempt): the ledger row is keyed by
 * `renew_{subId}_{periodStartYMD}_a{attempt}` and platform_ledger.provider_reference
 * is UNIQUE — so a double-run, or the backstop paystack-webhook firing for the same
 * charge, can never double-charge or double-extend. Only the writer that flips the
 * ledger row pending→completed extends the subscription (compare-and-set, R3).
 *
 * Amount is the product's CURRENT ZAR price (R2 — we control the charge, so we
 * charge and record today's price, never a stale plan amount).
 */

type Admin = ReturnType<typeof createAdminClient>;

// Renew a subscription up to this many times before giving up for the period —
// after that the sub sits past_due and the restrict-overdue cron takes over at
// grace end. Bounds the daily retries during the grace window.
const MAX_ATTEMPTS = 4;

// How far ahead of expiry to renew, so a paying sub never lapses between the due
// date and the daily cron tick.
const RENEW_LEAD_MS = 24 * 60 * 60 * 1000;

export type RenewalSummary = {
  enabled: boolean;
  due: number;
  renewed: number;
  declined: number;
  skipped: number;
  errors: number;
};

function envFromSecret(secret: string): "live" | "test" {
  return secret.startsWith("sk_live_") ? "live" : "test";
}

type DueSub = {
  id: string;
  host_id: string;
  plan: string | null;
  billing_cycle: string | null;
  product_id: string | null;
  status: string;
  current_period_end: string | null;
  failed_payment_count: number | null;
  paystack_authorization_code_cipher: string | null;
};

export async function runPaystackRenewals(
  admin: Admin = createAdminClient(),
): Promise<RenewalSummary> {
  const summary: RenewalSummary = {
    enabled: false,
    due: 0,
    renewed: 0,
    declined: 0,
    skipped: 0,
    errors: 0,
  };

  // Gate: OFF → do nothing (no real charge can happen).
  if (!(await isPaystackRecurringEnabled())) return summary;
  summary.enabled = true;

  const secret = await getPlatformPaystackSecret();
  if (!secret) return summary; // billing not configured → nothing to charge
  const environment = envFromSecret(secret);

  const dueBefore = new Date(Date.now() + RENEW_LEAD_MS).toISOString();

  // Due = live-billing status, not scheduled to cancel, has a saved card, backed
  // by a real product (product-less baseline = free tier, never charged), period
  // within a day of lapsing (or already lapsed for a past_due retry).
  const { data: rows, error } = await admin
    .from("subscriptions")
    .select(
      "id, host_id, plan, billing_cycle, product_id, status, current_period_end, failed_payment_count, paystack_authorization_code_cipher",
    )
    .in("status", ["active", "past_due"])
    .eq("cancel_at_period_end", false)
    .not("paystack_authorization_code_cipher", "is", null)
    .not("product_id", "is", null)
    .lte("current_period_end", dueBefore)
    .limit(100);
  if (error) throw new Error(error.message);

  const subs = (rows ?? []) as DueSub[];
  summary.due = subs.length;

  for (const sub of subs) {
    try {
      const outcome = await renewOne(admin, sub, secret, environment);
      summary[outcome] += 1;
    } catch (err) {
      summary.errors += 1;
      console.error(
        `subscription-renewal: sub ${sub.id} errored:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return summary;
}

async function renewOne(
  admin: Admin,
  sub: DueSub,
  secret: string,
  environment: "live" | "test",
): Promise<"renewed" | "declined" | "skipped" | "errors"> {
  const attempt = Number(sub.failed_payment_count ?? 0);
  if (attempt >= MAX_ATTEMPTS) return "skipped"; // dunning exhausted for now

  // Resolve the billing amount from the CURRENT product price + the sub's cycle.
  const cycle = sub.billing_cycle === "annual" ? "annual" : "monthly";
  const { data: product } = await admin
    .from("products")
    .select("price, annual_price, currency, product_type")
    .eq("id", sub.product_id as string)
    .maybeSingle();
  if (!product || product.product_type === "product") return "skipped";
  const amount =
    cycle === "annual"
      ? Number(product.annual_price ?? product.price)
      : Number(product.price);
  if (!(amount > 0)) return "skipped"; // free / unpriced → nothing to charge
  // H1.1 — Wielo subscription revenue is ALWAYS ZAR (MODEL-2): the platform
  // Paystack account is ZAR and no Plane-B row may carry a host currency. A
  // membership/service product mispriced in another currency is a config error;
  // we still charge + record ZAR rather than leak a non-ZAR ledger row.
  if (product.currency && product.currency !== "ZAR") {
    console.warn(
      `subscription-renewal: product ${sub.product_id} currency ${product.currency} != ZAR — forcing ZAR`,
    );
  }
  const currency = "ZAR";

  // Resolve the billing email (host owner).
  const { data: host } = await admin
    .from("hosts")
    .select("user_id")
    .eq("id", sub.host_id)
    .maybeSingle();
  const userId = host?.user_id ?? null;
  if (!userId) return "skipped";
  const { data: profile } = await admin
    .from("user_profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  const email = profile?.email;
  if (!email) return "skipped";

  // The period this charge PAYS FOR + the per-attempt idempotency reference.
  const { start: newStart, end: newEnd } = nextPeriod(
    sub.current_period_end,
    cycle,
  );
  const reference = renewalReference(sub.id, newStart, attempt);

  // Decrypt the saved authorization.
  let authCode: string;
  try {
    authCode = decryptSecret(sub.paystack_authorization_code_cipher as string);
  } catch {
    return "skipped"; // unreadable token (key rotated) — leave for support
  }
  if (!authCode) return "skipped";

  // Claim this (sub, period, attempt) by inserting the pending ledger row. The
  // UNIQUE provider_reference makes this the idempotency latch: a conflict means
  // the same attempt is already in flight / done, so we must NOT charge again.
  const { error: claimErr } = await admin.from("platform_ledger").insert({
    user_id: userId,
    host_id: sub.host_id,
    subscription_id: sub.id,
    plan: sub.plan,
    product_id: sub.product_id, // H1.2 — so affiliate accrual resolves the product directly (not slug==plan fallback) and reports can attribute the row
    billing_cycle: cycle,
    type: "charge",
    status: "pending",
    amount,
    currency,
    provider: "paystack",
    provider_reference: reference,
    environment,
    period_start: newStart.toISOString(),
    period_end: newEnd.toISOString(),
    reason: "Subscription renewal",
  });
  if (claimErr) {
    // 23505 unique_violation = already claimed → idempotent skip.
    return "skipped";
  }

  // Re-charge the saved card. Metadata mirrors the first checkout so the backstop
  // webhook resolves this exact charge if it fires.
  const charged = await chargeAuthorization({
    authorizationCode: authCode,
    email,
    amount,
    currency,
    reference,
    metadata: {
      purpose: "subscription",
      host_id: sub.host_id,
      user_id: userId,
      plan: sub.plan,
      cycle,
      environment,
    },
    secretKey: secret,
  });

  // Null = HTTP/parse failure (unknown) — roll the claim back so the next tick
  // retries the SAME attempt; do NOT count it as a decline.
  if (charged === null) {
    await admin
      .from("platform_ledger")
      .delete()
      .eq("provider_reference", reference)
      .eq("status", "pending");
    return "errors";
  }

  if (charged.status === "success") {
    await settleRenewalSuccess(admin, {
      subId: sub.id,
      hostId: sub.host_id,
      productId: sub.product_id as string,
      plan: sub.plan,
      cycle,
      amount,
      currency,
      environment,
      reference,
      newStart: newStart.toISOString(),
      newEnd: newEnd.toISOString(),
    });
    return "renewed";
  }

  // Real decline → dunning (mirror the webhook's charge.failed handling).
  await settleRenewalDecline(admin, {
    subId: sub.id,
    hostId: sub.host_id,
    reference,
    amount,
    currency,
    priorFails: attempt,
    status: sub.status,
  });
  return "declined";
}

async function settleRenewalSuccess(
  admin: Admin,
  x: {
    subId: string;
    hostId: string;
    productId: string;
    plan: string | null;
    cycle: "monthly" | "annual";
    amount: number;
    currency: string;
    environment: "live" | "test";
    reference: string;
    newStart: string;
    newEnd: string;
  },
): Promise<void> {
  const nowIso = new Date().toISOString();

  // Compare-and-set: only the writer that flips pending→completed extends the sub
  // (R3) — so the backstop webhook firing for the same reference can't double it.
  const { data: won } = await admin
    .from("platform_ledger")
    .update({ status: "completed", paid_at: nowIso })
    .eq("provider_reference", x.reference)
    .eq("status", "pending")
    .select("id");
  if (!won || won.length === 0) return; // another path already settled this

  await admin
    .from("subscriptions")
    .update({
      status: "active",
      current_period_start: x.newStart,
      current_period_end: x.newEnd,
      failed_payment_count: 0,
      grace_period_ends_at: null,
    })
    .eq("id", x.subId);

  await admin.from("subscription_history").insert({
    subscription_id: x.subId,
    host_id: x.hostId,
    event: "subscription_charged",
    to_plan: x.plan,
    to_status: "active",
    amount_charged: x.amount,
    currency: x.currency,
    notes: "Paystack renewal (saved card)",
  });

  // Recurring credit allotment for the new period (idempotent per product+period).
  try {
    await grantSubscriptionCredits(admin, {
      hostId: x.hostId,
      productId: x.productId,
      periodStart: x.newStart,
    });
  } catch {
    // Credits must never break a settled renewal.
  }

  // Affiliate commission if the payer was referred (idempotent RPC).
  await accrueAffiliateAndNotify(admin, won[0].id);
}

async function settleRenewalDecline(
  admin: Admin,
  x: {
    subId: string;
    hostId: string;
    reference: string;
    amount: number;
    currency: string;
    priorFails: number;
    status: string;
  },
): Promise<void> {
  const now = new Date();

  await admin
    .from("platform_ledger")
    .update({ status: "failed" })
    .eq("provider_reference", x.reference)
    .neq("status", "completed");

  const fails = x.priorFails + 1;
  // Only active/trialing enters grace + starts the 5-day clock; an already
  // past_due sub keeps its ORIGINAL deadline (a failing card can't perpetually
  // reset grace). Always bump the counter. Mirrors the webhook charge.failed path.
  const update: Record<string, unknown> = { failed_payment_count: fails };
  if (x.status === "active" || x.status === "trialing") {
    update.status = "past_due";
    update.grace_period_ends_at = new Date(
      now.getTime() + 5 * 86_400_000,
    ).toISOString();
  }
  await admin.from("subscriptions").update(update).eq("id", x.subId);

  if (x.status === "active" || x.status === "trialing") {
    await admin.from("subscription_history").insert({
      subscription_id: x.subId,
      host_id: x.hostId,
      event: "subscription_payment_failed",
      to_status: "past_due",
      amount_charged: x.amount,
      currency: x.currency,
      notes: `Renewal charge failed (attempt ${fails}) — grace started`,
    });
  }

  // Notify host + admin (deduped per attempt). Best-effort.
  try {
    await admin.rpc("notify_subscription_event", {
      p_host_id: x.hostId,
      p_subscription_id: x.subId,
      p_kind: "subscription_failed",
      p_extra: { amount: x.amount },
      p_dedupe_key: `subscription_failed:${x.subId}:${fails}`,
    });
  } catch {
    // Never break the money path over a notification.
  }
}

// A renewal claim is genuinely stuck only after the live charge + settle window
// has passed — before that a pending row is normal in-flight state.
const RECONCILE_MIN_AGE_MS = 15 * 60 * 1000; // 15 minutes
// Don't chase claims older than this — beyond the grace window a stuck sub is a
// support case, not a reconcile target.
const RECONCILE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export type RenewalReconcileSummary = {
  enabled: boolean;
  checked: number;
  recovered: number;
  declined: number;
  leftPending: number;
  errors: number;
};

/**
 * Reconcile Paystack renewal claims that never resolved (Phase 4 — time-driven).
 *
 * runPaystackRenewals inserts a pending ledger claim, charges the saved card, then
 * settles (extend on success / dunning on decline). If the process dies AFTER the
 * charge but BEFORE the settle, the ledger row stays `pending`, the period is never
 * extended, and — because the per-(sub, period, attempt) reference is UNIQUE — the
 * daily worker will only ever hit a conflict and skip it. That subscription is
 * stuck: money possibly taken, access not granted.
 *
 * This worker verifies each stuck claim against Paystack (the arbiter) and settles
 * it through the SAME idempotent helpers:
 *  - status "success"  → settle + extend the period (compare-and-set; a no-op if a
 *    late webhook already won the flip).
 *  - status failed/abandoned/reversed → the dunning path.
 *  - anything else / a transient verify failure (null) → LEAVE it pending. Never
 *    delete a claim we can't prove was un-charged: re-issuing would risk a double
 *    charge. A truly phantom claim degrades to a support case, never to lost money.
 *
 * Gated by paystack_recurring_enabled → a no-op while the rail is OFF.
 */
export async function reconcilePaystackPendingRenewals(
  admin: Admin = createAdminClient(),
): Promise<RenewalReconcileSummary> {
  const summary: RenewalReconcileSummary = {
    enabled: false,
    checked: 0,
    recovered: 0,
    declined: 0,
    leftPending: 0,
    errors: 0,
  };

  if (!(await isPaystackRecurringEnabled())) return summary;
  summary.enabled = true;

  const secret = await getPlatformPaystackSecret();
  if (!secret) return summary;

  const now = Date.now();
  const minAge = new Date(now - RECONCILE_MIN_AGE_MS).toISOString();
  const maxAge = new Date(now - RECONCILE_MAX_AGE_MS).toISOString();

  // Stuck renewal claims: pending Paystack charge rows keyed by a `renew_…`
  // reference (the escape `\_` matches a literal underscore), inside the window.
  const { data: rows, error } = await admin
    .from("platform_ledger")
    .select(
      "id, subscription_id, host_id, plan, billing_cycle, amount, currency, provider_reference, environment, period_start, period_end",
    )
    .eq("provider", "paystack")
    .eq("type", "charge")
    .eq("status", "pending")
    .not("subscription_id", "is", null)
    .like("provider_reference", "renew\\_%")
    .lt("created_at", minAge)
    .gt("created_at", maxAge)
    .limit(100);
  if (error) throw new Error(error.message);

  for (const row of rows ?? []) {
    if (!row.provider_reference || !row.subscription_id) continue;
    summary.checked += 1;
    try {
      const verified = await verifyTransaction(row.provider_reference, secret);
      if (!verified) {
        summary.leftPending += 1;
        continue;
      }
      const cycle = row.billing_cycle === "annual" ? "annual" : "monthly";
      if (verified.status === "success") {
        const { data: sub } = await admin
          .from("subscriptions")
          .select("product_id")
          .eq("id", row.subscription_id)
          .maybeSingle();
        await settleRenewalSuccess(admin, {
          subId: row.subscription_id,
          hostId: row.host_id as string,
          productId: (sub?.product_id as string) ?? "",
          plan: row.plan,
          cycle,
          amount: Number(row.amount),
          currency: row.currency ?? "ZAR",
          environment: row.environment === "live" ? "live" : "test",
          reference: row.provider_reference,
          newStart: row.period_start ?? new Date().toISOString(),
          newEnd: row.period_end ?? new Date().toISOString(),
        });
        summary.recovered += 1;
      } else if (
        ["failed", "abandoned", "reversed"].includes(verified.status)
      ) {
        const { data: sub } = await admin
          .from("subscriptions")
          .select("status, failed_payment_count")
          .eq("id", row.subscription_id)
          .maybeSingle();
        await settleRenewalDecline(admin, {
          subId: row.subscription_id,
          hostId: row.host_id as string,
          reference: row.provider_reference,
          amount: Number(row.amount),
          currency: row.currency ?? "ZAR",
          priorFails: Number(sub?.failed_payment_count ?? 0),
          status: sub?.status ?? "active",
        });
        summary.declined += 1;
      } else {
        summary.leftPending += 1;
      }
    } catch (err) {
      summary.errors += 1;
      console.error(
        `subscription-reconcile: paystack claim ${row.provider_reference} errored:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return summary;
}
