// Single rule for how a per-user LOCKED recurring price (admin price override or a
// Founding lock, stored on subscriptions.locked_base_amount) feeds MRR. When a sub
// carries a lock, THAT amount is billed — not the product/plan list price — so every
// revenue window must count the lock, or MRR/ARR overstate for overridden hosts.
// See docs/features/REPORTING_SINGLE_SOURCE_PLAN.md.

// The monthly MRR contribution implied by a lock, or null when there is no lock
// (caller then falls back to its list-price logic). Annual locks are /12.
export function lockedMonthlyMrr(
  lockedBaseAmount: number | string | null | undefined,
  billingCycle: string | null | undefined,
): number | null {
  const locked = lockedBaseAmount != null ? Number(lockedBaseAmount) : 0;
  if (!(locked > 0)) return null;
  return billingCycle === "annual" ? locked / 12 : locked;
}
