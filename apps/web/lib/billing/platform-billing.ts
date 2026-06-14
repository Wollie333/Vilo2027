import "server-only";

import { initializeTransaction } from "@/lib/paystack";
import { getPlan } from "@/lib/plans/getPlans";
import { createAdminClient } from "@/lib/supabase/admin";

// Vilo's OWN subscription billing — charges hosts on the PLATFORM Paystack key
// (never the host's own key; that's for booking money). Booking rails are
// untouched. Capability-gated: when PAYSTACK_SECRET_KEY (platform) is unset,
// billing is considered "not configured" and callers fall back to the pre-MVP
// state-only flow so the founder can keep smoke-testing without real charges.

export function isPlatformBillingConfigured(): boolean {
  return !!process.env.PAYSTACK_SECRET_KEY;
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
  if (!isPlatformBillingConfigured()) {
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
      },
      // No secretKey → platform key (Vilo's own revenue).
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
