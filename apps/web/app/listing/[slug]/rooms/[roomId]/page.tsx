import type { Metadata } from "next";
import { ArrowLeft, BedDouble, Check, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { createServerClient } from "@/lib/supabase/server";

import { AmenitiesList } from "../../AmenitiesList";
import { PhotoGallery, type GalleryPhoto } from "../../PhotoGallery";
import {
  bedSummary,
  roomFlagPills,
  roomPriceLabel,
  type PublicRoom,
} from "../../roomDisplay";

export const metadata: Metadata = {
  title: "Room · Vilo",
};

export const dynamic = "force-dynamic";

export default async function PublicRoomPage({
  params,
}: {
  params: { slug: string; roomId: string };
}) {
  const supabase = createServerClient();

  // Public read of the published listing (RLS allows anon read of published).
  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, slug, name, city, province, currency, booking_mode, is_published",
    )
    .eq("slug", params.slug)
    .maybeSingle();

  if (!listing || !listing.is_published) notFound();

  const { data: room } = await supabase
    .from("listing_rooms")
    .select(
      "id, name, description, bedrooms, bathrooms, max_guests, base_price, cleaning_fee, pricing_mode, price_per_person, base_occupancy, extra_guest_price, room_size_sqm, view_type, has_ensuite_bathroom, pets_allowed, wheelchair_accessible, private_entrance, smoking_allowed, floor_number, inventory_count",
    )
    .eq("id", params.roomId)
    .eq("listing_id", listing.id)
    .is("deleted_at", null)
    .eq("is_active", true)
    .maybeSingle();

  if (!room) notFound();

  const [{ data: photoRows }, { data: amenityRows }, { data: bedRows }] =
    await Promise.all([
      supabase
        .from("listing_photos")
        .select("id, url, sort_order")
        .eq("listing_id", listing.id)
        .eq("room_id", params.roomId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("listing_amenities")
        .select("amenity_key")
        .eq("listing_id", listing.id)
        .eq("room_id", params.roomId),
      supabase
        .from("room_beds")
        .select("bed_kind, quantity, sleeps, sort_order")
        .eq("room_id", params.roomId)
        .order("sort_order", { ascending: true }),
    ]);

  const beds = (bedRows ?? []).map((b) => ({
    bed_kind: b.bed_kind,
    quantity: b.quantity,
  }));

  const publicRoom: PublicRoom = {
    id: room.id,
    name: room.name,
    description: room.description,
    bedrooms: room.bedrooms,
    bathrooms: room.bathrooms,
    max_guests: room.max_guests,
    base_price: Number(room.base_price),
    cleaning_fee: Number(room.cleaning_fee ?? 0),
    pricing_mode: (room.pricing_mode ??
      "per_room") as PublicRoom["pricing_mode"],
    price_per_person:
      room.price_per_person == null ? null : Number(room.price_per_person),
    base_occupancy: room.base_occupancy ?? null,
    extra_guest_price:
      room.extra_guest_price == null ? null : Number(room.extra_guest_price),
    photoUrl: photoRows?.[0]?.url ?? null,
    room_size_sqm:
      room.room_size_sqm == null ? null : Number(room.room_size_sqm),
    view_type: room.view_type ?? null,
    has_ensuite_bathroom: room.has_ensuite_bathroom ?? false,
    pets_allowed: room.pets_allowed ?? false,
    wheelchair_accessible: room.wheelchair_accessible ?? false,
    private_entrance: room.private_entrance ?? false,
    smoking_allowed: room.smoking_allowed ?? false,
    floor_number: room.floor_number ?? null,
    inventory_count: room.inventory_count ?? 1,
    beds,
  };

  const gallery: GalleryPhoto[] = (photoRows ?? []).map((p) => ({
    id: p.id,
    url: p.url,
  }));
  const amenityKeys = (amenityRows ?? []).map((a) => a.amenity_key);
  const price = roomPriceLabel(publicRoom, listing.currency);
  const bedsLine = bedSummary(beds);
  const flags = roomFlagPills(publicRoom);
  const locationLine = [listing.city, listing.province]
    .filter(Boolean)
    .join(", ");

  // Per-room booking lives on the full listing (date picker + cart). Whole-only
  // listings just send the guest to the listing page.
  const bookHref =
    listing.booking_mode === "whole_listing"
      ? `/listing/${listing.slug}`
      : `/listing/${listing.slug}/book?room_ids=${room.id}&room_guests=${room.id}:${Math.max(1, room.max_guests)}&guests=${Math.max(1, room.max_guests)}`;

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-5 py-8 lg:px-8 lg:py-10">
        <Link
          href={`/listing/${listing.slug}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-mute hover:text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {listing.name}
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
              {room.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-brand-mute">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-brand-primary" /> Sleeps{" "}
                {room.max_guests}
              </span>
              {bedsLine ? (
                <span className="inline-flex items-center gap-1.5">
                  <BedDouble className="h-4 w-4 text-brand-primary" />{" "}
                  {bedsLine}
                </span>
              ) : null}
              {room.bathrooms != null ? (
                <span>
                  {room.bathrooms} bath{room.bathrooms === 1 ? "" : "s"}
                </span>
              ) : null}
              {room.room_size_sqm != null ? (
                <span>{room.room_size_sqm} m²</span>
              ) : null}
              {locationLine ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> {locationLine}
                </span>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-bold text-brand-ink">
              {price.amount}
            </div>
            <div className="text-xs text-brand-mute">{price.suffix}</div>
          </div>
        </div>

        {gallery.length > 0 ? (
          <div className="mt-5">
            <PhotoGallery photos={gallery} />
          </div>
        ) : (
          <div className="mt-5 flex h-56 w-full items-center justify-center rounded-card border border-brand-line bg-brand-accent/30 text-brand-primary">
            <BedDouble className="h-10 w-10" />
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-8">
            {room.description ? (
              <section>
                <h2 className="font-display text-lg font-bold text-brand-ink">
                  About this room
                </h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-brand-dark">
                  {room.description}
                </p>
              </section>
            ) : null}

            {beds.length > 0 ? (
              <section>
                <h2 className="font-display text-lg font-bold text-brand-ink">
                  Sleeping arrangement
                </h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {beds.map((b, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-card border border-brand-line bg-white px-3 py-2 text-sm text-brand-dark"
                    >
                      <BedDouble className="h-4 w-4 text-brand-primary" />
                      {b.quantity} × {bedSummary([{ ...b, quantity: 1 }])}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {flags.length > 0 ? (
              <section>
                <h2 className="font-display text-lg font-bold text-brand-ink">
                  Good to know
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {flags.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 py-1 text-xs font-medium text-brand-secondary"
                    >
                      <Check className="h-3.5 w-3.5 text-brand-primary" />
                      {f}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <h2 className="font-display text-lg font-bold text-brand-ink">
                Amenities
              </h2>
              <div className="mt-3">
                <AmenitiesList keys={amenityKeys} />
              </div>
            </section>
          </div>

          {/* Booking summary */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-2xl font-bold text-brand-ink">
                  {price.amount}
                </span>
                <span className="text-sm text-brand-mute">{price.suffix}</span>
              </div>
              <div className="mt-1 text-xs text-brand-mute">
                Sleeps up to {room.max_guests}
                {publicRoom.cleaning_fee > 0
                  ? ` · ${listing.currency === "ZAR" ? "R " : ""}${Math.round(
                      publicRoom.cleaning_fee,
                    )} cleaning`
                  : ""}
              </div>
              <Link
                href={bookHref}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-brand-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
              >
                {listing.booking_mode === "whole_listing"
                  ? "See the full listing"
                  : "Choose dates & book"}
              </Link>
              <div className="mt-2 text-center text-[10px] text-brand-mute">
                You won&rsquo;t be charged yet.
              </div>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
