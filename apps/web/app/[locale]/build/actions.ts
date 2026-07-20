"use server";

import { revalidatePath } from "next/cache";

import { notifyAdmins } from "@/lib/admin/notify";
import { resolveVoterRole } from "@/lib/buildBoard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// ─── Vote toggle ─────────────────────────────────────────────────
// Signed-in only. Casts a role-tagged vote or retracts it. The denormalised
// tallies on feature_requests are kept in sync by the DB trigger.

export async function toggleFeatureVoteAction(
  requestId: string,
): Promise<ActionResult<{ voted: boolean }>> {
  if (!requestId || typeof requestId !== "string") {
    return { ok: false, error: "Missing request." };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in to vote." };
  }

  // Only vote on a published, non-merged item (RLS on read enforces this too).
  const { data: request } = await supabase
    .from("feature_requests")
    .select("id")
    .eq("id", requestId)
    .eq("is_public", true)
    .is("merged_into_id", null)
    .maybeSingle();
  if (!request) {
    return { ok: false, error: "That request is no longer open for votes." };
  }

  const { data: existing } = await supabase
    .from("feature_request_votes")
    .select("request_id")
    .eq("request_id", requestId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("feature_request_votes")
      .delete()
      .eq("request_id", requestId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: "Could not remove your vote." };
    revalidatePath("/build");
    return { ok: true, data: { voted: false } };
  }

  const voterRole = await resolveVoterRole(supabase, user.id);
  const { error } = await supabase.from("feature_request_votes").insert({
    request_id: requestId,
    user_id: user.id,
    voter_role: voterRole,
  });
  if (error) return { ok: false, error: "Could not record your vote." };
  revalidatePath("/build");
  return { ok: true, data: { voted: true } };
}

// ─── Submit a new request ────────────────────────────────────────
// Signed-in only. Lands unpublished (is_public=false) for a moderation pass;
// an admin approves it onto the public board. Notifies staff (7-day SLA).

export async function submitFeatureRequestAction(input: {
  title: string;
  body?: string;
}): Promise<ActionResult<{ id: string }>> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in to suggest a feature." };
  }

  const title = (input.title ?? "").trim();
  const body = (input.body ?? "").trim();
  if (title.length < 3) {
    return { ok: false, error: "Give your idea a short title (3+ characters)." };
  }
  if (title.length > 140) {
    return { ok: false, error: "Keep the title under 140 characters." };
  }
  if (body.length > 2000) {
    return { ok: false, error: "Keep the description under 2000 characters." };
  }

  const submitterRole = await resolveVoterRole(supabase, user.id);

  const { data: created, error } = await supabase
    .from("feature_requests")
    .insert({
      title,
      body: body.length > 0 ? body : null,
      submitted_by: user.id,
      submitter_role: submitterRole,
      is_public: false,
      status: "under_review",
    })
    .select("id")
    .single();
  if (error || !created) {
    return { ok: false, error: "Could not submit your idea. Try again." };
  }

  // Surface it to staff for the moderation pass (best-effort).
  await notifyAdmins(createAdminClient(), {
    category: "support",
    kind: "feature_request",
    title: "New Build Board suggestion",
    body: `${submitterRole === "host" ? "A host" : "A guest"} suggested: "${title}"`,
    userId: user.id,
    href: "/admin/build-board",
  });

  return { ok: true, data: { id: created.id } };
}
