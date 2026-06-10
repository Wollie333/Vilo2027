import "server-only";

import { createServerClient } from "@/lib/supabase/server";

export interface HostSavingsRaw {
  direct_revenue: number;
  booking_count: number;
  first_booking_date: string | null;
  currency: string;
  by_month: { month: string; revenue: number }[];
}

export interface HostSavings extends HostSavingsRaw {
  hostId: string;
}

/**
 * Resolves the signed-in user's host and returns their direct-booking savings
 * base (revenue, count, monthly trend) via the fetch_host_savings RPC. Returns
 * null when the user isn't a host or has no data.
 *
 * The OTA-rate maths lives in ota-competitors.ts#computeSavings — keep it out
 * of here so there's exactly one place that turns revenue into a saving.
 */
export async function getHostSavings(): Promise<HostSavings | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!host) return null;

  const { data, error } = await supabase.rpc("fetch_host_savings", {
    p_host_id: host.id,
  });
  if (error || !data) return null;

  const raw = data as unknown as HostSavingsRaw;
  return { hostId: host.id, ...raw };
}
