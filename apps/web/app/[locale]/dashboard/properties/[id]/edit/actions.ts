"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { hostHasValidEft } from "@/lib/payments/eft";
import { hostHasFeature } from "@/lib/products/featureGate";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitiseListingHtml } from "@/lib/sanitiseHtml";
import { computeSetupCompletion } from "@/lib/setup/completion";
import { createServerClient } from "@/lib/supabase/server";

import { z } from "zod";

import {
  bedInputSchema,
  bedKindLabel,
  bookingModeSchema,
  listingAccessSchema,
  localPickSchema,
  patchSchema,
  roomCapacityFromBeds,
  roomPatchSchema,
  type BedInput,
  type BookingModeInput,
  type ListingAccessInput,
  type LocalPickInput,
  type PatchInput,
  type RoomPatch,
} from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

type ListingDb = ReturnType<typeof createServerClient>;

type OwnershipOk = {
  ok: true;
  userId: string;
  db: ListingDb;
  asAdmin: boolean;
};

// Resolve which DB client a listing-edit action should use:
//   • the listing's owner → the RLS-bound client (host self-service, unchanged);
//   • platform staff holding `listings.edit` → the service-role client so they
//     can edit ANY host's listing, and we record an admin_audit_log row so the
//     change surfaces on that user's Activity tab (who / what / when).
// Anyone else is refused. `own.db` is used for every read+write in the action,
// so the owner path stays on RLS and the admin path bypasses it deliberately.
async function assertOwnership(
  listingId: string,
): Promise<OwnershipOk | { ok: false; error: string }> {
  const rls = createServerClient();
  const {
    data: { user },
  } = await rls.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Service role so we can read the owner even when the caller isn't the owner.
  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("properties")
    .select("id, host:hosts!inner ( user_id )")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return { ok: false, error: "Listing not found." };

  const ownerId = (listing as unknown as { host: { user_id: string } }).host
    .user_id;

  if (ownerId === user.id) {
    return { ok: true, userId: user.id, db: rls, asAdmin: false };
  }

  // Not the owner — listings are open to any active platform-staff member
  // (per the admin permission model: financials + bookings are permission-
  // gated, but the rest of a user's record is open to admins). Staff access to
  // /admin is already enforced by the admin layout; this is the action-layer
  // equivalent for direct calls.
  const { data: staff } = await rls
    .from("platform_staff")
    .select("is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!staff?.is_active) {
    return { ok: false, error: "Not your listing." };
  }
  await logAdminListingEdit(admin, user.id, ownerId, listingId);
  return {
    ok: true,
    userId: user.id,
    db: admin as unknown as ListingDb,
    asAdmin: true,
  };
}

// Audit a staff/admin edit of someone else's listing. Tagged with the owner's
// user id in the payload so the user-record Activity tab can surface it.
async function logAdminListingEdit(
  admin: ReturnType<typeof createAdminClient>,
  adminId: string,
  ownerUserId: string,
  listingId: string,
): Promise<void> {
  try {
    const h = headers();
    await admin.from("admin_audit_log").insert({
      admin_id: adminId,
      action: "listing.edit",
      target_type: "listing",
      target_id: listingId,
      payload: { owner_user_id: ownerUserId },
      ip_address:
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        null,
      user_agent: h.get("user-agent"),
    });
  } catch {
    // Never let an audit-log failure block the edit itself.
  }
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

  const supabase = own.db;
  const { error } = await supabase
    .from("properties")
    .update(patch)
    .eq("id", listingId);
  if (error) {
    return { ok: false, error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/properties/${listingId}/edit`);
  revalidatePath("/dashboard");
  return { ok: true };
}

// Assign the listing to one of the host's businesses. Validated separately from
// the generic patch so we can enforce that the chosen business belongs to the
// listing's host (the business drives the listing's invoices/quotes identity).
export async function assignListingBusinessAction(
  listingId: string,
  businessId: string,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const supabase = own.db;
  const { data: listing } = await supabase
    .from("properties")
    .select("host_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return { ok: false, error: "Listing not found." };

  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("host_id", listing.host_id)
    .eq("is_archived", false)
    .maybeSingle();
  if (!biz) return { ok: false, error: "That business isn't available." };

  const { error } = await supabase
    .from("properties")
    .update({ business_id: businessId })
    .eq("id", listingId);
  if (error) return { ok: false, error: "Could not assign the business." };

  revalidatePath(`/dashboard/properties/${listingId}/edit`);
  revalidatePath("/dashboard/properties");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ─── Guest access + local picks (Trip Details page) ──────────────

const cleanStr = (v: string | undefined): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

export async function saveListingAccessAction(
  listingId: string,
  input: ListingAccessInput,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const parsed = listingAccessSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Some fields look wrong. Check the form." };
  }

  const supabase = own.db;
  const { error } = await supabase.from("property_access").upsert(
    {
      property_id: listingId,
      check_in_method: cleanStr(parsed.data.check_in_method),
      check_in_instructions: cleanStr(parsed.data.check_in_instructions),
      gate_code: cleanStr(parsed.data.gate_code),
      door_code: cleanStr(parsed.data.door_code),
      wifi_network: cleanStr(parsed.data.wifi_network),
      wifi_password: cleanStr(parsed.data.wifi_password),
      send_lead_minutes: parsed.data.send_lead_minutes,
    },
    { onConflict: "property_id" },
  );
  if (error) {
    return { ok: false, error: "Could not save access details. Try again." };
  }

  revalidatePath(`/dashboard/properties/${listingId}/edit`);
  return { ok: true };
}

export type LocalPickRow = {
  id: string;
  category: string;
  title: string;
  blurb: string | null;
  distance_label: string | null;
  sort_order: number;
};

export async function replaceLocalPicksAction(
  listingId: string,
  picks: LocalPickInput[],
): Promise<ActionResult<LocalPickRow[]>> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const parsed = z.array(localPickSchema).max(24).safeParse(picks);
  if (!parsed.success) {
    return { ok: false, error: "Some picks look wrong. Check the list." };
  }

  const supabase = own.db;

  // Full replacement — wipe this listing's picks then re-insert in order.
  const { error: delErr } = await supabase
    .from("property_local_picks")
    .delete()
    .eq("property_id", listingId);
  if (delErr) {
    return { ok: false, error: "Could not update local picks." };
  }

  if (parsed.data.length > 0) {
    const rows = parsed.data.map((p, i) => ({
      property_id: listingId,
      category: p.category,
      title: p.title.trim(),
      blurb: cleanStr(p.blurb),
      distance_label: cleanStr(p.distance_label),
      sort_order: i,
    }));
    const { error: insErr } = await supabase
      .from("property_local_picks")
      .insert(rows);
    if (insErr) {
      return { ok: false, error: "Could not save local picks." };
    }
  }

  const { data: fresh } = await supabase
    .from("property_local_picks")
    .select("id, category, title, blurb, distance_label, sort_order")
    .eq("property_id", listingId)
    .order("sort_order", { ascending: true });

  revalidatePath(`/dashboard/properties/${listingId}/edit`);
  return { ok: true, data: (fresh ?? []) as LocalPickRow[] };
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

  const supabase = own.db;

  // Preserve per-amenity room assignments across re-saves by snapshotting
  // the existing key → room_id map before wiping.
  const { data: existing } = await supabase
    .from("property_amenities")
    .select("amenity_key, room_id")
    .eq("property_id", listingId);
  const roomByKey = new Map<string, string | null>(
    (existing ?? []).map((r) => [r.amenity_key, r.room_id ?? null]),
  );

  const { error: delErr } = await supabase
    .from("property_amenities")
    .delete()
    .eq("property_id", listingId);
  if (delErr) {
    return { ok: false, error: "Could not update amenities." };
  }

  if (amenityKeys.length > 0) {
    const rows = amenityKeys.map((key) => ({
      property_id: listingId,
      amenity_key: key,
      room_id: roomByKey.get(key) ?? null,
    }));
    const { error: insErr } = await supabase
      .from("property_amenities")
      .insert(rows);
    if (insErr) {
      return { ok: false, error: "Could not save amenities." };
    }
  }

  const { data: fresh } = await supabase
    .from("property_amenities")
    .select("id, amenity_key, amenity_label, room_id")
    .eq("property_id", listingId);

  revalidatePath(`/dashboard/properties/${listingId}/edit`);
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

/**
 * Issue a one-time signed upload URL for a listing photo. The browser uploads
 * the file straight to Storage with this token (no file through the action →
 * no Vercel body cap; the token authorises the write → no dependency on the
 * browser client's session). Ownership is checked here; the signed URL is
 * minted with admin creds so it always succeeds once ownership passes.
 */
export async function createListingPhotoUploadUrl(
  listingId: string,
  ext: string,
  roomId: string | null = null,
): Promise<ActionResult<{ path: string; token: string }>> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  if (roomId) {
    const supabase = own.db;
    const { data: room } = await supabase
      .from("property_rooms")
      .select("id")
      .eq("id", roomId)
      .eq("property_id", listingId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!room) return { ok: false, error: "Room not found on this listing." };
  }

  const safeExt =
    (ext || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${listingId}/${crypto.randomUUID()}.${safeExt}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("listing-photos")
    .createSignedUploadUrl(path);
  if (error || !data) {
    return { ok: false, error: "Could not start the upload. Try again." };
  }
  return { ok: true, data: { path, token: data.token } };
}

/**
 * Record a photo that the client already uploaded directly to Storage. We do
 * NOT push the file through this Server Action — Vercel caps action request
 * bodies at ~4.5 MB, so large photos must go browser → Supabase Storage
 * directly (RLS-protected), then this records the row. `storagePath` must live
 * under the listing's folder.
 */
export async function registerListingPhotoAction(
  listingId: string,
  storagePath: string,
  roomId: string | null = null,
): Promise<ActionResult<{ id: string; url: string }>> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  if (!storagePath.startsWith(`${listingId}/`)) {
    return { ok: false, error: "Invalid photo path." };
  }

  const supabase = own.db;

  if (roomId) {
    const { data: room } = await supabase
      .from("property_rooms")
      .select("id")
      .eq("id", roomId)
      .eq("property_id", listingId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!room) {
      return { ok: false, error: "Room not found on this listing." };
    }
  }

  const { data: publicUrl } = supabase.storage
    .from("listing-photos")
    .getPublicUrl(storagePath);

  const { count } = await supabase
    .from("property_photos")
    .select("id", { count: "exact", head: true })
    .eq("property_id", listingId);

  const { data: row, error: rowErr } = await supabase
    .from("property_photos")
    .insert({
      property_id: listingId,
      storage_path: storagePath,
      url: publicUrl.publicUrl,
      sort_order: count ?? 0,
      room_id: roomId,
    })
    .select("id, url")
    .single();
  if (rowErr || !row) {
    await supabase.storage.from("listing-photos").remove([storagePath]);
    return { ok: false, error: "Upload saved but record failed." };
  }

  revalidatePath(`/dashboard/properties/${listingId}/edit`);
  if (roomId) {
    revalidatePath(`/dashboard/properties/${listingId}/edit/rooms/${roomId}`);
  }
  return { ok: true, data: { id: row.id, url: row.url } };
}

export async function deleteListingPhotoAction(
  listingId: string,
  photoId: string,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const supabase = own.db;
  const { data: photo, error: fetchErr } = await supabase
    .from("property_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("property_id", listingId)
    .maybeSingle();
  if (fetchErr || !photo) {
    return { ok: false, error: "Photo not found." };
  }

  const { error: delRowErr } = await supabase
    .from("property_photos")
    .delete()
    .eq("id", photoId);
  if (delRowErr) {
    return { ok: false, error: "Could not remove photo." };
  }

  await supabase.storage.from("listing-photos").remove([photo.storage_path]);

  revalidatePath(`/dashboard/properties/${listingId}/edit`);
  return { ok: true };
}

/**
 * Set a photo's caption / alt text (owner-scoped). `property_photos.caption` is
 * what the public site renders as the image's alt (room detail gallery, directory),
 * so this is the alt-text editor for listing + room photos.
 */
export async function setListingPhotoCaptionAction(
  listingId: string,
  photoId: string,
  caption: string,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const { error } = await own.db
    .from("property_photos")
    .update({ caption: caption.trim() || null })
    .eq("id", photoId)
    .eq("property_id", listingId);
  if (error) return { ok: false, error: "Could not save the alt text." };

  revalidatePath(`/dashboard/properties/${listingId}/edit`);
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

  const supabase = own.db;
  // Parallel updates — sort_order is independent per row, no FK churn, the
  // property_id eq narrows to this listing so cross-listing writes are blocked
  // by RLS even if the IDs were forged.
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("property_photos")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("property_id", listingId),
    ),
  );
  if (results.some((r) => r.error)) {
    return { ok: false, error: "Some photos didn't reorder. Try again." };
  }

  revalidatePath(`/dashboard/properties/${listingId}/edit`);
  return { ok: true };
}

export async function softDeleteListingAction(
  listingId: string,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const supabase = own.db;

  // Block deletion when there are active bookings — soft-deleting a listing
  // with future stays would orphan paid bookings. Per AGENT_RULES.md §2.1
  // we never hard-delete, only set deleted_at.
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("property_id", listingId)
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
    .from("properties")
    .update({
      deleted_at: new Date().toISOString(),
      is_published: false,
    })
    .eq("id", listingId);
  if (error) {
    return { ok: false, error: "Could not delete listing. Try again." };
  }

  revalidatePath("/dashboard/properties");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function togglePublishAction(
  listingId: string,
  publish: boolean,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const supabase = own.db;

  if (!publish) {
    const { error } = await supabase
      .from("properties")
      .update({ is_published: false })
      .eq("id", listingId);
    if (error) {
      return { ok: false, error: "Could not update publish status." };
    }
    revalidatePath(`/dashboard/properties/${listingId}/edit`);
    revalidatePath("/dashboard");
    return { ok: true };
  }

  // Publishing — minimum bookable fields + a resolvable public slug.
  const { data: listing } = await supabase
    .from("properties")
    .select(
      "name, base_price, max_guests, slug, host_id, property_type, booking_mode, cancellation_policy, check_in_time, check_out_time",
    )
    .eq("id", listingId)
    .single();
  if (!listing) return { ok: false, error: "Listing not found." };

  // W15 — directory publication is a gated channel. Going live requires the
  // owner's plan to grant `directory_listing` (un-publishing is always allowed
  // so a downgraded host can still pull a property from the directory).
  if (!(await hostHasFeature(listing.host_id, "directory_listing"))) {
    return {
      ok: false,
      error: "Listing in the Wielo directory isn't available on your plan.",
    };
  }

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

  // A listing can only go live when setup is 100% — same predicates the setup
  // wizard uses, enforced here so no surface (editor/portfolio) can bypass it.
  const [
    { data: hostRow },
    { data: bizRow },
    hasBankAccount,
    { count: photoCount },
    { count: roomCount },
    { count: cancelCount },
    { count: houseRulesCount },
  ] = await Promise.all([
    supabase
      .from("hosts")
      .select("bio, avatar_url, languages_spoken")
      .eq("id", listing.host_id)
      .maybeSingle(),
    // The default business must be named (trading or legal) — it's the identity
    // on invoices, quotes and EFT instructions, and a required setup step.
    supabase
      .from("businesses")
      .select("trading_name, legal_name")
      .eq("host_id", listing.host_id)
      .eq("is_default", true)
      .eq("is_archived", false)
      .maybeSingle(),
    // A listing can't go live without a VALID (default, non-archived) bank
    // account — it's the guaranteed payment fallback (AGENT_RULES.md §4.5/§4.6).
    // The DB trigger trg_listing_requires_bank enforces the same at the DB layer.
    hostHasValidEft(listing.host_id),
    supabase
      .from("property_photos")
      .select("id", { count: "exact", head: true })
      .eq("property_id", listingId),
    supabase
      .from("property_rooms")
      .select("id", { count: "exact", head: true })
      .eq("property_id", listingId)
      .is("deleted_at", null)
      .eq("is_active", true),
    supabase
      .from("property_policies")
      .select("id", { count: "exact", head: true })
      .eq("property_id", listingId)
      .eq("policy_type", "cancellation")
      .is("room_id", null),
    // House rules must ALSO be assigned listing-wide — computeSetupCompletion
    // requires both. Previously this count was missing, so hasHouseRules was
    // always undefined → the policies step never completed server-side and
    // publishing was blocked even when both policies were attached.
    supabase
      .from("property_policies")
      .select("id", { count: "exact", head: true })
      .eq("property_id", listingId)
      .eq("policy_type", "house_rules")
      .is("room_id", null),
  ]);

  const completion = computeSetupCompletion({
    host: hostRow ?? null,
    businessNameSet: Boolean(
      (bizRow?.trading_name ?? "").trim() || (bizRow?.legal_name ?? "").trim(),
    ),
    hasBankAccount,
    listing,
    photoCount: photoCount ?? 0,
    roomCount: roomCount ?? 0,
    hasCancellationPolicy: (cancelCount ?? 0) > 0,
    hasHouseRules: (houseRulesCount ?? 0) > 0,
  });

  const LABELS: Record<string, string> = {
    profile: "your host profile",
    business: "your business name",
    banking: "a payout bank account",
    listing: "listing photos",
    rooms: "at least one room",
    policies: "a refund policy",
  };
  const missing = (
    ["profile", "business", "banking", "listing", "rooms", "policies"] as const
  ).filter((k) => !completion[k]);
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Finish setup before going live — still needed: ${missing
        .map((k) => LABELS[k])
        .join(", ")}.`,
    };
  }

  // Guarantee a unique slug so /property/<slug> resolves the instant we publish
  // (the create trigger normally sets it; this is a defensive fallback).
  let slug = listing.slug;
  if (!slug) {
    const base =
      listing.name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "listing";
    slug = base;
    const { data: clash } = await supabase
      .from("properties")
      .select("id")
      .eq("slug", slug)
      .neq("id", listingId)
      .maybeSingle();
    if (clash) slug = `${base}-${listingId.slice(0, 6)}`;
  }

  const { error } = await supabase
    .from("properties")
    .update({
      is_published: true,
      published_at: new Date().toISOString(),
      slug,
    })
    .eq("id", listingId);
  if (error) {
    return { ok: false, error: "Could not update publish status." };
  }

  revalidatePath(`/dashboard/properties/${listingId}/edit`);
  revalidatePath("/dashboard");
  revalidatePath(`/property/${slug}`);
  return { ok: true };
}

// W12 — the Website publication channel for one property. Toggles `is_visible`
// on the `website_properties` membership row for the property's owning
// business's site (insert if it doesn't exist yet). Independent of the Directory
// channel (`is_published`). Cosmetic only — booking always re-prices via the
// engine, so this never touches the ledger. Hiding keeps the row (and its
// display overrides + sort order) so re-showing restores prior customisation.
export async function setWebsiteChannelAction(
  listingId: string,
  visible: boolean,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const supabase = own.db;

  const { data: listing } = await supabase
    .from("properties")
    .select("business_id, host_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return { ok: false, error: "Listing not found." };

  // W15 — the website channel is gated. Showing a property on the site requires
  // the owner's plan to grant `website_builder` (hiding is always allowed).
  if (visible && !(await hostHasFeature(listing.host_id, "website_builder"))) {
    return {
      ok: false,
      error: "A website isn't available on your plan.",
    };
  }

  if (!listing.business_id) {
    return {
      ok: false,
      error: "Attach this property to a business before publishing a website.",
    };
  }

  const { data: site } = await supabase
    .from("host_websites")
    .select("id")
    .eq("business_id", listing.business_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) {
    return {
      ok: false,
      error: "This business doesn't have a website yet.",
    };
  }

  // Upsert keyed on the (website_id, property_id) unique constraint so an
  // existing membership row keeps its sort order + display overrides.
  const { error } = await supabase.from("website_properties").upsert(
    {
      website_id: site.id,
      property_id: listingId,
      is_visible: visible,
    },
    { onConflict: "website_id,property_id" },
  );
  if (error) {
    return { ok: false, error: "Could not update the website channel." };
  }

  revalidatePath(`/dashboard/properties/${listingId}/edit`);
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

  const supabase = own.db;

  // Booking mode is independent of room existence. A listing in per-room or
  // flexible mode with zero rooms is simply not bookable as rooms until the
  // host adds one — a soft constraint the host resolves organically.
  const { error } = await supabase
    .from("properties")
    .update({ booking_mode: parsed.data.booking_mode })
    .eq("id", listingId);
  if (error) {
    return { ok: false, error: "Could not change booking mode." };
  }

  revalidatePath(`/dashboard/properties/${listingId}/edit`);
  revalidatePath("/dashboard/properties");
  return { ok: true };
}

// Derive the parent listing's headline price + capacity from its active rooms:
// base_price = cheapest active room ("from"), and max_guests / bedrooms /
// bathrooms = the sum across rooms. No-op when the listing has no active rooms.
// Called after every room create / update / delete so the listing stays in sync.
async function recomputeListingFromRooms(
  supabase: ReturnType<typeof createServerClient>,
  listingId: string,
): Promise<void> {
  const { data: rooms } = await supabase
    .from("property_rooms")
    .select(
      "base_price, price_per_person, pricing_mode, max_guests, bedrooms, bathrooms",
    )
    .eq("property_id", listingId)
    .is("deleted_at", null)
    .eq("is_active", true);
  if (!rooms || rooms.length === 0) return;
  // Headline "from" price = cheapest room's effective nightly figure for its
  // pricing mode (per_person rooms quote price_per_person; the rest base_price).
  const prices = rooms
    .map((r) =>
      r.pricing_mode === "per_person"
        ? Number(r.price_per_person)
        : Number(r.base_price),
    )
    .filter((n) => Number.isFinite(n) && n > 0);
  const sum = (key: "max_guests" | "bedrooms" | "bathrooms") =>
    rooms.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
  await supabase
    .from("properties")
    .update({
      base_price: prices.length ? Math.min(...prices) : null,
      max_guests: sum("max_guests") || null,
      bedrooms: sum("bedrooms") || null,
      bathrooms: sum("bathrooms") || null,
    })
    .eq("id", listingId);
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

  const supabase = own.db;

  // Sort_order = current max + 1 so new rooms append to the bottom.
  const { data: existing } = await supabase
    .from("property_rooms")
    .select("sort_order")
    .eq("property_id", listingId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (existing?.sort_order ?? -1) + 1;

  const { data: room, error } = await supabase
    .from("property_rooms")
    .insert({
      property_id: listingId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      bedrooms: parsed.data.bedrooms ?? 1,
      bathrooms: parsed.data.bathrooms ?? 0,
      max_guests: parsed.data.max_guests,
      min_guests: parsed.data.min_guests ?? 1,
      min_nights: parsed.data.min_nights ?? 1,
      base_price: parsed.data.base_price,
      weekend_price: parsed.data.weekend_price ?? null,
      cleaning_fee: parsed.data.cleaning_fee ?? 0,
      is_active: parsed.data.is_active ?? true,
      sort_order: nextSort,
      pricing_mode: parsed.data.pricing_mode ?? "per_room",
      price_per_person: parsed.data.price_per_person ?? null,
      base_occupancy: parsed.data.base_occupancy ?? null,
      extra_guest_price: parsed.data.extra_guest_price ?? null,
      // Age/pet pricing + allowances, size, view, experiences — these were
      // dropped on create, silently losing what the host typed. Persist them.
      child_price: parsed.data.child_price ?? 0,
      infant_price: parsed.data.infant_price ?? 0,
      pet_fee: parsed.data.pet_fee ?? 0,
      allow_children: parsed.data.allow_children ?? true,
      allow_infants: parsed.data.allow_infants ?? true,
      allow_pets: parsed.data.allow_pets ?? true,
      infant_max_age: parsed.data.infant_max_age ?? 2,
      child_max_age: parsed.data.child_max_age ?? 12,
      room_size_sqm: parsed.data.room_size_sqm ?? null,
      bed_type: parsed.data.bed_type ?? null,
      view_type: parsed.data.view_type ?? null,
      experiences: parsed.data.experiences ?? [],
    })
    .select("id")
    .single();
  if (error || !room) {
    return { ok: false, error: "Could not create room. Try again." };
  }

  await recomputeListingFromRooms(supabase, listingId);
  revalidatePath(`/dashboard/properties/${listingId}/edit`);
  revalidatePath("/dashboard");
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

  const supabase = own.db;
  const { error } = await supabase
    .from("property_rooms")
    .update(parsed.data)
    .eq("id", roomId)
    .eq("property_id", listingId);
  if (error) {
    return { ok: false, error: "Could not save room." };
  }

  await recomputeListingFromRooms(supabase, listingId);
  revalidatePath(`/dashboard/properties/${listingId}/edit`);
  revalidatePath("/dashboard");
  return { ok: true };
}

// Per-room guest access (gate/door code, Wi-Fi, self check-in). Same shape as
// listing access; falls back to listing access per field on the guest's Trip
// page. Sensitive — host-manage RLS only.
export async function updateRoomAccessAction(
  listingId: string,
  roomId: string,
  input: ListingAccessInput,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const parsed = listingAccessSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Some fields look wrong. Check the form." };
  }

  const supabase = own.db;
  // Confirm the room belongs to this listing before writing access for it.
  const { data: room } = await supabase
    .from("property_rooms")
    .select("id")
    .eq("id", roomId)
    .eq("property_id", listingId)
    .maybeSingle();
  if (!room) return { ok: false, error: "Room not found." };

  const { error } = await supabase.from("property_room_access").upsert(
    {
      room_id: roomId,
      check_in_method: cleanStr(parsed.data.check_in_method),
      check_in_instructions: cleanStr(parsed.data.check_in_instructions),
      gate_code: cleanStr(parsed.data.gate_code),
      door_code: cleanStr(parsed.data.door_code),
      wifi_network: cleanStr(parsed.data.wifi_network),
      wifi_password: cleanStr(parsed.data.wifi_password),
    },
    { onConflict: "room_id" },
  );
  if (error) {
    return { ok: false, error: "Could not save room access. Try again." };
  }

  revalidatePath(`/dashboard/properties/${listingId}/edit/rooms/${roomId}`);
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
    min_guests: number;
    min_nights: number;
    base_price: number;
    weekend_price: number | null;
    cleaning_fee: number;
    is_active: boolean;
    room_size_sqm: number | null;
    bed_type: string | null;
    view_type: string | null;
    experiences: string[];
    featured_photo_id: string | null;
    beds: { bed_kind: string; quantity: number; sleeps: number }[];
    pricing_mode: "per_room" | "per_person" | "per_room_plus_extra";
    price_per_person: number | null;
    base_occupancy: number | null;
    extra_guest_price: number | null;
    child_price: number;
    infant_price: number;
    pet_fee: number;
    infant_max_age: number;
    child_max_age: number;
    allow_children: boolean;
    allow_infants: boolean;
    allow_pets: boolean;
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

  const supabase = own.db;
  const { data: room } = await supabase
    .from("property_rooms")
    .select(
      "id, name, description, bedrooms, bathrooms, max_guests, min_guests, min_nights, base_price, weekend_price, cleaning_fee, is_active, room_size_sqm, bed_type, view_type, experiences, featured_photo_id, pricing_mode, price_per_person, base_occupancy, extra_guest_price, child_price, infant_price, pet_fee, infant_max_age, child_max_age, allow_children, allow_infants, allow_pets",
    )
    .eq("id", roomId)
    .eq("property_id", listingId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!room) return { ok: false, error: "Room not found." };

  const [{ data: photoRows }, { data: amenityRows }, { data: bedRows }] =
    await Promise.all([
      supabase
        .from("property_photos")
        .select("id, url, sort_order")
        .eq("property_id", listingId)
        .eq("room_id", roomId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("property_amenities")
        .select("amenity_key")
        .eq("property_id", listingId)
        .eq("room_id", roomId),
      supabase
        .from("room_beds")
        .select("bed_kind, quantity, sleeps, sort_order")
        .eq("room_id", roomId)
        .order("sort_order", { ascending: true }),
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
        min_guests: room.min_guests ?? 1,
        min_nights: room.min_nights ?? 1,
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
        beds: (bedRows ?? []).map((b) => ({
          bed_kind: b.bed_kind,
          quantity: b.quantity,
          sleeps: b.sleeps,
        })),
        pricing_mode: (room.pricing_mode ??
          "per_room") as RoomEditorData["room"]["pricing_mode"],
        price_per_person:
          room.price_per_person != null ? Number(room.price_per_person) : null,
        base_occupancy: room.base_occupancy ?? null,
        extra_guest_price:
          room.extra_guest_price != null
            ? Number(room.extra_guest_price)
            : null,
        child_price: Number(room.child_price ?? 0),
        infant_price: Number(room.infant_price ?? 0),
        pet_fee: Number(room.pet_fee ?? 0),
        infant_max_age: room.infant_max_age ?? 2,
        child_max_age: room.child_max_age ?? 12,
        allow_children: room.allow_children ?? true,
        allow_infants: room.allow_infants ?? true,
        allow_pets: room.allow_pets ?? true,
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

  const supabase = own.db;

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
    .from("property_rooms")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", roomId)
    .eq("property_id", listingId);
  if (error) {
    return { ok: false, error: "Could not delete room." };
  }

  await recomputeListingFromRooms(supabase, listingId);
  revalidatePath(`/dashboard/properties/${listingId}/edit`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function assignPhotoToRoomAction(
  listingId: string,
  photoId: string,
  roomId: string | null,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const supabase = own.db;
  const { error } = await supabase
    .from("property_photos")
    .update({ room_id: roomId })
    .eq("id", photoId)
    .eq("property_id", listingId);
  if (error) {
    return { ok: false, error: "Could not assign photo." };
  }
  revalidatePath(`/dashboard/properties/${listingId}/edit`);
  return { ok: true };
}

export async function assignAmenityToRoomAction(
  listingId: string,
  amenityId: string,
  roomId: string | null,
): Promise<ActionResult> {
  const own = await assertOwnership(listingId);
  if (!own.ok) return own;

  const supabase = own.db;
  const { error } = await supabase
    .from("property_amenities")
    .update({ room_id: roomId })
    .eq("id", amenityId)
    .eq("property_id", listingId);
  if (error) {
    return { ok: false, error: "Could not assign amenity." };
  }
  revalidatePath(`/dashboard/properties/${listingId}/edit`);
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

  const supabase = own.db;

  if (photoId) {
    const { data: photo } = await supabase
      .from("property_photos")
      .select("id")
      .eq("id", photoId)
      .eq("property_id", listingId)
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
    .from("property_rooms")
    .update({ featured_photo_id: photoId })
    .eq("id", roomId)
    .eq("property_id", listingId);
  if (error) {
    return { ok: false, error: "Could not set cover photo." };
  }

  revalidatePath(`/dashboard/properties/${listingId}/edit/rooms/${roomId}`);
  revalidatePath(`/dashboard/properties/${listingId}/edit`);
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

  const supabase = own.db;

  if (on) {
    const { data: existing } = await supabase
      .from("property_amenities")
      .select("id")
      .eq("property_id", listingId)
      .eq("room_id", roomId)
      .eq("amenity_key", amenityKey)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabase.from("property_amenities").insert({
        property_id: listingId,
        room_id: roomId,
        amenity_key: amenityKey,
      });
      if (error) {
        return { ok: false, error: "Could not add amenity." };
      }
    }
  } else {
    const { error } = await supabase
      .from("property_amenities")
      .delete()
      .eq("property_id", listingId)
      .eq("room_id", roomId)
      .eq("amenity_key", amenityKey);
    if (error) {
      return { ok: false, error: "Could not remove amenity." };
    }
  }

  revalidatePath(`/dashboard/properties/${listingId}/edit/rooms/${roomId}`);
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

  const supabase = own.db;

  // Confirm the room belongs to the listing (defence in depth — RLS would
  // already deny cross-host writes).
  const { data: roomRow } = await supabase
    .from("property_rooms")
    .select("id")
    .eq("id", roomId)
    .eq("property_id", listingId)
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
      sleeps: b.sleeps,
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

  // Capacity is the single source of truth — derived strictly from beds.
  const derivedCapacity = roomCapacityFromBeds(parsed.data);
  await supabase
    .from("property_rooms")
    .update({
      bed_type: summary,
      ...(derivedCapacity > 0 ? { max_guests: derivedCapacity } : {}),
    })
    .eq("id", roomId)
    .eq("property_id", listingId);

  // Keep the parent listing's headline capacity / "from" price in sync.
  await recomputeListingFromRooms(supabase, listingId);

  revalidatePath(`/dashboard/properties/${listingId}/edit/rooms/${roomId}`);
  revalidatePath(`/dashboard/properties/${listingId}/edit`);
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard");
  return { ok: true };
}
