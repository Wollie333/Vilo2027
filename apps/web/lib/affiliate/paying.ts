// Single source of truth: is this referred host currently a PAYING host?
//
// "Paying" = a live PAID membership — any non-free plan on an active (or
// past-due) subscription. This is deliberately NOT a hardcoded plan allowlist:
// the old `{ basic, pro, business }` set drifted from the real product catalogue
// (Starter / Standard / Founder / Growth were all missed), so genuinely paying
// hosts were shown as "Free" and left out of every paying count — the
// "R125 commission recorded but 0 paying" bug. Trialing is excluded on purpose:
// a free trial has not paid yet. Kept in ONE place so the affiliate portal, the
// admin per-affiliate page, the admin user record and the affiliate products
// page can never disagree about who is paying.

const NON_PAYING_PLANS = new Set(["free", "none", ""]);
const PAYING_STATUSES = new Set(["active", "past_due"]);

export function isPayingSubscription(sub: {
  plan?: string | null;
  status?: string | null;
}): boolean {
  const plan = (sub.plan ?? "").trim().toLowerCase();
  const status = (sub.status ?? "").trim().toLowerCase();
  return !NON_PAYING_PLANS.has(plan) && PAYING_STATUSES.has(status);
}
