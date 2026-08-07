// Single source of truth: is this referred host currently a PAYING host?
//
// "Paying" = a live PAID membership on an active/past-due subscription. This is
// deliberately NOT based on the `plan` string:
//   - The old `PAID_PLANS = { basic, pro, business }` allowlist drifted from the
//     real product catalogue (Starter / Standard / Founder / Growth were missed).
//   - Worse, the `plan` COLUMN is unreliable — activation sets a subscription's
//     `product_id` to the paid product but can leave `plan = 'free'`, so a host
//     genuinely paying for "Starter" reads `plan: 'free'` (confirmed live). Any
//     plan-string check mislabels them as free and drops them from every count —
//     the "R125 commission recorded but 0 paying" bug.
//
// The reliable signal is `product_id`: a paid membership subscription carries one
// (the subscription→product model); the free tier has `product_id = null`. Legacy
// paid subs that predate that model carry a non-free `plan` instead, so we accept
// either. Trialing is excluded — a free trial has not paid. Kept in ONE place so
// the affiliate portal, the affiliate products page, the admin per-affiliate page
// and the admin user record can never disagree about who is paying.

const NON_PAYING_PLANS = new Set(["free", "none", ""]);
const PAYING_STATUSES = new Set(["active", "past_due"]);

export function isPayingSubscription(sub: {
  plan?: string | null;
  status?: string | null;
  product_id?: string | null;
}): boolean {
  const status = (sub.status ?? "").trim().toLowerCase();
  if (!PAYING_STATUSES.has(status)) return false;
  // Primary signal: a paid membership carries a product_id (free = null).
  if (sub.product_id != null) return true;
  // Legacy fallback for pre-product paid subs: a non-free plan string.
  const plan = (sub.plan ?? "").trim().toLowerCase();
  return plan.length > 0 && !NON_PAYING_PLANS.has(plan);
}
