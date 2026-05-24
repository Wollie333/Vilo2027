"use server";

import { revalidatePath } from "next/cache";

import { createServerClient } from "@/lib/supabase/server";

import { seasonalRuleInputSchema, type SeasonalRuleInput } from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const PLAN_GATE_MSG = "Seasonal pricing isn't available on your plan.";

async function getHost(): Promise<
  { ok: true; hostId: string } | { ok: false; error: string }
> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) return { ok: false, error: "No host profile." };
  return { ok: true, hostId: host.id };
}

async function assertFeatureEnabled(hostId: string): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase.rpc("check_feature_permission", {
    p_host_id: hostId,
    p_feature_key: "seasonal_pricing",
  });
  const result = data as { is_enabled: boolean } | null;
  return result?.is_enabled ?? false;
}

async function assertListingOwnership(
  listingId: string,
  hostId: string,
): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("host_id", hostId)
    .maybeSingle();
  return !!data;
}

async function assertRoomBelongsToListing(
  roomId: string,
  listingId: string,
): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("listing_rooms")
    .select("id")
    .eq("id", roomId)
    .eq("listing_id", listingId)
    .maybeSingle();
  return !!data;
}

async function assertRuleOwnership(
  ruleId: string,
  hostId: string,
): Promise<{ ok: true; listingId: string } | { ok: false }> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("listing_seasonal_pricing")
    .select("listing_id, listings!inner(host_id)")
    .eq("id", ruleId)
    .maybeSingle();
  const row = data as {
    listing_id: string;
    listings: { host_id: string } | null;
  } | null;
  if (!row?.listings || row.listings.host_id !== hostId) return { ok: false };
  return { ok: true, listingId: row.listing_id };
}

export async function createSeasonalRuleAction(
  input: SeasonalRuleInput,
): Promise<ActionResult<{ id: string }>> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertFeatureEnabled(host.hostId))) {
    return { ok: false, error: PLAN_GATE_MSG };
  }

  const parsed = seasonalRuleInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }
  const v = parsed.data;

  if (!(await assertListingOwnership(v.listing_id, host.hostId))) {
    return { ok: false, error: "Not your listing." };
  }
  if (
    v.room_id &&
    !(await assertRoomBelongsToListing(v.room_id, v.listing_id))
  ) {
    return { ok: false, error: "That room doesn't belong to this listing." };
  }

  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("listing_seasonal_pricing")
    .insert({
      listing_id: v.listing_id,
      room_id: v.room_id,
      label: v.label,
      start_date: v.start_date,
      end_date: v.end_date,
      price: v.price,
      currency: v.currency,
      min_nights: v.min_nights,
      priority: v.priority,
      is_active: v.is_active,
    })
    .select("id")
    .single();
  if (error || !row) {
    return { ok: false, error: "Could not create rule. Try again." };
  }

  revalidatePath("/dashboard/seasonal-pricing");
  return { ok: true, data: { id: row.id } };
}

export async function updateSeasonalRuleAction(
  ruleId: string,
  input: SeasonalRuleInput,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertFeatureEnabled(host.hostId))) {
    return { ok: false, error: PLAN_GATE_MSG };
  }

  const owned = await assertRuleOwnership(ruleId, host.hostId);
  if (!owned.ok) return { ok: false, error: "Not your rule." };

  const parsed = seasonalRuleInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }
  const v = parsed.data;

  if (v.listing_id !== owned.listingId) {
    return { ok: false, error: "Rule can't move to another listing." };
  }
  if (
    v.room_id &&
    !(await assertRoomBelongsToListing(v.room_id, v.listing_id))
  ) {
    return { ok: false, error: "That room doesn't belong to this listing." };
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("listing_seasonal_pricing")
    .update({
      room_id: v.room_id,
      label: v.label,
      start_date: v.start_date,
      end_date: v.end_date,
      price: v.price,
      currency: v.currency,
      min_nights: v.min_nights,
      priority: v.priority,
      is_active: v.is_active,
    })
    .eq("id", ruleId);
  if (error) {
    return { ok: false, error: "Could not save rule." };
  }

  revalidatePath("/dashboard/seasonal-pricing");
  return { ok: true };
}

export async function deleteSeasonalRuleAction(
  ruleId: string,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  const owned = await assertRuleOwnership(ruleId, host.hostId);
  if (!owned.ok) return { ok: false, error: "Not your rule." };

  const supabase = createServerClient();
  const { error } = await supabase
    .from("listing_seasonal_pricing")
    .delete()
    .eq("id", ruleId);
  if (error) return { ok: false, error: "Could not delete rule." };

  revalidatePath("/dashboard/seasonal-pricing");
  return { ok: true };
}

export async function toggleSeasonalRuleActiveAction(
  ruleId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  const owned = await assertRuleOwnership(ruleId, host.hostId);
  if (!owned.ok) return { ok: false, error: "Not your rule." };

  const supabase = createServerClient();
  const { error } = await supabase
    .from("listing_seasonal_pricing")
    .update({ is_active: isActive })
    .eq("id", ruleId);
  if (error) return { ok: false, error: "Could not update rule." };

  revalidatePath("/dashboard/seasonal-pricing");
  return { ok: true };
}
