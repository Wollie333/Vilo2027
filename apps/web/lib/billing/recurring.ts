import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Recurring-billing feature gates (Phase 0).
 *
 * Real recurring billing is OFF by default and enabled per-rail on the singleton
 * platform_payment_settings row (paystack_recurring_enabled /
 * paypal_recurring_enabled, migration 20260720000000). While a rail is OFF, the
 * checkout paths fall back to today's state-only plan switch — no provider
 * subscription is created and NO real recurring charge can happen. This is the
 * single reader every recurring code path consults before doing anything that
 * could take money on a schedule.
 *
 * Fail CLOSED: any read error (missing row, RLS, transient DB) resolves to
 * "disabled" so a blip can never accidentally arm live recurring charges.
 *
 * The PayPal rail carries a SECOND, non-negotiable condition. PayPal has no
 * merchant-initiated charge, so renewals arrive ONLY as webhooks, and
 * /api/paypal-webhook refuses every event it cannot verify — which, without
 * PAYPAL_WEBHOOK_ID, is all of them (401, fail closed). Arming the rail in that
 * state is the worst possible outcome: PayPal bills the host on schedule while
 * Wielo records no renewal, no cancellation, no failure. So the env var is
 * treated as part of the gate — the DB flag alone cannot arm a rail whose only
 * settle path is guaranteed to reject.
 */
export type RecurringConfig = {
  paystack: boolean;
  paypal: boolean;
};

export async function getRecurringConfig(): Promise<RecurringConfig> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_payment_settings")
      .select("paystack_recurring_enabled, paypal_recurring_enabled")
      .eq("id", true)
      .maybeSingle();
    return {
      paystack: data?.paystack_recurring_enabled === true,
      paypal:
        data?.paypal_recurring_enabled === true &&
        !!process.env.PAYPAL_WEBHOOK_ID,
    };
  } catch {
    return { paystack: false, paypal: false };
  }
}

export async function isPaystackRecurringEnabled(): Promise<boolean> {
  return (await getRecurringConfig()).paystack;
}

export async function isPayPalRecurringEnabled(): Promise<boolean> {
  return (await getRecurringConfig()).paypal;
}

/**
 * WS-5 — is the Founding-offers window open? While true (beta), a host converting
 * to the paid plan is auto-priced at the Founding rate and gets the lifetime lock
 * (see product-checkout activation). Fail CLOSED: any read error → false, so no
 * host is ever accidentally locked to the below-list Founding price.
 */
export async function isFoundingOffersOpen(): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_payment_settings")
      .select("founding_offers_open")
      .eq("id", true)
      .maybeSingle();
    return data?.founding_offers_open === true;
  } catch {
    return false;
  }
}
