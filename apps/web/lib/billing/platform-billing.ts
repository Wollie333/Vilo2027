import "server-only";

import { decryptSecret } from "@/lib/crypto/payments";
import { initializeTransaction } from "@/lib/paystack";
import { getPlan } from "@/lib/plans/getPlans";
import { createAdminClient } from "@/lib/supabase/admin";

// Wielo's OWN subscription billing — charges hosts on the PLATFORM Paystack key
// (never the host's own key; that's for booking money). Booking rails are
// untouched. Capability-gated: when PAYSTACK_SECRET_KEY (platform) is unset,
// billing is considered "not configured" and callers fall back to the pre-MVP
// state-only flow so the founder can keep smoke-testing without real charges.

// The platform Paystack secret — admin-configured in DB (Payment settings),
// falling back to the PAYSTACK_SECRET_KEY env var. null = not configured.
export async function getPlatformPaystackSecret(): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_payment_settings")
    .select(
      "paystack_enabled, paystack_mode, paystack_secret_key, paystack_test_secret_key",
    )
    .eq("id", true)
    .maybeSingle();
  if (data?.paystack_enabled) {
    // Use the key pair for the active mode so test checkouts use sk_test_ keys.
    const active =
      data.paystack_mode === "test"
        ? data.paystack_test_secret_key
        : data.paystack_secret_key;
    // Decrypt at rest (transparent passthrough for legacy plaintext keys). The
    // sk_live_/sk_test_ prefix check downstream needs the real key back.
    if (active) return decryptSecret(active);
  }
  return process.env.PAYSTACK_SECRET_KEY ?? null;
}

export async function isPlatformBillingConfigured(): Promise<boolean> {
  return !!(await getPlatformPaystackSecret());
}

export type CheckoutResult =
  | { ok: true; authorizationUrl: string; reference: string }
  | { ok: false; error: string };

// Start a Paystack checkout for a host buying/renewing a paid plan. Inserts a
// PENDING platform_ledger row keyed by the reference (idempotency); the webhook
// flips it to completed and activates the subscription on charge.success.
export async function startSubscriptionCheckout(input: {
  hostId: string;
  planKey: string;
  cycle: "monthly" | "annual";
}): Promise<CheckoutResult> {
  const secretKey = await getPlatformPaystackSecret();
  if (!secretKey) {
    return { ok: false, error: "Billing is not configured." };
  }

  const plan = await getPlan(input.planKey);
  if (!plan || !plan.isActive) return { ok: false, error: "Unknown plan." };
  if (plan.isFree) return { ok: false, error: "Free plans aren't charged." };

  const amount = input.cycle === "annual" ? plan.annual : plan.monthly;
  if (amount <= 0) return { ok: false, error: "This plan has no price set." };

  const admin = createAdminClient();

  // Resolve the host owner + email.
  const { data: host } = await admin
    .from("hosts")
    .select("id, user_id")
    .eq("id", input.hostId)
    .maybeSingle();
  if (!host?.user_id) return { ok: false, error: "Host not found." };

  const { data: profile } = await admin
    .from("user_profiles")
    .select("email")
    .eq("id", host.user_id)
    .maybeSingle();
  const email = profile?.email;
  if (!email) return { ok: false, error: "No billing email on file." };

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id")
    .eq("host_id", input.hostId)
    .maybeSingle();

  const reference = `sub_${input.hostId}_${Date.now()}`;

  // Test vs live is derived from the active Paystack secret key prefix so
  // test-key checkouts stay out of live KPIs (see migration 20260616000020).
  const environment = secretKey.startsWith("sk_live_") ? "live" : "test";

  // Pending revenue row (idempotency anchor for the webhook).
  const { error: ledgerErr } = await admin.from("platform_ledger").insert({
    user_id: host.user_id,
    host_id: input.hostId,
    subscription_id: sub?.id ?? null,
    plan: input.planKey,
    billing_cycle: input.cycle,
    type: "charge",
    status: "pending",
    amount,
    currency: plan.currency,
    provider: "paystack",
    provider_reference: reference,
    environment,
    reason: `Subscription: ${plan.name} (${input.cycle})`,
  });
  if (ledgerErr) return { ok: false, error: ledgerErr.message };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  try {
    const res = await initializeTransaction({
      amount,
      currency: plan.currency,
      email,
      callbackUrl: `${siteUrl}/dashboard/settings/subscription/billing/return`,
      reference,
      metadata: {
        purpose: "subscription",
        host_id: input.hostId,
        user_id: host.user_id,
        plan: input.planKey,
        cycle: input.cycle,
        // Carried so the webhook tags auto-renewal ledger rows correctly.
        environment,
      },
      // Admin-configured platform key (Wielo's own revenue).
      secretKey,
    });
    return { ok: true, authorizationUrl: res.authorization_url, reference };
  } catch (e) {
    // Roll back the pending row so a failed init doesn't leave noise.
    await admin
      .from("platform_ledger")
      .delete()
      .eq("provider_reference", reference);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't start checkout.",
    };
  }
}
