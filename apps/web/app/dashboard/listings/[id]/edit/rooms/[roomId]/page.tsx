import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { RoomEditor, type RoomEditorRoom } from "./RoomEditor";

export const metadata: Metadata = {
  title: "Edit room",
};

export const dynamic = "force-dynamic";

export default async function EditRoomPage({
  params,
}: {
  params: { id: string; roomId: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/login?next=/dashboard/listings/${params.id}/edit/rooms/${params.roomId}`,
    );
  }

  // RLS host_manage_own_listings filters to listings the host owns.
  const { data: listing } = await supabase
    .from("listings")
    .select("id, name, slug, currency")
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!listing) notFound();

  // RLS host_manage_own_rooms — same gate.
  const { data: room } = await supabase
    .from("listing_rooms")
    .select(
      "id, listing_id, name, description, bedrooms, bathrooms, max_guests, min_guests, min_nights, base_price, weekend_price, cleaning_fee, sort_order, is_active, room_size_sqm, bed_type, view_type, experiences, featured_photo_id, pricing_mode, price_per_person, base_occupancy, extra_guest_price, child_price, infant_price, pet_fee, infant_max_age, child_max_age, allow_children, allow_infants, allow_pets",
    )
    .eq("id", params.roomId)
    .eq("listing_id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!room) notFound();

  // Per-room photos + per-room amenities + bed composition.
  const [{ data: photoRows }, { data: amenityRows }, { data: bedRows }] =
    await Promise.all([
      supabase
        .from("listing_photos")
        .select("id, url, sort_order")
        .eq("listing_id", params.id)
        .eq("room_id", params.roomId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("listing_amenities")
        .select("amenity_key")
        .eq("listing_id", params.id)
        .eq("room_id", params.roomId),
      supabase
        .from("room_beds")
        .select("bed_kind, quantity, sleeps, sort_order")
        .eq("room_id", params.roomId)
        .order("sort_order", { ascending: true }),
    ]);

  const roomShape: RoomEditorRoom = {
    id: room.id,
    name: room.name,
    description: room.description,
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
      "per_room") as RoomEditorRoom["pricing_mode"],
    price_per_person:
      room.price_per_person != null ? Number(room.price_per_person) : null,
    base_occupancy: room.base_occupancy ?? null,
    extra_guest_price:
      room.extra_guest_price != null ? Number(room.extra_guest_price) : null,
    child_price: Number(room.child_price ?? 0),
    infant_price: Number(room.infant_price ?? 0),
    pet_fee: Number(room.pet_fee ?? 0),
    infant_max_age: room.infant_max_age ?? 2,
    child_max_age: room.child_max_age ?? 12,
    allow_children: room.allow_children ?? true,
    allow_infants: room.allow_infants ?? true,
    allow_pets: room.allow_pets ?? true,
  };
  const photos = (photoRows ?? []).map((p) => ({ id: p.id, url: p.url }));
  const amenityKeys = (amenityRows ?? []).map((a) => a.amenity_key);

  return (
    <RoomEditor
      listingId={listing.id}
      listingName={listing.name}
      listingSlug={listing.slug ?? null}
      currency={listing.currency}
      room={roomShape}
      initialPhotos={photos}
      initialAmenityKeys={amenityKeys}
    />
  );
}
