import "server-only";

import {
  reconcilePayPalSubscriptions,
  type PayPalReconcileSummary,
} from "@/lib/billing/paypal-subscription";
import {
  reconcilePaystackPendingRenewals,
  type RenewalReconcileSummary,
} from "@/lib/billing/subscription-renewal";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Time-driven subscription reconcile (Phase 4). Repairs drift on BOTH rails after
 * a missed/failed webhook or a worker crash between charge and settle:
 *  - Paystack: settle stuck `renew_…` claims (charged-but-not-extended).
 *  - PayPal: cross-check provider state (extend on a missed renewal, end on a
 *    provider cancel/expire).
 *
 * Each rail is independently gated by its recurring flag and is fully idempotent,
 * so this is safe to schedule + deploy before go-live (a no-op until a rail is
 * armed). Pinged hourly by the reconcile-subscriptions pg_cron.
 */
export type SubscriptionReconcileSummary = {
  paystack: RenewalReconcileSummary;
  paypal: PayPalReconcileSummary;
};

export async function runSubscriptionReconcile(
  admin = createAdminClient(),
): Promise<SubscriptionReconcileSummary> {
  const [paystack, paypal] = await Promise.all([
    reconcilePaystackPendingRenewals(admin),
    reconcilePayPalSubscriptions(admin),
  ]);
  return { paystack, paypal };
}
