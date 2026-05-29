"use server";

import { revalidatePath } from "next/cache";

import { sanitiseListingHtml } from "@/lib/sanitiseHtml";
import { createServerClient } from "@/lib/supabase/server";

import { z } from "zod";

import {
  bedInputSchema,
  bedKindLabel,
  bookingModeSchema,
  patchSchema,
  roomPatchSchema,
  type BedInput,
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

  // description is rich-text HTML from the editor — sanitise on the way in so
  // the DB never holds anything the render-time sanitiser would have to strip.
  const patch =
    parsed.data.description != null
      ? {
          ...parsed.data,
          description: sanitiseListingHtml(parsed.data.description),
        }
      : parsed.data;

  const supabase = createServerClient();
  const { error } = await supabase
    .from("listings")
    .update(patch)
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

  // Optional room scoping — if present, photo lands assigned to that room.
  const roomIdRaw = formData.get("room_id");
  const roomId =
    typeof roomIdRaw === "string" && roomIdRaw.length > 0 ? roomIdRaw : null;

  const supabase = createServerClient();

  if (roomId) {
    const { data: room } = await supabase
      .from("listing_rooms")
      .select("id")
      .eq("id", roomId)
      .eq("listing_id", listingId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!room) {
      return { ok: false, error: "Room not found on this listing." };
    }
  }

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
      room_id: roomId,
    })
    .select("id, url")
    .single();
  if (rowErr || !row) {
    // Cleanup the storage object so we don't leave orphans.
    await supabase.storage.from("listing-photos").remove([storagePath]);
    return { ok: false, error: "Upload saved but record failed." };
  }

  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  if (roomId) {
    revalidatePath(`/dashboard/listings/${listingId}/edit/rooms/${roomId}`);
  }
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

// Reorder listing-wide photos. The client passes the photo IDs in the new
// display order; we write sort_order = index to match. Used by the drag-and-
// drop reorder in PhotosTab — the first photo becomes the listing cover.
export async function reorderListingPhotosAction(
  listingId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { ok: false, error: "Nothing to reorder." };
  }
  if (orderedIds.some((id) => typeof id !== "string" || id.length === 0)) {
    return { ok: false, error: "Bad photo id list." };
  }

  const supabase = createServerClient();
  // Parallel updates — sort_order is independent per row, no FK churn, the
  // listing_id eq narrows to this listing so cross-listing writes are blocked
  // by RLS even if the IDs were forged.
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("listing_photos")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("listing_id", listingId),
    ),
  );
  if (results.some((r) => r.error)) {
    return { ok: false, error: "Some photos didn't reorder. Try again." };
  }

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

  // Booking mode is independent of room existence. A listing in per-room or
  // flexible mode with zero rooms is simply not bookable as rooms until the
  // host adds one — a soft constraint the host resolves organically.
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

export type RoomEditorData = {
  room: {
    id: string;
    name: string;
    description: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    max_guests: number;
    base_price: number;
    weekend_price: number | null;
    cleaning_fee: number;
    is_active: boolean;
    room_size_sqm: number | null;
    bed_type: string | null;
    view_type: string | null;
    experiences: string[];
    featured_photo_id: string | null;
  };
  photos: { id: string; url: string }[];
  amenityKeys: string[];
};

// Full room payload for the wizard's room sheet (mirrors the room edit page
// fetch) so an existing room opens with all its details, photos and amenities.
export async function fetchRoomEditorDataAction(
  listingId: string,
  roomId: string,
): Promise<ActionResult<RoomEditorData>> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { data: room } = await supabase
    .from("listing_rooms")
    .select(
      "id, name, description, bedrooms, bathrooms, max_guests, base_price, weekend_price, cleaning_fee, is_active, room_size_sqm, bed_type, view_type, experiences, featured_photo_id",
    )
    .eq("id", roomId)
    .eq("listing_id", listingId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!room) return { ok: false, error: "Room not found." };

  const [{ data: photoRows }, { data: amenityRows }] = await Promise.all([
    supabase
      .from("listing_photos")
      .select("id, url, sort_order")
      .eq("listing_id", listingId)
      .eq("room_id", roomId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("listing_amenities")
      .select("amenity_key")
      .eq("listing_id", listingId)
      .eq("room_id", roomId),
  ]);

  return {
    ok: true,
    data: {
      room: {
        id: room.id,
        name: room.name,
        description: room.description ?? null,
        bedrooms: room.bedrooms,
        bathrooms: room.bathrooms,
        max_guests: room.max_guests,
        base_price: Number(room.base_price),
        weekend_price:
          room.weekend_price != null ? Number(room.weekend_price) : null,
        cleaning_fee: Number(room.cleaning_fee ?? 0),
        is_active: room.is_active,
        room_size_sqm:
          room.room_size_sqm != null ? Number(room.room_size_sqm) : null,
        bed_type: room.bed_type ?? null,
        view_type: room.view_type ?? null,
        experiences: (room.experiences as string[] | null) ?? [],
        featured_photo_id: room.featured_photo_id ?? null,
      },
      photos: (photoRows ?? []).map((p) => ({ id: p.id, url: p.url })),
      amenityKeys: (amenityRows ?? []).map((a) => a.amenity_key),
    },
  };
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

// ─── Per-room drill-in actions ───────────────────────────────────

export async function setRoomFeaturedPhotoAction(
  listingId: string,
  roomId: string,
  photoId: string | null,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const supabase = createServerClient();

  if (photoId) {
    const { data: photo } = await supabase
      .from("listing_photos")
      .select("id")
      .eq("id", photoId)
      .eq("listing_id", listingId)
      .eq("room_id", roomId)
      .maybeSingle();
    if (!photo) {
      return {
        ok: false,
        error: "That photo doesn't belong to this room.",
      };
    }
  }

  const { error } = await supabase
    .from("listing_rooms")
    .update({ featured_photo_id: photoId })
    .eq("id", roomId)
    .eq("listing_id", listingId);
  if (error) {
    return { ok: false, error: "Could not set cover photo." };
  }

  revalidatePath(`/dashboard/listings/${listingId}/edit/rooms/${roomId}`);
  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  return { ok: true };
}

export async function setRoomAmenityAction(
  listingId: string,
  roomId: string,
  amenityKey: string,
  on: boolean,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const supabase = createServerClient();

  if (on) {
    const { data: existing } = await supabase
      .from("listing_amenities")
      .select("id")
      .eq("listing_id", listingId)
      .eq("room_id", roomId)
      .eq("amenity_key", amenityKey)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabase.from("listing_amenities").insert({
        listing_id: listingId,
        room_id: roomId,
        amenity_key: amenityKey,
      });
      if (error) {
        return { ok: false, error: "Could not add amenity." };
      }
    }
  } else {
    const { error } = await supabase
      .from("listing_amenities")
      .delete()
      .eq("listing_id", listingId)
      .eq("room_id", roomId)
      .eq("amenity_key", amenityKey);
    if (error) {
      return { ok: false, error: "Could not remove amenity." };
    }
  }

  revalidatePath(`/dashboard/listings/${listingId}/edit/rooms/${roomId}`);
  return { ok: true };
}

// ─── Structured per-room bed composition (room_beds) ─────────────

const setRoomBedsInputSchema = z.array(bedInputSchema).max(30);

export async function setRoomBedsAction(
  listingId: string,
  roomId: string,
  beds: BedInput[],
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const parsed = setRoomBedsInputSchema.safeParse(beds);
  if (!parsed.success) {
    return { ok: false, error: "Some bed entries look wrong." };
  }

  const supabase = createServerClient();

  // Confirm the room belongs to the listing (defence in depth — RLS would
  // already deny cross-host writes).
  const { data: roomRow } = await supabase
    .from("listing_rooms")
    .select("id")
    .eq("id", roomId)
    .eq("listing_id", listingId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!roomRow) {
    return { ok: false, error: "Room not found on this listing." };
  }

  // One-shot replacement: wipe + insert.
  const { error: delErr } = await supabase
    .from("room_beds")
    .delete()
    .eq("room_id", roomId);
  if (delErr) {
    return { ok: false, error: "Could not update beds." };
  }

  if (parsed.data.length > 0) {
    const rows = parsed.data.map((b, i) => ({
      room_id: roomId,
      bed_kind: b.bed_kind,
      quantity: b.quantity,
      sort_order: i,
    }));
    const { error: insErr } = await supabase.from("room_beds").insert(rows);
    if (insErr) {
      return { ok: false, error: "Could not save beds." };
    }
  }

  // Derive a display-friendly bed_type string ("1 King + 2 Twins") so the
  // legacy text column keeps working for public readers that haven't been
  // updated to join room_beds yet.
  const summary =
    parsed.data.length === 0
      ? null
      : parsed.data
          .map((b) => `${b.quantity} ${bedKindLabel(b.bed_kind, b.quantity)}`)
          .join(" + ")
          .slice(0, 40);
  await supabase
    .from("listing_rooms")
    .update({ bed_type: summary })
    .eq("id", roomId)
    .eq("listing_id", listingId);

  revalidatePath(`/dashboard/listings/${listingId}/edit/rooms/${roomId}`);
  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  revalidatePath("/dashboard/rooms");
  return { ok: true };
}
