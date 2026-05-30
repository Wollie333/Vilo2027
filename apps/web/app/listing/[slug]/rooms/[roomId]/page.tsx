import type { Metadata } from "next";
import {
  BadgeCheck,
  Bath,
  BedDouble,
  Check,
  ChevronRight,
  Flag,
  KeyRound,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { createServerClient } from "@/lib/supabase/server";

import { AmenitiesList } from "../../AmenitiesList";
import { PhotoGallery, type GalleryPhoto } from "../../PhotoGallery";
import { bedSummary, roomFlagPills, type PublicRoom } from "../../roomDisplay";
import { RoomBookingWidget } from "./RoomBookingWidget";

export const metadata: Metadata = {
  title: "Room · Vilo",
};

export const dynamic = "force-dynamic";

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

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
      "id, slug, name, city, province, currency, booking_mode, instant_booking, is_published",
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

  const [
    { data: photoRows },
    { data: amenityRows },
    { data: bedRows },
    { data: roomOrderRows },
  ] = await Promise.all([
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
    supabase
      .from("listing_rooms")
      .select("id")
      .eq("listing_id", listing.id)
      .is("deleted_at", null)
      .eq("is_active", true)
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
  const flags = roomFlagPills(publicRoom);
  const locationLine = [listing.city, listing.province, "South Africa"]
    .filter(Boolean)
    .join(", ");

  // Room ordinal among the listing's active rooms ("Room N").
  const orderIndex = (roomOrderRows ?? []).findIndex((r) => r.id === room.id);
  const roomNumber = orderIndex >= 0 ? orderIndex + 1 : 1;

  // Total beds across the room (sum of quantities).
  const totalBeds = beds.reduce((acc, b) => acc + (b.quantity ?? 0), 0);

  // Bathroom tile label.
  const bathCount = room.bathrooms ?? 0;
  const bathLabel = publicRoom.has_ensuite_bathroom
    ? bathCount > 1
      ? `${bathCount} private`
      : "Private"
    : bathCount > 0
      ? `${bathCount}`
      : "Shared";

  // ── "Good to know" pricing line, derived from pricing_mode. ──
  const cleaningSentence =
    publicRoom.cleaning_fee > 0
      ? ` A once-off ${fmtR(publicRoom.cleaning_fee, listing.currency)} cleaning fee applies.`
      : "";
  let pricingLine: string;
  switch (publicRoom.pricing_mode) {
    case "per_person":
      pricingLine = `Priced per person — ${fmtR(
        publicRoom.price_per_person ?? 0,
        listing.currency,
      )} per person, per night.${cleaningSentence}`;
      break;
    case "per_room_plus_extra": {
      const occ = publicRoom.base_occupancy ?? 1;
      pricingLine = `Priced per room — ${fmtR(
        publicRoom.base_price,
        listing.currency,
      )} per night for up to ${occ} guest${occ === 1 ? "" : "s"}, then ${fmtR(
        publicRoom.extra_guest_price ?? 0,
        listing.currency,
      )} per extra guest, per night.${cleaningSentence}`;
      break;
    }
    case "per_room":
    default:
      pricingLine = `Priced per room — ${fmtR(
        publicRoom.base_price,
        listing.currency,
      )} per night, regardless of guests.${cleaningSentence}`;
      break;
  }

  const stats: { icon: typeof Users; label: string; value: string }[] = [
    { icon: Users, label: "Guests", value: `${room.max_guests}` },
    {
      icon: BedDouble,
      label: totalBeds === 1 ? "Bed" : "Beds",
      value: `${totalBeds || beds.length || 1}`,
    },
    {
      icon: Bath,
      label: bathCount === 1 ? "Bath" : "Baths",
      value: bathLabel,
    },
    { icon: KeyRound, label: "Check-in", value: "Self" },
  ];

  const goodToKnow: { icon: typeof Users; title: string; body: string }[] = [
    {
      icon: BadgeCheck,
      title: "Pricing",
      body: pricingLine,
    },
    {
      icon: KeyRound,
      title: "Self check-in",
      body: "The host shares arrival details the day before.",
    },
    {
      icon: ShieldCheck,
      title: "Book directly, no booking fee",
      body: "You pay the price you see. Vilo holds payment until your stay is confirmed.",
    },
  ];

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-5 pb-28 pt-6 lg:px-8 lg:pb-12 lg:pt-8">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1 text-xs text-brand-mute">
          {listing.province ? (
            <>
              <span>{listing.province}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </>
          ) : null}
          <Link
            href={`/listing/${listing.slug}`}
            className="hover:text-brand-primary"
          >
            {listing.name}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-brand-ink">{room.name}</span>
        </nav>

        {/* Header */}
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
              Room {roomNumber} — {room.name}
            </h1>
            <div className="mt-1 text-sm text-brand-mute">{locationLine}</div>
            <Link
              href={`/listing/${listing.slug}`}
              className="mt-0.5 inline-block text-sm text-brand-primary hover:underline"
            >
              Part of {listing.name}
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 py-1.5 font-medium text-brand-ink transition-colors hover:bg-brand-light"
            >
              Share
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 py-1.5 font-medium text-brand-ink transition-colors hover:bg-brand-light"
            >
              Save
            </button>
          </div>
        </div>

        {/* Gallery */}
        {gallery.length > 0 ? (
          <div className="mt-5">
            <PhotoGallery photos={gallery} />
          </div>
        ) : (
          <div className="mt-5 flex h-56 w-full items-center justify-center rounded-card border border-brand-line bg-brand-accent/30 text-brand-primary">
            <BedDouble className="h-10 w-10" />
          </div>
        )}

        {/* Stats grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-card border border-brand-line bg-white p-4 shadow-card"
            >
              <s.icon className="h-5 w-5 text-brand-primary" />
              <div className="num mt-2 font-display text-lg font-bold tabular-nums text-brand-ink">
                {s.value}
              </div>
              <div className="text-xs text-brand-mute">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          {/* Left column */}
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

            {flags.length > 0 ? (
              <section>
                <div className="flex flex-wrap gap-2">
                  {flags.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-secondary"
                    >
                      <Check className="h-3.5 w-3.5 text-brand-primary" />
                      {f}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="border-t border-brand-line pt-8">
              <h2 className="font-display text-lg font-bold text-brand-ink">
                Sleeping arrangement
              </h2>
              <p className="mt-1 text-sm text-brand-mute">
                {beds.length || 1} bed{(beds.length || 1) === 1 ? "" : "s"} ·
                sleeps up to {room.max_guests} guest
                {room.max_guests === 1 ? "" : "s"}
              </p>
              {beds.length > 0 ? (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {beds.map((b, i) => (
                    <li
                      key={i}
                      className="rounded-card border border-brand-line bg-white p-4 shadow-card"
                    >
                      <BedDouble className="h-6 w-6 text-brand-primary" />
                      <div className="mt-2 text-sm font-semibold text-brand-ink">
                        Bed {i + 1}
                      </div>
                      <div className="text-xs text-brand-mute">
                        {b.quantity} × {bedSummary([{ ...b, quantity: 1 }])}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="border-t border-brand-line pt-8">
              <h2 className="font-display text-lg font-bold text-brand-ink">
                What this room offers
              </h2>
              <div className="mt-4">
                <AmenitiesList keys={amenityKeys} />
              </div>
            </section>

            <section className="border-t border-brand-line pt-8">
              <h2 className="font-display text-lg font-bold text-brand-ink">
                Good to know
              </h2>
              <ul className="mt-4 space-y-4">
                {goodToKnow.map((g) => (
                  <li key={g.title} className="flex items-start gap-3">
                    <g.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" />
                    <div>
                      <div className="text-sm font-semibold text-brand-ink">
                        {g.title}
                      </div>
                      <p className="text-sm leading-relaxed text-brand-mute">
                        {g.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
              <h3 className="font-display text-base font-bold text-brand-ink">
                This room is part of {listing.name}
              </h3>
              <p className="mt-1 text-sm text-brand-mute">
                Browse the full property, other rooms, and house policies.
              </p>
              <Link
                href={`/listing/${listing.slug}`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:underline"
              >
                See the full listing
                <ChevronRight className="h-4 w-4" />
              </Link>
            </section>

            <div>
              <Link
                href="/help"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-mute hover:text-brand-primary"
              >
                <Flag className="h-3.5 w-3.5" />
                Report this room
              </Link>
            </div>
          </div>

          {/* Right column — sticky booking widget */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <RoomBookingWidget
              roomId={room.id}
              listingSlug={listing.slug}
              currency={listing.currency}
              bookingMode={listing.booking_mode}
              instantBook={listing.instant_booking ?? false}
              pricing={{
                pricing_mode: publicRoom.pricing_mode,
                base_price: publicRoom.base_price,
                price_per_person: publicRoom.price_per_person,
                base_occupancy: publicRoom.base_occupancy,
                extra_guest_price: publicRoom.extra_guest_price,
              }}
              cleaningFee={publicRoom.cleaning_fee}
              maxGuests={room.max_guests}
            />
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
