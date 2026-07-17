import "server-only";

import type { createServerClient } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createServerClient>;

// Single source of truth for "which business owns this / does this business
// belong to me". Every document path, banking action and listing assignment
// resolves businesses through these helpers — never re-derive inline.
//
// Phase 2 introduces the resolver for the settings + banking layer; Phase 3
// extends it (getBusinessForBooking / getListingBusiness snapshots) when the
// financial documents switch their source to the listing's business.

export type BusinessRow = {
  id: string;
  host_id: string;
  legal_name: string | null;
  trading_name: string | null;
  vat_number: string | null;
  company_registration_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  logo_path: string | null;
  default_currency: string;
  default_language: string;
  is_default: boolean;
  is_archived: boolean;
};

/** The host's default (non-archived) business id, or null if none exists yet. */
export async function getDefaultBusinessId(
  supabase: Supabase,
  hostId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("businesses")
    .select("id")
    .eq("host_id", hostId)
    .eq("is_default", true)
    .eq("is_archived", false)
    .maybeSingle();
  return data?.id ?? null;
}

/** True when `businessId` exists and belongs to `hostId`. */
export async function assertBusinessOwnership(
  supabase: Supabase,
  businessId: string,
  hostId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("host_id", hostId)
    .maybeSingle();
  return !!data;
}
