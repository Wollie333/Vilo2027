"use server";

import { revalidatePath } from "next/cache";

import { createServerClient } from "@/lib/supabase/server";

import { patchSchema, type PatchInput } from "./schemas";

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

export async function replaceAmenitiesAction(
  listingId: string,
  amenityKeys: string[],
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const supabase = createServerClient();

  // Wipe + reinsert. Simple and predictable for the first cut.
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
    }));
    const { error: insErr } = await supabase
      .from("listing_amenities")
      .insert(rows);
    if (insErr) {
      return { ok: false, error: "Could not save amenities." };
    }
  }

  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  return { ok: true };
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
