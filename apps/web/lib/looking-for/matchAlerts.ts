import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchEvent } from "@/lib/notifications/dispatch";

// Notify hosts whose active saved-search alert matches a newly created PUBLIC
// Looking-For post. Real-time (called from createRequestAction after insert) so
// a matching host hears about the request immediately — this is what makes the
// "saved search alerts" and "new request in your area" notification actually
// fire. Best-effort: never throw into the create path.
//
// An alert is a set of OPTIONAL filters; a null filter matches anything. The
// post must satisfy every filter the host DID set. Alert regions + the post
// region both come from the same fixed REGIONS list, so equality is exact.

export type PostForAlertMatch = {
  id: string;
  title: string | null;
  category: string;
  location_region: string | null;
  location_text: string | null;
  adults: number;
  children: number;
  infants: number;
  budget_min: number | null;
  budget_max: number | null;
  check_in_date: string | null;
  is_public: boolean;
};

type AlertRow = {
  id: string;
  host_id: string;
  category: string | null;
  location_region: string | null;
  min_budget: number | null;
  max_budget: number | null;
  min_guests: number | null;
  max_guests: number | null;
  check_in_from: string | null;
  check_in_to: string | null;
  match_count: number | null;
  host: { user_id: string | null } | { user_id: string | null }[] | null;
};

function guestTotal(p: PostForAlertMatch): number {
  return (p.adults ?? 0) + (p.children ?? 0) + (p.infants ?? 0);
}

/** Does the post satisfy every filter the host set on this alert? */
export function alertMatchesPost(a: AlertRow, p: PostForAlertMatch): boolean {
  if (a.category && a.category !== p.category) return false;

  if (
    a.location_region &&
    (!p.location_region ||
      a.location_region.toLowerCase() !== p.location_region.toLowerCase())
  ) {
    return false;
  }

  const guests = guestTotal(p);
  if (a.min_guests != null && guests < a.min_guests) return false;
  if (a.max_guests != null && guests > a.max_guests) return false;

  // Budget overlap: the post's budget band must intersect the alert's band.
  // Treat missing post budget as "open" so a no-budget request still matches a
  // host who quotes anything.
  if (
    a.min_budget != null &&
    p.budget_max != null &&
    p.budget_max < a.min_budget
  ) {
    return false;
  }
  if (
    a.max_budget != null &&
    p.budget_min != null &&
    p.budget_min > a.max_budget
  ) {
    return false;
  }

  if (p.check_in_date) {
    if (a.check_in_from && p.check_in_date < a.check_in_from) return false;
    if (a.check_in_to && p.check_in_date > a.check_in_to) return false;
  }

  return true;
}

export async function notifyMatchingAlerts(
  post: PostForAlertMatch,
): Promise<{ matched: number }> {
  // Private/targeted requests aren't broadcast to alert-holders.
  if (!post.is_public) return { matched: 0 };

  try {
    const admin = createAdminClient();
    const { data: alerts } = await admin
      .from("looking_for_alerts")
      .select(
        "id, host_id, category, location_region, min_budget, max_budget, min_guests, max_guests, check_in_from, check_in_to, match_count, host:hosts(user_id)",
      )
      .eq("is_active", true);

    if (!alerts?.length) return { matched: 0 };

    const nowIso = new Date().toISOString();
    let matched = 0;

    for (const raw of alerts as unknown as AlertRow[]) {
      if (!alertMatchesPost(raw, post)) continue;
      const hostRel = Array.isArray(raw.host) ? raw.host[0] : raw.host;
      const userId = hostRel?.user_id ?? null;
      if (!userId) continue;

      await dispatchEvent({
        kind: "looking_for_new_post_region",
        recipientUserId: userId,
        hostId: raw.host_id,
        refs: {
          post_id: post.id,
          post_title: post.title ?? undefined,
          location_text:
            post.location_text ?? post.location_region ?? undefined,
        },
      });

      await admin
        .from("looking_for_alerts")
        .update({
          match_count: (raw.match_count ?? 0) + 1,
          last_notified_at: nowIso,
        })
        .eq("id", raw.id);

      matched += 1;
    }

    return { matched };
  } catch (err) {
    console.error("[looking-for] alert match failed", err);
    return { matched: 0 };
  }
}
