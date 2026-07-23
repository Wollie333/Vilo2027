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

// The error a SUSPENDED account (user_profiles.is_active = false) gets on any
// host action. Suspension is the admin "blocked from all features" state — the
// dashboard/portal layouts wall the UI, and this is the SERVER-SIDE boundary so a
// scripted/crafted action call is rejected even though the wall never rendered.
export const ACCOUNT_SUSPENDED_ERROR =
  "Your account is suspended. Contact support to restore access.";

// The error an UNVERIFIED account (user_profiles.email_verified_at IS NULL) gets
// on any host action. A verified email is hard-required to operate (founder
// directive) — the dashboard/portal layouts wall the UI, and this is the
// SERVER-SIDE boundary so a scripted/crafted action call is rejected even though
// the wall never rendered.
export const EMAIL_NOT_VERIFIED_ERROR =
  "Please confirm your email before doing this. Check your inbox for the link.";

/**
 * Load the two account flags every host guard needs in a single query:
 * suspension and app-level email verification. Only a DEFINITIVE state counts —
 * a missing row / read hiccup must not lock a legitimate host out of their own
 * actions (so `suspended` needs `is_active === false`, and `emailVerified`
 * defaults to TRUE when the row can't be read).
 */
async function loadAccountFlags(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<{ suspended: boolean; emailVerified: boolean }> {
  const { data } = await supabase
    .from("user_profiles")
    .select("is_active, email_verified_at")
    .eq("id", userId)
    .maybeSingle();
  return {
    suspended: data?.is_active === false,
    // Fail OPEN on a missing/unreadable row: only a row we can read with a NULL
    // timestamp is treated as unverified, so a transient read error never walls
    // a real host mid-action.
    emailVerified: data ? data.email_verified_at != null : true,
  };
}

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
  const flags = await loadAccountFlags(supabase, user.id);
  if (flags.suspended) {
    return { ok: false, error: ACCOUNT_SUSPENDED_ERROR };
  }
  if (!flags.emailVerified) {
    return { ok: false, error: EMAIL_NOT_VERIFIED_ERROR };
  }
  const { data } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return { ok: false, error: "No host profile." };
  return { ok: true, hostId: data.id, userId: user.id };
}

/**
 * Assert the signed-in user is a FULL host — NOT a quotes-only account and NOT an
 * account an admin blocked (platform_access=false) — and return their host id.
 * This is the SERVER-SIDE access boundary for host-only Server Actions (listings,
 * bookings, calendar, website, …); the sidebar lock + route gate are only UX, so
 * a scoped/blocked account that scripts one of these actions is rejected here.
 * Quote surfaces (Looking-For / Quotes / Credits / Inbox / Guests / Settings)
 * keep calling the permissive requireHost() so a scoped account can use them.
 * Callers do `const h = await assertFullHost(); if (!h.ok) return h;`.
 */
export async function assertFullHost(): Promise<
  { ok: true; hostId: string; userId: string } | { ok: false; error: string }
> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const flags = await loadAccountFlags(supabase, user.id);
  if (flags.suspended) {
    return { ok: false, error: ACCOUNT_SUSPENDED_ERROR };
  }
  if (!flags.emailVerified) {
    return { ok: false, error: EMAIL_NOT_VERIFIED_ERROR };
  }
  const { data } = await supabase
    .from("hosts")
    .select("id, account_kind, quote_access, platform_access")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return { ok: false, error: "No host profile." };
  if (resolveAccountScope(data).quotesOnly) {
    return { ok: false, error: FULL_HOST_ONLY_ERROR };
  }
  return { ok: true, hostId: data.id, userId: user.id };
}
