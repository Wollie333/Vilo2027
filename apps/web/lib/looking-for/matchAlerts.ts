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
  // Optional pinned location + radius (km). When both a pin and a radius are
  // set, a host only matches if one of their published properties is within it.
  location_lat?: number | null;
  location_lng?: number | null;
  search_radius_km?: number | null;
};

// Great-circle distance in km between two lat/lng points (haversine).
function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth radius, km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

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

// A published property, minimal shape for range/region matching.
type PropRow = {
  host_id: string;
  lat: number | null;
  lng: number | null;
  province: string | null;
};

// Hosts with a PUBLISHED property "in range" of a post version. Geo (pin+radius)
// takes precedence; otherwise fall back to province = location_region. Used for
// the default-regional pass AND (on edits) to compute who was already in range.
function hostsInRange(p: PostForAlertMatch, props: PropRow[]): Set<string> {
  const set = new Set<string>();
  const pGeo =
    p.location_lat != null &&
    p.location_lng != null &&
    (p.search_radius_km ?? 0) > 0;
  const region = p.location_region?.toLowerCase() ?? null;
  for (const prop of props) {
    if (pGeo) {
      if (
        prop.lat != null &&
        prop.lng != null &&
        distanceKm(
          p.location_lat as number,
          p.location_lng as number,
          prop.lat,
          prop.lng,
        ) <= (p.search_radius_km as number)
      ) {
        set.add(prop.host_id);
      }
    } else if (region && prop.province?.toLowerCase() === region) {
      set.add(prop.host_id);
    }
  }
  return set;
}

// Build the shared, host-independent notification refs for a post.
function buildPostRefs(post: PostForAlertMatch) {
  const loc = post.location_text ?? post.location_region ?? undefined;
  const guests = guestTotal(post);
  const budget =
    post.budget_min && post.budget_max
      ? `R ${post.budget_min.toLocaleString("en-ZA").replace(/,/g, " ")} – R ${post.budget_max.toLocaleString("en-ZA").replace(/,/g, " ")}`
      : post.budget_max
        ? `Up to R ${post.budget_max.toLocaleString("en-ZA").replace(/,/g, " ")}`
        : post.budget_min
          ? `From R ${post.budget_min.toLocaleString("en-ZA").replace(/,/g, " ")}`
          : undefined;
  const checkIn = post.check_in_date
    ? new Date(`${post.check_in_date}T00:00:00`).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : undefined;
  const guestsLabel =
    guests > 0 ? `${guests} guest${guests === 1 ? "" : "s"}` : undefined;
  return { loc, budget, checkIn, guestsLabel };
}

export async function notifyMatchingAlerts(
  post: PostForAlertMatch,
  // When set (an EDIT), only hosts newly reachable by this version fire — a guest
  // who edits a public post to add/change a region, dates, budget or pin reaches
  // the newly-matching hosts, without re-spamming anyone already notified. A prior
  // version that wasn't public matched nobody, so publishing an edit notifies
  // every current match.
  previous?: PostForAlertMatch | null,
): Promise<{ matched: number }> {
  // Private/targeted requests aren't broadcast to hosts.
  if (!post.is_public) return { matched: 0 };

  try {
    const admin = createAdminClient();
    const { data: alerts } = await admin
      .from("looking_for_alerts")
      .select(
        "id, host_id, category, location_region, min_budget, max_budget, min_guests, max_guests, check_in_from, check_in_to, match_count, host:hosts(user_id, display_name)",
      )
      .eq("is_active", true);

    const hasGeo =
      post.location_lat != null &&
      post.location_lng != null &&
      (post.search_radius_km ?? 0) > 0;

    // Preload every published property once (coords + province). Needed for the
    // saved-search proximity gate AND the default-regional pass below. Loaded
    // whenever we have any targeting basis (a pin or a region).
    const props: PropRow[] = [];
    const propsByHost = new Map<string, { lat: number; lng: number }[]>();
    if (hasGeo || post.location_region) {
      const { data: rows } = await admin
        .from("properties")
        .select("host_id, latitude, longitude, province")
        .eq("is_published", true)
        .is("deleted_at", null);
      for (const p of rows ?? []) {
        const lat = p.latitude != null ? Number(p.latitude) : null;
        const lng = p.longitude != null ? Number(p.longitude) : null;
        props.push({ host_id: p.host_id, lat, lng, province: p.province });
        if (lat != null && lng != null) {
          const arr = propsByHost.get(p.host_id) ?? [];
          arr.push({ lat, lng });
          propsByHost.set(p.host_id, arr);
        }
      }
    }

    const nowIso = new Date().toISOString();
    const { loc, budget, checkIn, guestsLabel } = buildPostRefs(post);
    // Every host notified this run (by user_id), so the two passes never double-send.
    const notifiedUserIds = new Set<string>();
    let matched = 0;

    // ── Pass 1: saved-search alerts (unchanged behaviour) ────────────────────
    for (const raw of (alerts ?? []) as unknown as AlertRow[]) {
      if (!alertMatchesPost(raw, post)) continue;
      // Skip alerts already satisfied by the prior (public) version on an edit.
      if (previous && previous.is_public && alertMatchesPost(raw, previous)) {
        continue;
      }
      // Proximity gate — a host with a GEOCODED property only qualifies if one
      // sits inside the radius. A host with no geocoded property isn't suppressed.
      if (hasGeo) {
        const coords = propsByHost.get(raw.host_id) ?? [];
        if (coords.length > 0) {
          const within = coords.some(
            (c) =>
              distanceKm(
                post.location_lat as number,
                post.location_lng as number,
                c.lat,
                c.lng,
              ) <= (post.search_radius_km as number),
          );
          if (!within) continue;
        }
      }
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
          location_text: loc,
          hostFirstName:
            (
              (hostRel as { display_name?: string | null })?.display_name ?? ""
            ).split(" ")[0] || undefined,
          postTitle: post.title ?? undefined,
          locationText: loc,
          postId: post.id,
          checkIn,
          guests: guestsLabel,
          budget,
        },
      });

      await admin
        .from("looking_for_alerts")
        .update({
          match_count: (raw.match_count ?? 0) + 1,
          last_notified_at: nowIso,
        })
        .eq("id", raw.id);

      notifiedUserIds.add(userId);
      matched += 1;
    }

    // ── Pass 2: DEFAULT regional alerting (WS-2c) ────────────────────────────
    // Every host with a published property in range hears about a new request —
    // not only those who set up a saved search. This is what guarantees a fresh
    // request reaches matching supply. Deduped against pass 1; on an edit, only
    // hosts NEWLY in range fire (those already in range for the prior public
    // version are suppressed, so re-publishing an edit never re-blasts a region).
    if (hasGeo || post.location_region) {
      const targetHostIds = hostsInRange(post, props);
      const prevHostIds =
        previous && previous.is_public
          ? hostsInRange(previous, props)
          : new Set<string>();
      const newHostIds = [...targetHostIds].filter((h) => !prevHostIds.has(h));

      if (newHostIds.length > 0) {
        const { data: hostRows } = await admin
          .from("hosts")
          .select("id, user_id, display_name")
          .in("id", newHostIds)
          .eq("is_active", true)
          .is("deleted_at", null);

        for (const h of hostRows ?? []) {
          if (!h.user_id || notifiedUserIds.has(h.user_id)) continue;
          await dispatchEvent({
            kind: "looking_for_new_post_region",
            recipientUserId: h.user_id,
            hostId: h.id,
            refs: {
              post_id: post.id,
              post_title: post.title ?? undefined,
              location_text: loc,
              hostFirstName: (h.display_name ?? "").split(" ")[0] || undefined,
              postTitle: post.title ?? undefined,
              locationText: loc,
              postId: post.id,
              checkIn,
              guests: guestsLabel,
              budget,
            },
          });
          notifiedUserIds.add(h.user_id);
          matched += 1;
        }
      }
    }

    return { matched };
  } catch (err) {
    console.error("[looking-for] alert match failed", err);
    return { matched: 0 };
  }
}
