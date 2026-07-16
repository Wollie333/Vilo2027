import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Post views — the ONE place that records "a host looked at this request".
//
// `looking_for_posts.view_count` means "Seen by X hosts" (spec G3): DISTINCT
// hosts who loaded a request's detail view. It is a denormalisation, never
// written directly — a trigger recomputes it as COUNT(*) over
// looking_for_post_views, whose UNIQUE(post_id, host_id) is what makes the count
// mean "distinct hosts" at all. So this insert is idempotent by construction: a
// re-render, a refresh, a back-button or a route prefetch cannot inflate the
// number, which is why it is safe to call during a server render.
//
// Detail view = the respond page and the public post page. The board is a LIST —
// scrolling past a card is not "seen", and counting impressions would inflate
// the guest's traction signal into noise.
//
// Do NOT write view_count from application code. The public post page used to
// (`update({view_count: view_count + 1})`) and it was wrong three ways at once:
// see 20260716290000 for the full autopsy.
// ---------------------------------------------------------------------------

export type RecordPostViewInput = {
  postId: string;
  /** The viewing host. RLS refuses a host_id that is not the caller's own. */
  hostId: string;
  /** The post owner's user id — a host viewing their OWN request must not count. */
  guestUserId: string | null | undefined;
  /** The signed-in viewer's user id (the owner of `hostId`). */
  viewerUserId: string;
};

/**
 * Record that a host opened a request's detail view.
 *
 * Fire-and-forget by design: a view is telemetry, so a failure here must never
 * break the page the host came to read. The upsert is the whole implementation —
 * the trigger does the counting.
 */
export async function recordPostView(
  client: SupabaseClient,
  { postId, hostId, guestUserId, viewerUserId }: RecordPostViewInput,
): Promise<void> {
  // A host is also a guest, so they can post their own request and then open it.
  // `unlockLead` already refuses this case before charging a credit; the count
  // has to agree, or "seen by 1 host" would mean "seen by nobody but me".
  if (guestUserId && guestUserId === viewerUserId) return;

  await client
    .from("looking_for_post_views")
    .upsert(
      { post_id: postId, host_id: hostId },
      { onConflict: "post_id,host_id", ignoreDuplicates: true },
    );
}
