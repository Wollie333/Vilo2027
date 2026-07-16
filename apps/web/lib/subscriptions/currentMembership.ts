// Selecting a host's CURRENT membership subscription.
//
// A host holds at most one membership + N service subscriptions, but legacy/seed
// data (and any past plan changes that inserted rather than updated) can leave
// several membership rows — typically one live plus older cancelled ones. Picking
// "the first membership" is wrong: it ignores status and can surface a cancelled
// plan while the host is actually on a live one. Every place that answers "what
// plan is this host on?" must use this selector so the header, the Subscription
// tab, and the self-serve mutations all agree.

// Statuses that mean the membership is currently in force (billing or trialling).
const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export type MembershipCandidate = {
  status: string | null;
  productType: string | null;
  createdAt: string | null;
};

/**
 * True when a subscription row is a MEMBERSHIP.
 *
 * `productType` is null exactly when the row has no catalog product, because every
 * caller reads it as `product?.product_type ?? null` off a joined `products` row
 * and `subscriptions.product_id` is FK-constrained (so it can't dangle). A
 * product-less subscription is the baseline signup inserts — plan `free`,
 * `product_id` NULL — which IS a membership: the guest tier every account starts
 * on (`signup/host/actions.ts` §4). It just has no catalog row.
 *
 * Excluding it was the same mistake the retire paths made with `s.product_id && …`
 * (fixed in 39e17078): the baseline became invisible, so a host holding one looked
 * like they had no membership at all. A `service` / `product` / `wielo_credits` sub
 * reports its real type and is still correctly excluded.
 */
export function isMembershipProductType(productType: string | null): boolean {
  return productType === null || productType === "membership";
}

function isMembershipCandidate(c: MembershipCandidate): boolean {
  return isMembershipProductType(c.productType);
}

/**
 * Index of the host's current membership within `rows`, or -1 if none.
 *
 * Prefers a LIVE membership (active/trialing/past_due), newest first; if none is
 * live, falls back to the most recent membership row (so callers that need a row
 * to act on / name still get the latest one). Non-membership subs are ignored.
 */
export function pickCurrentMembershipIndex<T>(
  rows: readonly T[],
  read: (row: T) => MembershipCandidate,
): number {
  let liveIdx = -1;
  let liveTime = -Infinity;
  let anyIdx = -1;
  let anyTime = -Infinity;

  rows.forEach((row, i) => {
    const c = read(row);
    if (!isMembershipCandidate(c)) return;
    const t = c.createdAt ? new Date(c.createdAt).getTime() : 0;
    if (t >= anyTime) {
      anyTime = t;
      anyIdx = i;
    }
    if (c.status && LIVE_STATUSES.has(c.status) && t >= liveTime) {
      liveTime = t;
      liveIdx = i;
    }
  });

  return liveIdx !== -1 ? liveIdx : anyIdx;
}

/** True when a membership row is currently in force (not cancelled/expired). */
export function isLiveMembershipStatus(status: string | null): boolean {
  return status != null && LIVE_STATUSES.has(status);
}
