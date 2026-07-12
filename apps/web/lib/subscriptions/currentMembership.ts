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
    if (c.productType !== "membership") return;
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
