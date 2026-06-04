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
