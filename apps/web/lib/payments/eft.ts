import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The single source of truth for "this host has a valid EFT bank account".
 *
 * Valid = a default, non-archived row in eft_banking_details. This is the
 * baseline every host must have, because EFT is the guaranteed payment
 * fallback (AGENT_RULES.md §4.6) and a listing cannot go live without it
 * (§4.5). Used by the listing-publish gate and the checkout gateway-failure
 * fallback; the DB trigger `trg_listing_requires_bank` enforces the same
 * predicate at the database layer.
 *
 * Uses the service-role client: it's a boolean existence check (no data
 * exposure) and callers include guest-context paths that can't RLS-read a
 * host's banking.
 */
export async function hostHasValidEft(hostId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("eft_banking_details")
    .select("id")
    .eq("host_id", hostId)
    .eq("is_default", true)
    .eq("is_archived", false)
    .limit(1)
    .maybeSingle();
  return !!data;
}
