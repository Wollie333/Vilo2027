import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  BOARD_STATUSES,
  type AdminFeatureRequest,
  type BoardStatus,
  type BuildBoardData,
  type FeatureRequest,
} from "./buildBoard.shared";

// Re-export the shared constants/types so existing server imports of
// "@/lib/buildBoard" keep working. Client components must import from
// "@/lib/buildBoard.shared" instead (this module is server-only).
export * from "./buildBoard.shared";

// WS-3a — Build Board data access. The public board reads the denormalised
// vote tallies on feature_requests (RLS only returns published, non-merged
// rows); the signed-in viewer's own votes come from feature_request_votes.

/**
 * Resolve the caller's vote role. A user who owns a live host row votes as a
 * host (so host demand can be weighted separately); everyone else is a guest.
 */
export async function resolveVoterRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<"host" | "guest"> {
  const { data } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  return data ? "host" : "guest";
}

export async function loadBuildBoard(): Promise<BuildBoardData> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS returns only published, non-merged rows to the public. Sort newest-first
  // by votes; the page groups by status client-side.
  const { data: rows } = await supabase
    .from("feature_requests")
    .select(
      "id, title, body, status, vote_count, host_vote_count, guest_vote_count, submitter_role, shipped_at, created_at",
    )
    .eq("is_public", true)
    .is("merged_into_id", null)
    .order("vote_count", { ascending: false })
    .order("created_at", { ascending: false });

  const requests: FeatureRequest[] = (rows ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    status: r.status as BoardStatus,
    voteCount: r.vote_count ?? 0,
    hostVoteCount: r.host_vote_count ?? 0,
    guestVoteCount: r.guest_vote_count ?? 0,
    submitterRole: (r.submitter_role as "host" | "guest" | null) ?? null,
    shippedAt: r.shipped_at,
    createdAt: r.created_at,
  }));

  let votedIds: string[] = [];
  if (user) {
    const { data: votes } = await supabase
      .from("feature_request_votes")
      .select("request_id")
      .eq("user_id", user.id);
    votedIds = (votes ?? []).map((v) => v.request_id);
  }

  const counts = BOARD_STATUSES.reduce(
    (acc, s) => {
      acc[s] = requests.filter((r) => r.status === s).length;
      return acc;
    },
    {} as Record<BoardStatus, number>,
  );

  return { requests, votedIds, isAuthenticated: !!user, counts };
}

/**
 * Every request (pending, published, merged) for the moderation queue. Uses the
 * service-role client — call ONLY from the admin surface (behind requirePermission).
 */
export async function loadAdminFeatureRequests(): Promise<
  AdminFeatureRequest[]
> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("feature_requests")
    .select(
      "id, title, body, status, is_public, merged_into_id, submitted_by, submitter_role, vote_count, host_vote_count, guest_vote_count, admin_note, shipped_at, created_at",
    )
    .order("created_at", { ascending: false });

  const list = rows ?? [];

  // Resolve submitter emails in one lookup (nullable — seed/deleted have none).
  const submitterIds = Array.from(
    new Set(list.map((r) => r.submitted_by).filter((v): v is string => !!v)),
  );
  const emailById = new Map<string, string>();
  if (submitterIds.length > 0) {
    const { data: profiles } = await admin
      .from("user_profiles")
      .select("id, email")
      .in("id", submitterIds);
    for (const p of profiles ?? []) {
      if (p.email) emailById.set(p.id, p.email);
    }
  }

  return list.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    status: r.status as BoardStatus,
    voteCount: r.vote_count ?? 0,
    hostVoteCount: r.host_vote_count ?? 0,
    guestVoteCount: r.guest_vote_count ?? 0,
    submitterRole: (r.submitter_role as "host" | "guest" | null) ?? null,
    shippedAt: r.shipped_at,
    createdAt: r.created_at,
    isPublic: r.is_public ?? false,
    mergedIntoId: r.merged_into_id,
    submitterEmail: r.submitted_by
      ? (emailById.get(r.submitted_by) ?? null)
      : null,
    adminNote: r.admin_note,
  }));
}
