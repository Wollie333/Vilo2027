"use server";

import { revalidatePath } from "next/cache";

import { createServerClient } from "@/lib/supabase/server";

import { couponInputSchema, type CouponInput } from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

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

// Pre-MVP: every feature is open on the free plan so the founder can smoke-test
// (AGENT_RULES.md §3.4). Restore the check_feature_permission RPC before Phase 3.
async function assertFeatureEnabled(): Promise<boolean> {
  return true;
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

// Date inputs are YYYY-MM-DD; store start at day-open and end at day-close UTC.
function toStart(d: string | null): string | null {
  return d ? `${d}T00:00:00Z` : null;
}
function toEnd(d: string | null): string | null {
  return d ? `${d}T23:59:59Z` : null;
}

async function validateTargets(
  v: CouponInput,
  hostId: string,
): Promise<ActionResult> {
  if (v.listing_id && !(await assertListingOwnership(v.listing_id, hostId))) {
    return { ok: false, error: "Not your listing." };
  }
  if (
    v.room_id &&
    v.listing_id &&
    !(await assertRoomBelongsToListing(v.room_id, v.listing_id))
  ) {
    return { ok: false, error: "That room doesn’t belong to this listing." };
  }
  return { ok: true };
}

function row(v: CouponInput, hostId: string) {
  return {
    host_id: hostId,
    code: v.code.trim().toUpperCase(),
    description: v.description ?? null,
    discount_type: v.discount_type,
    discount_value: v.discount_value,
    scope: v.scope,
    listing_id: v.listing_id,
    room_id: v.scope === "accommodation" ? v.room_id : null,
    min_nights: v.min_nights,
    min_spend: v.min_spend,
    starts_at: toStart(v.starts_at),
    ends_at: toEnd(v.ends_at),
    max_redemptions: v.max_redemptions,
    per_guest_limit: v.per_guest_limit,
    is_active: v.is_active,
  };
}

function isDuplicate(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "23505" || /duplicate|unique/i.test(error?.message ?? "")
  );
}

export async function createCouponAction(
  input: CouponInput,
): Promise<ActionResult<{ id: string }>> {
  const host = await getHost();
  if (!host.ok) return host;
  if (!(await assertFeatureEnabled())) {
    return { ok: false, error: "Coupons aren’t available on your plan." };
  }
  const parsed = couponInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Some fields look wrong.",
    };
  }
  const v = parsed.data;
  const targets = await validateTargets(v, host.hostId);
  if (!targets.ok) return targets;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("coupons")
    .insert(row(v, host.hostId))
    .select("id")
    .single();
  if (error || !data) {
    if (isDuplicate(error)) {
      return { ok: false, error: "You already have a coupon with that code." };
    }
    return { ok: false, error: "Could not create the coupon. Try again." };
  }
  revalidatePath("/dashboard/coupons");
  return { ok: true, data: { id: data.id } };
}

export async function updateCouponAction(
  couponId: string,
  input: CouponInput,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  const parsed = couponInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Some fields look wrong.",
    };
  }
  const v = parsed.data;
  const targets = await validateTargets(v, host.hostId);
  if (!targets.ok) return targets;

  const supabase = createServerClient();
  // host_id stays put; RLS host_manage_own_coupons enforces ownership.
  const { host_id: _host, ...patch } = row(v, host.hostId);
  void _host;
  const { error } = await supabase
    .from("coupons")
    .update(patch)
    .eq("id", couponId)
    .eq("host_id", host.hostId);
  if (error) {
    if (isDuplicate(error)) {
      return { ok: false, error: "You already have a coupon with that code." };
    }
    return { ok: false, error: "Could not save the coupon." };
  }
  revalidatePath("/dashboard/coupons");
  return { ok: true };
}

export async function toggleCouponActiveAction(
  couponId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  const supabase = createServerClient();
  const { error } = await supabase
    .from("coupons")
    .update({ is_active: isActive })
    .eq("id", couponId)
    .eq("host_id", host.hostId);
  if (error) return { ok: false, error: "Could not update the coupon." };
  revalidatePath("/dashboard/coupons");
  return { ok: true };
}

export async function deleteCouponAction(
  couponId: string,
): Promise<ActionResult> {
  const host = await getHost();
  if (!host.ok) return host;
  const supabase = createServerClient();
  const { error } = await supabase
    .from("coupons")
    .delete()
    .eq("id", couponId)
    .eq("host_id", host.hostId);
  if (error) return { ok: false, error: "Could not delete the coupon." };
  revalidatePath("/dashboard/coupons");
  return { ok: true };
}
