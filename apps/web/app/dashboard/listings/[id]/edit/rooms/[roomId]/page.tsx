import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { RoomEditor, type RoomEditorRoom } from "./RoomEditor";

export const metadata: Metadata = {
  title: "Edit room · Vilo",
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
      "id, listing_id, name, description, bedrooms, bathrooms, max_guests, base_price, weekend_price, cleaning_fee, sort_order, is_active, room_size_sqm, bed_type, view_type, experiences, featured_photo_id",
    )
    .eq("id", params.roomId)
    .eq("listing_id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!room) notFound();

  // Per-room photos + per-room amenities.
  const [{ data: photoRows }, { data: amenityRows }] = await Promise.all([
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
  ]);

  const roomShape: RoomEditorRoom = {
    id: room.id,
    name: room.name,
    description: room.description,
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
