"use server";

import { revalidatePath } from "next/cache";

import { createServerClient } from "@/lib/supabase/server";

import {
  bookingModeSchema,
  patchSchema,
  roomPatchSchema,
  type BookingModeInput,
  type PatchInput,
  type RoomPatch,
} from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function assertOwnership(
  listingId: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: listing } = await supabase
    .from("listings")
    .select("id, host:hosts!inner ( user_id )")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing) return { ok: false, error: "Listing not found." };

  // The join filters by RLS too (host_manage_own_listings), so a non-owner
  // would already have gotten null. Belt-and-braces.
  const ownerId = (listing as unknown as { host: { user_id: string } }).host
    .user_id;
  if (ownerId !== user.id) {
    return { ok: false, error: "Not your listing." };
  }
  return { ok: true, userId: user.id };
}

export async function saveListingPatchAction(
  listingId: string,
  input: PatchInput,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const parsed = patchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Some fields look wrong. Check the form." };
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("listings")
    .update(parsed.data)
    .eq("id", listingId);
  if (error) {
    return { ok: false, error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export type AmenityRow = {
  id: string;
  key: string;
  label: string | null;
  roomId: string | null;
};

export async function replaceAmenitiesAction(
  listingId: string,
  amenityKeys: string[],
): Promise<ActionResult<AmenityRow[]>> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const supabase = createServerClient();

  // Preserve per-amenity room assignments across re-saves by snapshotting
  // the existing key → room_id map before wiping.
  const { data: existing } = await supabase
    .from("listing_amenities")
    .select("amenity_key, room_id")
    .eq("listing_id", listingId);
  const roomByKey = new Map<string, string | null>(
    (existing ?? []).map((r) => [r.amenity_key, r.room_id ?? null]),
  );

  const { error: delErr } = await supabase
    .from("listing_amenities")
    .delete()
    .eq("listing_id", listingId);
  if (delErr) {
    return { ok: false, error: "Could not update amenities." };
  }

  if (amenityKeys.length > 0) {
    const rows = amenityKeys.map((key) => ({
      listing_id: listingId,
      amenity_key: key,
      room_id: roomByKey.get(key) ?? null,
    }));
    const { error: insErr } = await supabase
      .from("listing_amenities")
      .insert(rows);
    if (insErr) {
      return { ok: false, error: "Could not save amenities." };
    }
  }

  const { data: fresh } = await supabase
    .from("listing_amenities")
    .select("id, amenity_key, amenity_label, room_id")
    .eq("listing_id", listingId);

  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  return {
    ok: true,
    data: (fresh ?? []).map((r) => ({
      id: r.id,
      key: r.amenity_key,
      label: r.amenity_label ?? null,
      roomId: r.room_id ?? null,
    })),
  };
}

export async function uploadListingPhotoAction(
  listingId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string; url: string }>> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file selected." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "Photo must be under 8 MB." };
  }
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG or WebP image." };
  }

  const supabase = createServerClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const storagePath = `${listingId}/${filename}`;

  const { error: upErr } = await supabase.storage
    .from("listing-photos")
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
  if (upErr) {
    return { ok: false, error: "Upload failed. Try a smaller file." };
  }

  const { data: publicUrl } = supabase.storage
    .from("listing-photos")
    .getPublicUrl(storagePath);

  // Determine next sort_order.
  const { count } = await supabase
    .from("listing_photos")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);

  const { data: row, error: rowErr } = await supabase
    .from("listing_photos")
    .insert({
      listing_id: listingId,
      storage_path: storagePath,
      url: publicUrl.publicUrl,
      sort_order: count ?? 0,
    })
    .select("id, url")
    .single();
  if (rowErr || !row) {
    // Cleanup the storage object so we don't leave orphans.
    await supabase.storage.from("listing-photos").remove([storagePath]);
    return { ok: false, error: "Upload saved but record failed." };
  }

  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  return { ok: true, data: { id: row.id, url: row.url } };
}

export async function deleteListingPhotoAction(
  listingId: string,
  photoId: string,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { data: photo, error: fetchErr } = await supabase
    .from("listing_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("listing_id", listingId)
    .maybeSingle();
  if (fetchErr || !photo) {
    return { ok: false, error: "Photo not found." };
  }

  const { error: delRowErr } = await supabase
    .from("listing_photos")
    .delete()
    .eq("id", photoId);
  if (delRowErr) {
    return { ok: false, error: "Could not remove photo." };
  }

  await supabase.storage.from("listing-photos").remove([photo.storage_path]);

  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  return { ok: true };
}

export async function softDeleteListingAction(
  listingId: string,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const supabase = createServerClient();

  // Block deletion when there are active bookings — soft-deleting a listing
  // with future stays would orphan paid bookings. Per AGENT_RULES.md §2.1
  // we never hard-delete, only set deleted_at.
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId)
    .in("status", ["pending", "pending_eft", "confirmed", "checked_in"]);

  if (count && count > 0) {
    return {
      ok: false,
      error: `Can't delete — ${count} active booking${
        count === 1 ? "" : "s"
      } first need to be cancelled or completed.`,
    };
  }

  const { error } = await supabase
    .from("listings")
    .update({
      deleted_at: new Date().toISOString(),
      is_published: false,
    })
    .eq("id", listingId);
  if (error) {
    return { ok: false, error: "Could not delete listing. Try again." };
  }

  revalidatePath("/dashboard/listings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function togglePublishAction(
  listingId: string,
  publish: boolean,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const supabase = createServerClient();

  if (publish) {
    // Light pre-publish check — minimum fields needed to be bookable.
    const { data: listing } = await supabase
      .from("listings")
      .select("name, base_price, max_guests")
      .eq("id", listingId)
      .single();
    if (!listing) return { ok: false, error: "Listing not found." };
    if (
      !listing.name ||
      listing.base_price == null ||
      listing.max_guests == null
    ) {
      return {
        ok: false,
        error: "Add a name, base price, and max guests before publishing.",
      };
    }
  }

  const { error } = await supabase
    .from("listings")
    .update({ is_published: publish })
    .eq("id", listingId);
  if (error) {
    return { ok: false, error: "Could not update publish status." };
  }

  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  revalidatePath("/dashboard");
  return { ok: true };
}

// ─── Booking mode + rooms ────────────────────────────────────────

export async function setBookingModeAction(
  listingId: string,
  input: BookingModeInput,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const parsed = bookingModeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Pick a valid booking mode." };
  }

  const supabase = createServerClient();

  // Switching to anything that needs rooms requires at least one room.
  if (parsed.data.booking_mode !== "whole_listing") {
    const { count } = await supabase
      .from("listing_rooms")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId)
      .is("deleted_at", null);
    if (!count || count === 0) {
      return {
        ok: false,
        error:
          "Add at least one room before switching to a per-room booking mode.",
      };
    }
  }

  const { error } = await supabase
    .from("listings")
    .update({ booking_mode: parsed.data.booking_mode })
    .eq("id", listingId);
  if (error) {
    return { ok: false, error: "Could not change booking mode." };
  }

  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  revalidatePath("/dashboard/listings");
  return { ok: true };
}

export async function createRoomAction(
  listingId: string,
  input: RoomPatch,
): Promise<ActionResult<{ id: string }>> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const parsed = roomPatchSchema.safeParse(input);
  if (!parsed.success || !parsed.data.name) {
    return { ok: false, error: "Room needs at least a name." };
  }
  if (parsed.data.base_price == null) {
    return { ok: false, error: "Room needs a base price." };
  }
  if (parsed.data.max_guests == null) {
    return { ok: false, error: "Room needs a max guest count." };
  }

  const supabase = createServerClient();

  // Sort_order = current max + 1 so new rooms append to the bottom.
  const { data: existing } = await supabase
    .from("listing_rooms")
    .select("sort_order")
    .eq("listing_id", listingId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (existing?.sort_order ?? -1) + 1;

  const { data: room, error } = await supabase
    .from("listing_rooms")
    .insert({
      listing_id: listingId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      bedrooms: parsed.data.bedrooms ?? 1,
      bathrooms: parsed.data.bathrooms ?? 0,
      max_guests: parsed.data.max_guests,
      base_price: parsed.data.base_price,
      weekend_price: parsed.data.weekend_price ?? null,
      cleaning_fee: parsed.data.cleaning_fee ?? 0,
      is_active: parsed.data.is_active ?? true,
      sort_order: nextSort,
    })
    .select("id")
    .single();
  if (error || !room) {
    return { ok: false, error: "Could not create room. Try again." };
  }

  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  return { ok: true, data: { id: room.id } };
}

export async function updateRoomAction(
  listingId: string,
  roomId: string,
  input: RoomPatch,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const parsed = roomPatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Some room fields look wrong." };
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("listing_rooms")
    .update(parsed.data)
    .eq("id", roomId)
    .eq("listing_id", listingId);
  if (error) {
    return { ok: false, error: "Could not save room." };
  }

  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  return { ok: true };
}

export async function deleteRoomAction(
  listingId: string,
  roomId: string,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const supabase = createServerClient();

  // Refuse if any active booking_rooms point at this room.
  const { count } = await supabase
    .from("booking_rooms")
    .select("id, booking:bookings!inner ( status )", {
      count: "exact",
      head: true,
    })
    .eq("room_id", roomId)
    .in("booking.status", [
      "pending",
      "pending_eft",
      "confirmed",
      "checked_in",
    ]);

  if (count && count > 0) {
    return {
      ok: false,
      error: `Can't delete — ${count} active booking${
        count === 1 ? "" : "s"
      } still references this room.`,
    };
  }

  const { error } = await supabase
    .from("listing_rooms")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", roomId)
    .eq("listing_id", listingId);
  if (error) {
    return { ok: false, error: "Could not delete room." };
  }

  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  return { ok: true };
}

export async function assignPhotoToRoomAction(
  listingId: string,
  photoId: string,
  roomId: string | null,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { error } = await supabase
    .from("listing_photos")
    .update({ room_id: roomId })
    .eq("id", photoId)
    .eq("listing_id", listingId);
  if (error) {
    return { ok: false, error: "Could not assign photo." };
  }
  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  return { ok: true };
}

export async function assignAmenityToRoomAction(
  listingId: string,
  amenityId: string,
  roomId: string | null,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { error } = await supabase
    .from("listing_amenities")
    .update({ room_id: roomId })
    .eq("id", amenityId)
    .eq("listing_id", listingId);
  if (error) {
    return { ok: false, error: "Could not assign amenity." };
  }
  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  return { ok: true };
}
