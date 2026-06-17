"use server";

import { revalidatePath } from "next/cache";

import { createServerClient } from "@/lib/supabase/server";

export type ToggleResult =
  | { ok: true; data: { iso: string; nowBlocked: boolean } }
  | { ok: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function assertListingOwnership(
  listingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to manage the calendar." };

  // RLS will already filter this; the explicit check produces a clean error.
  const { data: listing } = await supabase
    .from("properties")
    .select("id, host:hosts!inner ( user_id )")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return { ok: false, error: "Listing not found." };
  const ownerId = (listing as unknown as { host: { user_id: string } }).host
    .user_id;
  if (ownerId !== user.id) {
    return { ok: false, error: "Not your listing." };
  }
  return { ok: true };
}

// Toggle a manual block on a single date. Booking-derived blocks
// (booking_id IS NOT NULL) and quote holds (reason='quote_pending') are
// refused so the host can't accidentally undo the booking system's work.
export async function toggleBlockedDateAction(
  listingId: string,
  iso: string,
  roomId: string | null,
): Promise<ToggleResult> {
  if (!ISO_DATE.test(iso)) {
    return { ok: false, error: "Bad date." };
  }

  const own = await assertListingOwnership(listingId);
  if (!own.ok) return own;

  const supabase = createServerClient();

  // Find any existing row matching (listing, date, scope). The COALESCE-based
  // unique index means at most one row per (listing, room or whole, date).
  const baseQuery = supabase
    .from("blocked_dates")
    .select("id, reason, booking_id, room_id")
    .eq("property_id", listingId)
    .eq("date", iso);
  const { data: existing } =
    roomId == null
      ? await baseQuery.is("room_id", null).maybeSingle()
      : await baseQuery.eq("room_id", roomId).maybeSingle();

  if (existing) {
    if (existing.booking_id != null) {
      return {
        ok: false,
        error: "That date is booked — cancel the booking first to free it up.",
      };
    }
    if (existing.reason === "quote_pending") {
      return {
        ok: false,
        error:
          "That date is held by a pending quote — decline the quote first.",
      };
    }

    const { error } = await supabase
      .from("blocked_dates")
      .delete()
      .eq("id", existing.id);
    if (error) {
      return { ok: false, error: "Couldn't unblock the date. Try again." };
    }
    revalidatePath("/dashboard/calendar");
    return { ok: true, data: { iso, nowBlocked: false } };
  }

  // Insert a manual block. created_by = current user (the host).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("blocked_dates").insert({
    property_id: listingId,
    date: iso,
    room_id: roomId,
    reason: "manual",
    created_by: user!.id,
  });
  if (error) {
    return { ok: false, error: "Couldn't block the date. Try again." };
  }
  revalidatePath("/dashboard/calendar");
  return { ok: true, data: { iso, nowBlocked: true } };
}

export type BulkResult = { ok: true } | { ok: false; error: string };

// Drag-to-(un)block a range. Listing-wide manual blocks only. Booked /
// quote-held dates are left untouched so the booking system stays authoritative.
export async function setManualBlocksAction(
  listingId: string,
  isoList: string[],
  block: boolean,
): Promise<BulkResult> {
  const dates = Array.from(new Set(isoList)).filter((d) => ISO_DATE.test(d));
  if (dates.length === 0) return { ok: false, error: "No valid dates." };

  const own = await assertListingOwnership(listingId);
  if (!own.ok) return own;

  const supabase = createServerClient();

  // Existing rows for these dates (listing-wide scope only: room_id IS NULL).
  const { data: existing } = await supabase
    .from("blocked_dates")
    .select("id, date, reason, booking_id")
    .eq("property_id", listingId)
    .is("room_id", null)
    .in("date", dates);
  const byDate = new Map((existing ?? []).map((r) => [r.date as string, r]));

  if (block) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const toInsert = dates
      .filter((d) => !byDate.has(d))
      .map((d) => ({
        property_id: listingId,
        date: d,
        room_id: null,
        reason: "manual",
        created_by: user!.id,
      }));
    if (toInsert.length) {
      const { error } = await supabase.from("blocked_dates").insert(toInsert);
      if (error) return { ok: false, error: "Couldn't block those dates." };
    }
  } else {
    // Only remove manual, non-booking blocks.
    const removable = (existing ?? [])
      .filter((r) => r.booking_id == null && r.reason !== "quote_pending")
      .map((r) => r.id as string);
    if (removable.length) {
      const { error } = await supabase
        .from("blocked_dates")
        .delete()
        .in("id", removable);
      if (error) return { ok: false, error: "Couldn't unblock those dates." };
    }
  }

  revalidatePath("/dashboard/calendar");
  return { ok: true };
}
