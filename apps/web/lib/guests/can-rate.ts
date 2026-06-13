import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// A host may rate a guest only after a stay that actually happened. "completed"
// is the normal case; "no_show" is included because a no-show is high-value
// signal for other hosts. Shared by the page (to enable the button) and the
// action (to enforce on write) so the rule lives in exactly one place.
const ELIGIBLE_STATUSES = ["completed", "no_show"] as const;

export async function hostCanRateGuest(
  supabase: SupabaseClient,
  hostId: string,
  guestId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("host_id", hostId)
    .eq("guest_id", guestId)
    .is("deleted_at", null)
    .in("status", ELIGIBLE_STATUSES as unknown as string[]);
  return (count ?? 0) > 0;
}
