import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { resolveAccountScope } from "@/lib/host/accountScope";

// The error a quote-scoped account (account_kind='quote_only', or an admin
// platform_access=false block) gets when it hits a full-host-only mutation. The
// nav greys these surfaces and the page shows an upgrade lock, but this is the
// SERVER-SIDE boundary — a scripted/crafted action call is rejected here even
// though the client guard never ran.
export const FULL_HOST_ONLY_ERROR =
  "This is a full host account feature. Upgrade to a full host account to use it.";

/**
 * The `host_id` owned by the currently signed-in user, or null if they aren't a
 * host. Use this to scope EVERY host-dashboard read to the owner's own records.
 *
 * Why this is necessary even though RLS exists: the host-private tables also
 * carry `admin_full_*` / `staff_read_*` RLS policies, so a session with admin
 * or staff privileges would otherwise see *all* hosts' rows on the host
 * dashboard. That cross-account breadth belongs in /admin — never the host
 * dashboard. Filtering reads by this host_id makes the dashboard owner-only
 * regardless of the session's privileges.
 */
export async function getMyHostId(
  supabase: ReturnType<typeof createServerClient>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * The signed-in user's host id + user id, as a discriminated result — the single
 * source of truth for the "resolve my host before a mutation" guard that every
 * host Server Action needs. Self-contained (makes its own server client), so an
 * action just does `const h = await requireHost(); if (!h.ok) return h;`.
 *
 * Replaces the ~dozen per-file copies (getHost / getHostId / resolveHost /
 * currentHost / getMyHostId). Most files import it aliased to their old local
 * name so call sites are unchanged.
 */
export async function requireHost(opts?: {
  /**
   * Allow a quotes-only / platform-blocked account through. Pass `true` ONLY in
   * the quote surfaces a scoped account is entitled to (Looking-For, Quotes,
   * Credits, Inbox, Guests, Settings + shared profile/notifications). Every
   * other host-only mutation leaves it false so a scoped account is rejected
   * server-side — the real access boundary (the sidebar lock is only UX).
   */
  allowQuotesOnly?: boolean;
}): Promise<
  { ok: true; hostId: string; userId: string } | { ok: false; error: string }
> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data } = await supabase
    .from("hosts")
    .select("id, account_kind, quote_access, platform_access")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return { ok: false, error: "No host profile." };
  if (!opts?.allowQuotesOnly && resolveAccountScope(data).quotesOnly) {
    return { ok: false, error: FULL_HOST_ONLY_ERROR };
  }
  return { ok: true, hostId: data.id, userId: user.id };
}

/**
 * Assert the signed-in user is a FULL host (not a quotes-only / platform-blocked
 * account) and return their host id. The server-side access boundary for host-
 * only Server Actions that resolve the host by themselves (not via requireHost)
 * — e.g. createListingAction, createManualBookingAction, addIcalFeedAction.
 * Returns a discriminated result so callers do
 * `const h = await assertFullHost(); if (!h.ok) return h;`.
 */
export async function assertFullHost(): Promise<
  { ok: true; hostId: string; userId: string } | { ok: false; error: string }
> {
  return requireHost();
}
