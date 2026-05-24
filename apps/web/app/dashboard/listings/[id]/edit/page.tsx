import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import {
  Editor,
  type EditorAmenity,
  type EditorListing,
  type EditorPhoto,
  type EditorRoom,
} from "./Editor";

export const metadata: Metadata = {
  title: "Edit listing · Vilo",
};

export default async function EditListingPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/dashboard/listings/${params.id}/edit`);
  }

  // RLS (host_manage_own_listings) makes this implicitly own-only.
  const { data: listing } = await supabase
    .from("listings")
    .select(
      [
        "id",
        "host_id",
        "listing_type",
        "accommodation_type",
        "experience_type",
        "name",
        "slug",
        "description",
        "address_line1",
        "address_line2",
        "city",
        "province",
        "postal_code",
        "latitude",
        "longitude",
        "bedrooms",
        "bathrooms",
        "max_guests",
        "min_nights",
        "max_nights",
        "check_in_time",
        "check_out_time",
        "base_price",
        "weekend_price",
        "cleaning_fee",
        "currency",
        "cancellation_policy",
        "house_rules",
        "instant_booking",
        "is_published",
        "booking_mode",
      ].join(", "),
    )
    .eq("id", params.id)
    .maybeSingle<EditorListing>();

  if (!listing) {
    notFound();
  }

  const [{ data: amenityRows }, { data: photoRows }, { data: roomRows }] =
    await Promise.all([
      supabase
        .from("listing_amenities")
        .select("id, amenity_key, amenity_label, room_id")
        .eq("listing_id", params.id),
      supabase
        .from("listing_photos")
        .select("id, url, sort_order, room_id")
        .eq("listing_id", params.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("listing_rooms")
        .select(
          "id, name, description, bedrooms, bathrooms, max_guests, base_price, weekend_price, cleaning_fee, sort_order, is_active",
        )
        .eq("listing_id", params.id)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true }),
    ]);

  const amenities: EditorAmenity[] = (amenityRows ?? []).map((r) => ({
    id: r.id,
    key: r.amenity_key,
    label: r.amenity_label ?? null,
    roomId: r.room_id ?? null,
  }));
  const photos: EditorPhoto[] = (photoRows ?? []).map((r) => ({
    id: r.id,
    url: r.url,
    roomId: r.room_id ?? null,
  }));
  const rooms: EditorRoom[] = (roomRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    max_guests: r.max_guests,
    base_price: r.base_price,
    weekend_price: r.weekend_price,
    cleaning_fee: r.cleaning_fee,
    sort_order: r.sort_order,
    is_active: r.is_active,
  }));

  return (
    <Editor
      listing={listing}
      amenities={amenities}
      photos={photos}
      rooms={rooms}
    />
  );
}
