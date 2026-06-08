"use server";

import { revalidatePath } from "next/cache";

import { requireHost as getHost } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";

import { seasonalRuleInputSchema, type SeasonalRuleInput } from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const PLAN_GATE_MSG = "Seasonal pricing isn't available on your plan.";

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
      adjustment_type: v.adjustment_type,
      adjustment_value: v.adjustment_value,
      // Legacy `price` mirror: the absolute nightly for absolute rules, null
      // for percent rules. The engine reads adjustment_type/value.
      price: v.adjustment_type === "absolute" ? v.adjustment_value : null,
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
      adjustment_type: v.adjustment_type,
      adjustment_value: v.adjustment_value,
      price: v.adjustment_type === "absolute" ? v.adjustment_value : null,
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

type CopiedRule = {
  id: string;
  listingId: string;
  roomId: string | null;
  label: string;
  startDate: string;
  endDate: string;
  adjustmentType: "absolute" | "percent";
  adjustmentValue: number;
  currency: string;
  minNights: number | null;
  priority: number;
  isActive: boolean;
};

/**
 * Copy every active listing-wide rule from one listing onto another. Room-
 * scoped rules are skipped — their room_id wouldn't exist on the target.
 * Returns the freshly-inserted rows so the client can merge them into state.
 */
export async function copySeasonalRulesToListingAction(
  fromListingId: string,
  toListingId: string,
): Promise<ActionResult<{ rules: CopiedRule[] }>> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertFeatureEnabled(host.hostId))) {
    return { ok: false, error: PLAN_GATE_MSG };
  }
  if (fromListingId === toListingId) {
    return { ok: false, error: "Pick a different listing to copy into." };
  }
  if (
    !(await assertListingOwnership(fromListingId, host.hostId)) ||
    !(await assertListingOwnership(toListingId, host.hostId))
  ) {
    return { ok: false, error: "Not your listing." };
  }

  const supabase = createServerClient();
  const { data: source } = await supabase
    .from("listing_seasonal_pricing")
    .select(
      "label, start_date, end_date, adjustment_type, adjustment_value, currency, min_nights, priority, is_active",
    )
    .eq("listing_id", fromListingId)
    .is("room_id", null);

  const rows = source ?? [];
  if (rows.length === 0) {
    return {
      ok: false,
      error: "This listing has no listing-wide seasons to copy.",
    };
  }

  const { data: inserted, error } = await supabase
    .from("listing_seasonal_pricing")
    .insert(
      rows.map((r) => ({
        listing_id: toListingId,
        room_id: null,
        label: r.label,
        start_date: r.start_date,
        end_date: r.end_date,
        adjustment_type: r.adjustment_type,
        adjustment_value: r.adjustment_value,
        price: r.adjustment_type === "absolute" ? r.adjustment_value : null,
        currency: r.currency,
        min_nights: r.min_nights,
        priority: r.priority,
        is_active: r.is_active,
      })),
    )
    .select(
      "id, listing_id, room_id, label, start_date, end_date, adjustment_type, adjustment_value, currency, min_nights, priority, is_active",
    );
  if (error || !inserted) {
    return { ok: false, error: "Could not copy seasons. Try again." };
  }

  revalidatePath("/dashboard/seasonal-pricing");
  return {
    ok: true,
    data: {
      rules: inserted.map((r) => ({
        id: r.id,
        listingId: r.listing_id,
        roomId: r.room_id,
        label: r.label,
        startDate: r.start_date,
        endDate: r.end_date,
        adjustmentType: (r.adjustment_type === "percent"
          ? "percent"
          : "absolute") as "absolute" | "percent",
        adjustmentValue: Number(r.adjustment_value),
        currency: r.currency,
        minNights: r.min_nights,
        priority: r.priority,
        isActive: r.is_active,
      })),
    },
  };
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
