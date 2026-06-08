import "server-only";

import { createServerClient } from "@/lib/supabase/server";

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
export async function requireHost(): Promise<
  { ok: true; hostId: string; userId: string } | { ok: false; error: string }
> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return { ok: false, error: "No host profile." };
  return { ok: true, hostId: data.id, userId: user.id };
}
