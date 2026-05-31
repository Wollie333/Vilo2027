import type { Metadata } from "next";
import {
  Award,
  BadgeCheck,
  Ban,
  Clock,
  Flag,
  Heart,
  Info,
  Key,
  LogOut,
  MapPin,
  RotateCcw,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Zap,
} from "lucide-react";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { UtilityBar } from "@/app/_components/home/UtilityBar";
import { ListingPolicyBlock } from "@/components/policy/ListingPolicyBlock";
import { sanitiseListingHtml, stripHtml } from "@/lib/sanitiseHtml";
import { createServerClient } from "@/lib/supabase/server";

import { AboutCollapsible } from "./AboutCollapsible";
import { AmenitiesList } from "./AmenitiesList";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import { BookingWidget } from "./BookingWidget";
import { Breadcrumb } from "./Breadcrumb";
import { RoomsCalendarSection } from "./RoomsCalendarSection";
import { TrustCard } from "./TrustCard";
import { HostCard } from "./HostCard";
import { PhotoGallery, type GalleryPhoto } from "./PhotoGallery";
import { RatesSection, type SeasonRow } from "./RatesSection";
import { RoomsCartProvider, type BookingMode } from "./RoomsCartProvider";
import { RoomsCartSidebar } from "./RoomsCartSidebar";
import { RoomsGrid, type PublicRoom } from "./RoomsGrid";
import { RoomsInfoGrid } from "./RoomsInfoGrid";
import { WholeListingToggle } from "./WholeListingToggle";

// Always read live listing/room/add-on data — never serve it from Next's Data
// Cache, which would otherwise freeze Supabase `.select()` GETs and show stale
// availability. (Mirrors the sibling rooms/[roomId] and /book pages.)
export const dynamic = "force-dynamic";

type RawListing = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  listing_type: "accommodation";
  accommodation_type: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  max_guests: number | null;
  min_nights: number | null;
  check_in_time: string | null;
  check_out_time: string | null;
  base_price: number | null;
  weekend_price: number | null;
  cleaning_fee: number | null;
  currency: string;
  booking_mode: BookingMode;
  cancellation_policy: "flexible" | "moderate" | "strict";
  house_rules: string | null;
  instant_booking: boolean;
  whole_listing_discount_pct: number | null;
  weekly_discount_pct: number | null;
  monthly_discount_pct: number | null;
  avg_rating: number | null;
  total_reviews: number | null;
  host: {
    display_name: string;
    handle: string;
    bio: string | null;
    avatar_url: string | null;
    is_verified: boolean;
    is_superhost: boolean;
    response_rate: number | null;
    avg_response_hours: number | null;
    languages_spoken: string[] | null;
    highlights: string[] | null;
    phone_verified: boolean;
    payout_verified: boolean;
    created_at: string;
  };
};

const CANCELLATION_BLURB: Record<RawListing["cancellation_policy"], string> = {
  flexible: "Full refund up to 24 hours before check-in.",
  moderate: "Full refund up to 5 days before check-in.",
  strict: "50% refund up to 7 days before. No refund after.",
};

const ACC_LABEL: Record<string, string> = {
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  bb: "B&B",
  self_catering: "Self-catering",
  lodge: "Lodge",
  other: "Stay",
};

function typeLabel(l: RawListing): string {
  return ACC_LABEL[l.accommodation_type ?? "other"] ?? "Stay";
}

function locationLabel(l: RawListing): string {
  return [l.city, l.province].filter(Boolean).join(", ");
}

async function loadListing(slug: string) {
  const supabase = createServerClient();
  // RLS `public_read_published` filters out unpublished + deleted listings.
  const { data: listing } = await supabase
    .from("listings")
    .select(
      `
        id, slug, name, description,
        listing_type, accommodation_type,
        city, province, country, latitude, longitude,
        bedrooms, bathrooms, max_guests, min_nights,
        check_in_time, check_out_time,
        base_price, weekend_price, cleaning_fee, currency, booking_mode,
        cancellation_policy, house_rules, instant_booking,
        whole_listing_discount_pct, weekly_discount_pct, monthly_discount_pct,
        avg_rating, total_reviews,
        host:hosts!inner (
          display_name, handle, bio, avatar_url, is_verified,
          is_superhost, response_rate, avg_response_hours,
          languages_spoken, highlights, phone_verified, payout_verified,
          created_at
        )
      `,
    )
    .eq("slug", slug)
    .maybeSingle<RawListing>();

  if (!listing) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const [
    { data: photoRows },
    { data: amenityRows },
    { data: roomRows },
    { data: seasonRows },
    { data: blockedRows },
  ] = await Promise.all([
    supabase
      .from("listing_photos")
      .select("id, url, sort_order, room_id")
      .eq("listing_id", listing.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("listing_amenities")
      .select("amenity_key")
      .eq("listing_id", listing.id),
    // Rooms are fetched for every mode now — they're descriptive on
    // whole-place listings (bedroom layout, beds, flags) and bookable
    // on per-room / flexible.
    supabase
      .from("listing_rooms")
      .select(
        "id, name, description, bedrooms, bathrooms, max_guests, base_price, cleaning_fee, pricing_mode, price_per_person, base_occupancy, extra_guest_price, sort_order, is_active, room_size_sqm, view_type, has_ensuite_bathroom, pets_allowed, wheelchair_accessible, private_entrance, smoking_allowed, floor_number, inventory_count, beds:room_beds ( bed_kind, quantity, sort_order )",
      )
      .eq("listing_id", listing.id)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("listing_seasonal_pricing")
      .select("id, label, start_date, end_date, price, room_id, priority")
      .eq("listing_id", listing.id)
      .eq("is_active", true)
      .order("start_date", { ascending: true }),
    // Whole-listing blocks (room_id NULL) from today on — drives the
    // availability calendar's unavailable days.
    supabase
      .from("blocked_dates")
      .select("date")
      .eq("listing_id", listing.id)
      .is("room_id", null)
      .gte("date", todayStr),
  ]);

  const galleryPhotos: GalleryPhoto[] = (photoRows ?? []).map((r) => ({
    id: r.id,
    url: r.url,
  }));
  const amenities = (amenityRows ?? []).map((r) => r.amenity_key);

  // First photo per room (if any) as the room thumbnail.
  const firstPhotoByRoom = new Map<string, string>();
  for (const p of photoRows ?? []) {
    const rid = (p as { room_id: string | null }).room_id;
    if (rid && !firstPhotoByRoom.has(rid)) firstPhotoByRoom.set(rid, p.url);
  }

  const rooms: PublicRoom[] = (
    (roomRows ?? []) as Array<{
      id: string;
      name: string;
      description: string | null;
      bedrooms: number | null;
      bathrooms: number | null;
      max_guests: number;
      base_price: number | string;
      cleaning_fee: number | string | null;
      pricing_mode: string | null;
      price_per_person: number | string | null;
      base_occupancy: number | null;
      extra_guest_price: number | string | null;
      sort_order: number;
      is_active: boolean;
      room_size_sqm: number | string | null;
      view_type: string | null;
      has_ensuite_bathroom: boolean | null;
      pets_allowed: boolean | null;
      wheelchair_accessible: boolean | null;
      private_entrance: boolean | null;
      smoking_allowed: boolean | null;
      floor_number: number | null;
      inventory_count: number | null;
      beds: Array<{
        bed_kind: string;
        quantity: number;
        sort_order: number;
      }> | null;
    }>
  ).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    max_guests: r.max_guests,
    base_price: Number(r.base_price),
    cleaning_fee: Number(r.cleaning_fee ?? 0),
    pricing_mode: (r.pricing_mode ?? "per_room") as PublicRoom["pricing_mode"],
    price_per_person:
      r.price_per_person == null ? null : Number(r.price_per_person),
    base_occupancy: r.base_occupancy ?? null,
    extra_guest_price:
      r.extra_guest_price == null ? null : Number(r.extra_guest_price),
    photoUrl: firstPhotoByRoom.get(r.id) ?? null,
    room_size_sqm: r.room_size_sqm == null ? null : Number(r.room_size_sqm),
    view_type: r.view_type ?? null,
    has_ensuite_bathroom: r.has_ensuite_bathroom ?? false,
    pets_allowed: r.pets_allowed ?? false,
    wheelchair_accessible: r.wheelchair_accessible ?? false,
    private_entrance: r.private_entrance ?? false,
    smoking_allowed: r.smoking_allowed ?? false,
    floor_number: r.floor_number ?? null,
    inventory_count: r.inventory_count ?? 1,
    beds: (r.beds ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((b) => ({ bed_kind: b.bed_kind, quantity: b.quantity })),
  }));

  // Postgres returns numeric columns as strings over PostgREST. Coerce them so
  // downstream `.toFixed()` / arithmetic don't crash (e.g. "0".toFixed is not a
  // function) — note `?? 0` does NOT help when the value is a non-null string.
  const toNum = (v: unknown): number | null =>
    v == null || v === "" ? null : Number(v);
  const coercedListing = {
    ...listing,
    base_price: toNum(listing.base_price),
    weekend_price: toNum(listing.weekend_price),
    cleaning_fee: toNum(listing.cleaning_fee),
    avg_rating: toNum(listing.avg_rating),
    total_reviews: toNum(listing.total_reviews),
    latitude: toNum(listing.latitude),
    longitude: toNum(listing.longitude),
    whole_listing_discount_pct: toNum(listing.whole_listing_discount_pct),
    weekly_discount_pct: toNum(listing.weekly_discount_pct),
    monthly_discount_pct: toNum(listing.monthly_discount_pct),
  };

  const seasons: SeasonRow[] = (
    (seasonRows ?? []) as Array<{
      id: string;
      label: string;
      start_date: string;
      end_date: string;
      price: number | string;
      room_id: string | null;
      priority: number;
    }>
  ).map((r) => ({
    id: r.id,
    label: r.label,
    startDate: r.start_date,
    endDate: r.end_date,
    price: Number(r.price),
    roomId: r.room_id,
    priority: r.priority,
  }));

  const unavailableDates = ((blockedRows ?? []) as Array<{ date: string }>).map(
    (r) => r.date,
  );

  return {
    listing: coercedListing,
    photos: galleryPhotos,
    amenities,
    rooms,
    seasons,
    unavailableDates,
  };
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await loadListing(params.slug);
  if (!data) return { title: "Listing not found · Vilo" };
  const { listing } = data;
  const where = locationLabel(listing);
  const plain = listing.description ? stripHtml(listing.description) : "";
  return {
    title: `${listing.name}${where ? ` · ${where}` : ""} · Vilo`,
    description:
      plain.length > 0
        ? plain.slice(0, 200)
        : `Direct booking with ${listing.host.display_name} on Vilo.`,
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const data = await loadListing(params.slug);
  if (!data) notFound();
  const { listing, photos, amenities, rooms, seasons, unavailableDates } = data;

  const hasRoomsMode = listing.booking_mode !== "whole_listing";

  const ratesNode =
    rooms.length > 0 || seasons.length > 0 ? (
      <RatesSection
        rooms={rooms}
        seasons={seasons}
        basePrice={listing.base_price}
        weekendPrice={listing.weekend_price}
        cleaningFee={listing.cleaning_fee}
        currency={listing.currency}
        weeklyDiscountPct={listing.weekly_discount_pct}
      />
    ) : null;

  return (
    <div className="bg-white text-brand-ink">
      <UtilityBar />
      <SiteHeader />
      <Breadcrumb
        country={listing.country}
        province={listing.province}
        city={listing.city}
        name={listing.name}
      />

      <main className="mx-auto max-w-7xl px-5 pb-24 lg:px-8 lg:pb-12">
        <TitleStrip listing={listing} />

        <div className="mt-6">
          <PhotoGallery photos={photos} />
        </div>

        {hasRoomsMode ? (
          <RoomsCartProvider mode={listing.booking_mode}>
            <ListingBody
              listing={listing}
              amenities={amenities}
              showRoomsGrid
              roomsNode={
                <RoomsGrid rooms={rooms} currency={listing.currency} />
              }
              roomsHeaderAction={
                <WholeListingToggle
                  roomIds={rooms.map((r) => r.id)}
                  discountPct={listing.whole_listing_discount_pct}
                />
              }
              ratesNode={ratesNode}
              calendarNode={
                <RoomsCalendarSection unavailable={unavailableDates} />
              }
              sidebarNode={
                <RoomsCartSidebar
                  slug={listing.slug ?? params.slug}
                  rooms={rooms}
                  currency={listing.currency}
                  maxGuestsCap={listing.max_guests ?? 50}
                  instantBooking={listing.instant_booking}
                  rating={listing.avg_rating}
                  reviewCount={listing.total_reviews}
                  basePrice={listing.base_price}
                  cleaningFee={listing.cleaning_fee}
                  wholeDiscountPct={listing.whole_listing_discount_pct}
                  weeklyDiscountPct={listing.weekly_discount_pct}
                  monthlyDiscountPct={listing.monthly_discount_pct}
                />
              }
            />
          </RoomsCartProvider>
        ) : (
          <ListingBody
            listing={listing}
            amenities={amenities}
            showRoomsGrid={rooms.length > 0}
            roomsNode={
              rooms.length > 0 ? <RoomsInfoGrid rooms={rooms} /> : null
            }
            ratesNode={ratesNode}
            calendarNode={
              unavailableDates.length > 0 ? (
                <section
                  id="sec-calendar"
                  className="border-b border-brand-line py-7"
                >
                  <h3 className="font-display text-xl font-bold text-brand-ink">
                    Availability
                  </h3>
                  <p className="mt-1 text-sm text-brand-mute">
                    Dates the host has blocked or that are already booked.
                  </p>
                  <div className="mt-5">
                    <AvailabilityCalendar
                      unavailable={unavailableDates}
                      from=""
                      to=""
                    />
                  </div>
                </section>
              ) : null
            }
            sidebarNode={
              <BookingWidget
                slug={listing.slug ?? params.slug}
                basePrice={listing.base_price}
                cleaningFee={listing.cleaning_fee}
                currency={listing.currency}
                maxGuests={listing.max_guests}
                instantBooking={listing.instant_booking}
                rating={listing.avg_rating}
                reviewCount={listing.total_reviews}
                weeklyDiscountPct={listing.weekly_discount_pct}
                monthlyDiscountPct={listing.monthly_discount_pct}
              />
            }
          />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function TitleStrip({ listing }: { listing: RawListing }) {
  const hasReviews =
    listing.avg_rating != null &&
    listing.total_reviews != null &&
    listing.total_reviews > 0;
  const isFavourite =
    hasReviews &&
    (listing.avg_rating ?? 0) >= 4.8 &&
    (listing.total_reviews ?? 0) >= 10;

  return (
    <div className="flex flex-col gap-4 pt-6 md:flex-row md:items-start lg:pt-8">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-pill border border-brand-line bg-brand-light px-2.5 py-0.5 text-[11px] font-semibold text-brand-secondary">
            {typeLabel(listing)}
          </span>
          {listing.host.is_superhost ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-brand-accent px-2.5 py-0.5 text-[11px] font-semibold text-[#065F46]">
              <Award className="h-3 w-3" /> Superhost
            </span>
          ) : null}
          {listing.host.is_verified ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-brand-accent px-2.5 py-0.5 text-[11px] font-semibold text-brand-secondary">
              <BadgeCheck className="h-3 w-3" /> Verified host
            </span>
          ) : null}
          {isFavourite ? (
            <span className="inline-flex items-center gap-1 rounded-pill border border-brand-line bg-brand-light px-2.5 py-0.5 text-[11px] font-semibold text-brand-secondary">
              <Sparkles className="h-3 w-3" /> Guest favourite
            </span>
          ) : null}
          {listing.instant_booking ? (
            <span className="inline-flex items-center gap-1 rounded-pill border border-brand-line bg-brand-light px-2.5 py-0.5 text-[11px] font-semibold text-brand-secondary">
              <Zap className="h-3 w-3" /> Instant book
            </span>
          ) : null}
        </div>

        <h1 className="text-balance font-display text-[28px] font-bold leading-[1.05] tracking-tight text-brand-ink sm:text-[34px] lg:text-[40px]">
          {listing.name}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-brand-mute">
          {hasReviews ? (
            <span className="inline-flex items-center gap-1.5 text-brand-ink">
              <Star className="h-4 w-4 fill-brand-ink stroke-brand-ink" />
              <span className="font-semibold">
                {(listing.avg_rating ?? 0).toFixed(2)}
              </span>
              <span className="text-brand-mute">·</span>
              <a
                href="#sec-reviews"
                className="underline underline-offset-2 hover:text-brand-primary"
              >
                {listing.total_reviews} review
                {listing.total_reviews === 1 ? "" : "s"}
              </a>
            </span>
          ) : null}
          {locationLabel(listing) ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              <a
                href="#sec-policies"
                className="underline underline-offset-2 hover:text-brand-ink"
              >
                {locationLabel(listing)}
              </a>
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col items-stretch gap-3 md:ml-auto md:w-auto md:items-end">
        <TrustCard
          hostName={listing.host.display_name}
          avatarUrl={listing.host.avatar_url}
          isVerified={listing.host.is_verified}
          avgResponseHours={listing.host.avg_response_hours}
          hostingSince={listing.host.created_at}
          rating={listing.avg_rating}
          reviewCount={listing.total_reviews}
        />
        <div className="flex items-center gap-2 md:self-end">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded border border-brand-line px-3 py-2 text-sm text-brand-ink hover:bg-brand-light"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded border border-brand-line px-3 py-2 text-sm text-brand-ink hover:bg-brand-light"
          >
            <Heart className="h-4 w-4" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

function SubNav({ links }: { links: { id: string; label: string }[] }) {
  return (
    <div className="sticky top-16 z-30 -mx-5 mt-8 border-b border-brand-line bg-white/95 px-5 backdrop-blur lg:-mx-8 lg:px-8">
      <div className="hscroll flex items-center gap-6 overflow-x-auto">
        {links.map((l) => (
          <a
            key={l.id}
            href={`#${l.id}`}
            className="whitespace-nowrap border-b-2 border-transparent py-3.5 text-[13px] font-medium text-brand-mute transition-colors hover:border-brand-ink hover:text-brand-ink"
          >
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function ListingBody({
  listing,
  amenities,
  showRoomsGrid,
  roomsNode,
  roomsHeaderAction,
  ratesNode,
  calendarNode,
  sidebarNode,
}: {
  listing: RawListing;
  amenities: string[];
  showRoomsGrid: boolean;
  roomsNode: React.ReactNode;
  roomsHeaderAction?: React.ReactNode;
  ratesNode?: React.ReactNode;
  calendarNode?: React.ReactNode;
  sidebarNode: React.ReactNode;
}) {
  const hasReviews =
    listing.avg_rating != null &&
    listing.total_reviews != null &&
    listing.total_reviews > 0;
  const sectionLinks = [
    { id: "sec-overview", label: "Overview" },
    { id: "sec-amenities", label: "Amenities" },
    ...(showRoomsGrid ? [{ id: "sec-rooms", label: "Rooms" }] : []),
    ...(ratesNode ? [{ id: "sec-rates", label: "Rates" }] : []),
    ...(calendarNode ? [{ id: "sec-calendar", label: "Calendar" }] : []),
    ...(hasReviews ? [{ id: "sec-reviews", label: "Reviews" }] : []),
    { id: "sec-host", label: "Host" },
    { id: "sec-policies", label: "Things to know" },
  ];

  return (
    <>
      <SubNav links={sectionLinks} />

      <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="min-w-0 lg:col-span-7 xl:col-span-8">
          {/* HOST STRIP */}
          <section
            id="sec-overview"
            className="flex items-start justify-between gap-4 border-b border-brand-line pb-7"
          >
            <div className="flex min-w-0 items-start gap-4">
              <div className="relative shrink-0">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-brand-accent font-display text-base font-bold text-brand-secondary">
                  {listing.host.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={listing.host.avatar_url}
                      alt={listing.host.display_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    listing.host.display_name.slice(0, 2).toUpperCase()
                  )}
                </div>
                {listing.host.is_verified ? (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-brand-primary text-white">
                    <BadgeCheck className="h-3 w-3" />
                  </span>
                ) : null}
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-xl font-bold leading-tight text-brand-ink">
                  {typeLabel(listing)} hosted by {listing.host.display_name}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-brand-mute">
                  {listing.bedrooms != null ? (
                    <span>
                      {listing.bedrooms} bedroom
                      {listing.bedrooms === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  {listing.bathrooms != null ? (
                    <>
                      <span>·</span>
                      <span>
                        {listing.bathrooms} bathroom
                        {listing.bathrooms === 1 ? "" : "s"}
                      </span>
                    </>
                  ) : null}
                  {listing.max_guests != null ? (
                    <>
                      <span>·</span>
                      <span>sleeps up to {listing.max_guests}</span>
                    </>
                  ) : null}
                </div>
                {listing.host.is_verified ? (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-brand-mute">
                    <BadgeCheck className="h-3.5 w-3.5 text-brand-primary" />
                    Identity verified
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {/* HIGHLIGHTS */}
          <section className="space-y-5 border-b border-brand-line py-7">
            {listing.instant_booking ? (
              <Highlight
                icon={<Zap className="h-5 w-5" />}
                title="Instant book"
                body="Confirm your stay immediately — no waiting on the host."
              />
            ) : null}
            <Highlight
              icon={<Key className="h-5 w-5" />}
              title="Smooth check-in"
              body={
                listing.check_in_time
                  ? `Check-in from ${listing.check_in_time.slice(0, 5)} — the host shares full directions ahead of arrival.`
                  : "The host shares full directions ahead of arrival."
              }
            />
            <Highlight
              icon={<RotateCcw className="h-5 w-5" />}
              title={`${listing.cancellation_policy[0].toUpperCase()}${listing.cancellation_policy.slice(1)} cancellation`}
              body={
                <>
                  {CANCELLATION_BLURB[listing.cancellation_policy]}{" "}
                  <a
                    href="#sec-policies"
                    className="text-brand-primary underline underline-offset-2"
                  >
                    See policy
                  </a>
                  .
                </>
              }
            />
            {listing.host.is_verified ? (
              <Highlight
                icon={<ShieldCheck className="h-5 w-5" />}
                title="Verified host"
                body="Identity and payment details verified by Vilo."
              />
            ) : null}
          </section>

          {/* ABOUT — HTML produced by Tiptap in the host editor. Always
              sanitised server-side via sanitiseListingHtml before render. */}
          {listing.description ? (
            <section className="border-b border-brand-line py-7">
              <h3 className="font-display text-xl font-bold text-brand-ink">
                About this place
              </h3>
              <AboutCollapsible
                html={sanitiseListingHtml(listing.description)}
              />
            </section>
          ) : null}

          {/* AMENITIES */}
          <section
            id="sec-amenities"
            className="border-b border-brand-line py-7"
          >
            <h3 className="font-display text-xl font-bold text-brand-ink">
              What this place offers
            </h3>
            <div className="mt-5">
              <AmenitiesList keys={amenities} />
            </div>
          </section>

          {/* ROOMS */}
          {showRoomsGrid ? (
            <section id="sec-rooms" className="border-b border-brand-line py-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-bold text-brand-ink">
                    {listing.booking_mode === "flexible"
                      ? "Or pick specific rooms"
                      : listing.booking_mode === "whole_listing"
                        ? "Rooms in this place"
                        : "Choose your room(s)"}
                  </h3>
                  {listing.booking_mode !== "whole_listing" ? (
                    <p className="mt-1 text-sm text-brand-mute">
                      Tap to select. Book one room, a few, or the whole place.
                    </p>
                  ) : null}
                </div>
                {roomsHeaderAction}
              </div>
              <div className="mt-5">{roomsNode}</div>
              {listing.booking_mode !== "whole_listing" ? (
                <p className="mt-4 inline-flex items-start gap-1.5 text-[11.5px] leading-relaxed text-brand-mute">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  You can adjust your room selection again at checkout.
                </p>
              ) : null}
            </section>
          ) : null}

          {/* RATES & SEASONAL PRICING */}
          {ratesNode}

          {/* AVAILABILITY CALENDAR */}
          {calendarNode}

          {/* REVIEWS — summary card only (full reviews list not loaded here) */}
          {hasReviews ? (
            <section
              id="sec-reviews"
              className="border-b border-brand-line py-7"
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
                    Reviews
                  </div>
                  <h3 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-ink lg:text-3xl">
                    What guests are saying
                  </h3>
                </div>
              </div>

              <div className="mt-6 grid items-center gap-8 rounded-card border border-brand-line bg-gradient-to-br from-brand-light to-white p-6 lg:grid-cols-12 lg:p-8">
                <div className="text-center lg:col-span-5 lg:text-left">
                  <div className="flex items-baseline justify-center gap-2 lg:justify-start">
                    <span className="font-display text-[68px] font-extrabold leading-none tracking-tight text-brand-ink lg:text-[80px]">
                      {(listing.avg_rating ?? 0).toFixed(2)}
                    </span>
                    <span className="font-display text-2xl text-brand-mute">
                      / 5
                    </span>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-0.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star
                        key={i}
                        className="h-5 w-5 fill-brand-ink stroke-brand-ink"
                      />
                    ))}
                  </div>
                  <div className="mt-2.5 text-sm text-brand-mute">
                    From{" "}
                    <span className="font-mono font-semibold text-brand-ink">
                      {listing.total_reviews}
                    </span>{" "}
                    verified stay
                    {listing.total_reviews === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="lg:col-span-7">
                  <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                    Rating trust
                  </div>
                  <div className="rounded border border-brand-line bg-white/70 p-4 text-sm leading-relaxed text-brand-dark">
                    <p className="inline-flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                      <span>
                        Vilo only lets guests who completed a stay leave a
                        review. Every score above is from a verified booking.
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {/* HOST */}
          <section id="sec-host" className="border-b border-brand-line py-7">
            <h3 className="mb-4 font-display text-xl font-bold text-brand-ink">
              Meet your host
            </h3>
            <HostCard
              displayName={listing.host.display_name}
              handle={listing.host.handle}
              bio={listing.host.bio}
              avatarUrl={listing.host.avatar_url}
              isVerified={listing.host.is_verified}
            />
            <p className="mt-5 rounded border border-brand-line bg-brand-light/50 p-3 text-[12px] leading-relaxed text-brand-mute">
              <Shield className="mr-1 inline-block h-3.5 w-3.5 align-text-bottom text-brand-mute" />
              For your safety, never transfer money or chat outside Vilo.
            </p>
          </section>

          {/* THINGS TO KNOW */}
          <section id="sec-policies" className="py-7">
            <h3 className="font-display text-xl font-bold text-brand-ink">
              Things to know
            </h3>
            <div className="mt-5 grid gap-6 md:grid-cols-3">
              <div>
                <div className="font-display font-semibold text-brand-ink">
                  House rules
                </div>
                <ul className="mt-3 space-y-2 text-sm text-brand-ink/85">
                  <li className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-brand-mute" /> Check-in after{" "}
                    {listing.check_in_time?.slice(0, 5) ?? "—"}
                  </li>
                  <li className="flex items-center gap-2">
                    <LogOut className="h-4 w-4 text-brand-mute" /> Check-out by{" "}
                    {listing.check_out_time?.slice(0, 5) ?? "—"}
                  </li>
                  {listing.max_guests != null ? (
                    <li className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-brand-mute" />{" "}
                      {listing.max_guests} guests maximum
                    </li>
                  ) : null}
                  {listing.min_nights != null ? (
                    <li className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-brand-mute" />{" "}
                      {listing.min_nights} night
                      {listing.min_nights === 1 ? "" : "s"} minimum
                    </li>
                  ) : null}
                </ul>
                {listing.house_rules ? (
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-brand-dark">
                    {listing.house_rules}
                  </p>
                ) : null}
              </div>
              <div>
                <div className="font-display font-semibold text-brand-ink">
                  Safety &amp; property
                </div>
                <ul className="mt-3 space-y-2 text-sm text-brand-ink/85">
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-brand-mute" /> Vilo
                    holds payments until check-in
                  </li>
                  <li className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-brand-mute" /> Host
                    identity verified
                  </li>
                  <li className="flex items-center gap-2">
                    <Ban className="h-4 w-4 text-brand-mute" /> No parties or
                    events
                  </li>
                </ul>
              </div>
              <div>
                <div className="font-display font-semibold text-brand-ink">
                  Cancellation
                </div>
                <p className="mt-3 text-sm leading-relaxed text-brand-dark">
                  <span className="font-medium capitalize">
                    {listing.cancellation_policy}.
                  </span>{" "}
                  {CANCELLATION_BLURB[listing.cancellation_policy]}
                </p>
              </div>
            </div>

            {/* Assigned policies with read-the-full-text popups. Renders nothing
                when none are assigned, leaving the legacy summary above. */}
            <ListingPolicyBlock listingId={listing.id} className="mt-6" />

            <button
              type="button"
              className="mt-7 inline-flex items-center gap-1.5 text-xs text-brand-mute underline underline-offset-2 hover:text-brand-ink"
            >
              <Flag className="h-3.5 w-3.5" /> Report this listing
            </button>
          </section>
        </div>

        <aside className="lg:col-span-5 xl:col-span-4">{sidebarNode}</aside>
      </div>
    </>
  );
}

function Highlight({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-brand-accent text-brand-secondary">
        {icon}
      </div>
      <div>
        <div className="font-display font-semibold text-brand-ink">{title}</div>
        <div className="mt-0.5 text-sm leading-relaxed text-brand-mute">
          {body}
        </div>
      </div>
    </div>
  );
}
