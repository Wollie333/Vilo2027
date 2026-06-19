"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export type ToggleResult =
  | { ok: true; data: { iso: string; nowBlocked: boolean } }
  | { ok: false; error: string };

export type UnblockSpecialResult =
  | { ok: true; specialPaused: boolean }
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
// (booking_id IS NOT NULL), quote holds (reason='quote_pending'), and
// special-created blocks are refused so the host can't accidentally undo
// the booking system's or deal's work.
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
    .select("id, reason, booking_id, room_id, special_id")
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
    if (existing.special_id != null || existing.reason === "special") {
      return {
        ok: false,
        error: "SPECIAL_BLOCK:" + (existing.special_id ?? ""),
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

export type BulkResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; error: string; specialId: string };

// Drag-to-(un)block a range. Booked / quote-held / special-blocked dates
// are left untouched so the booking system and deal logic stays authoritative.
export async function setManualBlocksAction(
  listingId: string,
  isoList: string[],
  block: boolean,
): Promise<BulkResult> {
  try {
    if (!listingId) return { ok: false, error: "Missing listing ID." };

    const dates = Array.from(new Set(isoList)).filter((d) => ISO_DATE.test(d));
    if (dates.length === 0) return { ok: false, error: "No valid dates." };

    const own = await assertListingOwnership(listingId);
    if (!own.ok) return own;

    const supabase = createServerClient();

    // Query ALL blocked_dates for these dates (any room scope).
    const { data: existing } = await supabase
      .from("blocked_dates")
      .select("id, date, reason, booking_id, special_id, room_id")
      .eq("property_id", listingId)
      .in("date", dates);

    if (block) {
      // When blocking, only insert for dates that have no block at all
      const blockedDates = new Set(
        (existing ?? []).map((r) => r.date as string),
      );
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const toInsert = dates
        .filter((d) => !blockedDates.has(d))
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
      // Check if any dates are tied to a special — those need special handling
      const specialBlock = (existing ?? []).find(
        (r) => r.special_id != null || r.reason === "special",
      );
      if (specialBlock) {
        return {
          ok: false,
          error:
            "These dates are tied to a deal. Unblocking will pause the deal.",
          specialId: (specialBlock.special_id as string) ?? "",
        };
      }

      // Only remove manual, non-booking, non-special blocks.
      const removable = (existing ?? [])
        .filter(
          (r) =>
            r.booking_id == null &&
            r.reason !== "quote_pending" &&
            r.special_id == null &&
            r.reason !== "special",
        )
        .map((r) => r.id as string);

      if (removable.length) {
        const { error } = await supabase
          .from("blocked_dates")
          .delete()
          .in("id", removable);
        if (error) return { ok: false, error: "Couldn't unblock those dates." };
      } else if ((existing ?? []).length > 0) {
        // Blocks exist but none are removable (all are bookings/quotes)
        return {
          ok: false,
          error: "Those dates are booked or on hold — can't unblock.",
        };
      }
    }

    revalidatePath("/dashboard/calendar");
    return { ok: true };
  } catch (err) {
    console.error("[setManualBlocksAction] Error:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * Unblock dates tied to a special and pause that special.
 * This is called when the host confirms they want to release deal dates,
 * which hides the deal from public view.
 */
export async function unblockSpecialDatesAction(
  specialId: string,
): Promise<UnblockSpecialResult> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to manage the calendar." };

  // Verify the host owns this special
  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!host) return { ok: false, error: "Host not found." };

  const { data: special } = await supabase
    .from("specials")
    .select("id, status")
    .eq("id", specialId)
    .eq("host_id", host.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!special) return { ok: false, error: "Deal not found." };

  // Use admin client to call the release function and pause the special
  const admin = createAdminClient();

  // Release the blocked dates
  await admin.rpc("release_special_dates", { p_special_id: specialId });

  // Pause the special so it's hidden from public
  const wasActive = special.status === "active";
  if (wasActive) {
    const { error } = await admin
      .from("specials")
      .update({ status: "paused" })
      .eq("id", specialId);
    if (error) {
      return {
        ok: false,
        error: "Released dates but couldn't pause the deal.",
      };
    }
  }

  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/specials");
  return { ok: true, specialPaused: wasActive };
}
