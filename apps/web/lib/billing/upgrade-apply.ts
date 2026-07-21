import "server-only";

import { grantSubscriptionCredits } from "@/lib/credits/wallet";
import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Apply a prorated membership upgrade — the ONE place a paid delta turns into a
 * higher tier.
 *
 * A prorated upgrade charges only the delta that tops the host's REMAINING paid
 * time up to the new tier, so the switch must preserve the current period: the
 * host keeps their remaining days, now at the higher tier, and the renewal cron
 * re-charges the new price at period_end.
 *
 * This runs from the settle paths (Paystack return, PayPal capture, EFT
 * received) — i.e. only once the delta is really paid. It is deliberately NOT
 * called before hand-off to the card form: an abandoned checkout must leave the
 * host on the tier they have paid for.
 *
 * Idempotent: three settle paths can race for the same order, and the
 * subscription already sitting on the order's product means the work is done.
 */
export async function applyPaidUpgrade(
  admin: ReturnType<typeof createAdminClient>,
  order: {
    id: string;
    product_id: string | null;
    amount: number | string;
    currency: string | null;
    upgrade_subscription_id?: string | null;
    upgrade_plan_key?: string | null;
  },
): Promise<void> {
  const subId = order.upgrade_subscription_id;
  if (!subId || !order.product_id) return;

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, host_id, product_id, current_period_start")
    .eq("id", subId)
    .maybeSingle();
  if (!sub) return;
  // Already on the new tier → another settle path (or an admin) got here first.
  if (sub.product_id === order.product_id) return;

  const patch: Record<string, unknown> = {
    product_id: order.product_id,
    status: "active",
    cancel_at_period_end: false,
    cancelled_at: null,
    cancellation_reason: null,
  };
  // `plan` is an FK to plans.key — only write it when the order carries a real
  // one, so a missing key can never fail the whole upgrade.
  if (order.upgrade_plan_key) patch.plan = order.upgrade_plan_key;

  await admin.from("subscriptions").update(patch).eq("id", sub.id);

  // The higher tier's recurring credit allotment applies to the current period
  // straight away (idempotent per product + period).
  if (sub.host_id && sub.current_period_start) {
    try {
      await grantSubscriptionCredits(admin, {
        hostId: sub.host_id,
        productId: order.product_id,
        periodStart: sub.current_period_start,
      });
    } catch {
      // Credits must never block an upgrade the host has paid for.
    }
  }

  await admin.from("subscription_history").insert({
    subscription_id: sub.id,
    host_id: sub.host_id,
    event: "plan_change",
    to_plan: order.upgrade_plan_key ?? null,
    to_status: "active",
    notes: `Upgraded — prorated delta ${order.currency ?? "ZAR"} ${Number(
      order.amount,
    ).toFixed(2)} paid`,
  });
}
