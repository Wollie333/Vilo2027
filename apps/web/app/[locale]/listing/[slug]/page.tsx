import type { Metadata } from "next";
import {
  BadgeCheck,
  Flag,
  Info,
  Key,
  RotateCcw,
  Shield,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { ThingsToKnow } from "@/components/policy/ThingsToKnow";
import { getBrandName } from "@/lib/brand";
import {
  cancellationNote,
  getListingPolicySummary,
  type ListingPolicySummary,
} from "@/lib/policy/listing-summary";
import { type SeasonalRule } from "@/lib/pricing";
import { sanitiseListingHtml, stripHtml } from "@/lib/sanitiseHtml";
import { createServerClient } from "@/lib/supabase/server";

import { AboutCollapsible } from "./AboutCollapsible";
import { AmenitiesList } from "./AmenitiesList";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import { ListingHero } from "./ListingHero";
import { LocationSection, type Poi } from "./LocationSection";
import { SimilarListings } from "./SimilarListings";
import { SuitabilityChips } from "./SuitabilityChips";
import { TrustCard } from "./TrustCard";
import { HostCard } from "./HostCard";
import { PhotoGallery, type GalleryPhoto } from "./PhotoGallery";
import { RatesSection, type SeasonRow } from "./RatesSection";
import { RequestQuoteButton } from "./RequestQuoteButton";
import { ReservePanel } from "./ReservePanel";
import { loadListingReviews } from "./reviews-data";
import { ReviewsSection } from "./ReviewsSection";
import { type BookingMode, type PublicRoom } from "./roomDisplay";
import { RoomsInfoGrid } from "./RoomsInfoGrid";
import { StickySubnav } from "./StickySubnav";

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
  allow_children: boolean | null;
  allow_infants: boolean | null;
  allow_pets: boolean | null;
  child_price: number | null;
  infant_price: number | null;
  pet_fee: number | null;
  infant_max_age: number | null;
  child_max_age: number | null;
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

type GuestPrefill = {
  isAuthed: boolean;
  name: string;
  email: string;
  phone: string;
};

// Read the signed-in guest's contact details (if any) to prefill the
// quote-request form. Anonymous visitors get a non-authed blank prefill.
async function loadGuestPrefill(): Promise<GuestPrefill> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { isAuthed: false, name: "", email: "", phone: "" };
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();
  return {
    isAuthed: true,
    name: profile?.full_name ?? "",
    email: user.email ?? "",
    phone: profile?.phone ?? "",
  };
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
        allow_children, allow_infants, allow_pets,
        child_price, infant_price, pet_fee, infant_max_age, child_max_age,
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
    { data: poiRows },
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
        "id, name, description, bedrooms, bathrooms, max_guests, base_price, weekend_price, cleaning_fee, pricing_mode, price_per_person, base_occupancy, extra_guest_price, sort_order, is_active, room_size_sqm, view_type, has_ensuite_bathroom, pets_allowed, wheelchair_accessible, private_entrance, smoking_allowed, floor_number, inventory_count, beds:room_beds ( bed_kind, quantity, sort_order )",
      )
      .eq("listing_id", listing.id)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("listing_seasonal_pricing")
      .select(
        "id, label, start_date, end_date, adjustment_type, adjustment_value, room_id, priority, min_nights, is_active, created_at",
      )
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
    supabase
      .from("listing_points_of_interest")
      .select("id, category, name, travel_time, sort_order")
      .eq("listing_id", listing.id)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true }),
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
      weekend_price: number | string | null;
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
    weekend_price: r.weekend_price == null ? null : Number(r.weekend_price),
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

  // Reference base a season is measured against — its room's base, else the
  // listing base. Lets us resolve a percent rule's display nightly.
  const listingBaseNum = toNum(listing.base_price) ?? 0;
  const roomBaseById = new Map(rooms.map((r) => [r.id, r.base_price]));
  const seasonRowsTyped = (seasonRows ?? []) as Array<{
    id: string;
    label: string;
    start_date: string;
    end_date: string;
    adjustment_type: string;
    adjustment_value: number | string;
    room_id: string | null;
    priority: number;
    min_nights: number | null;
    is_active: boolean;
    created_at: string | null;
  }>;
  const seasonDisplayPrice = (r: (typeof seasonRowsTyped)[number]): number => {
    const value = Number(r.adjustment_value);
    if (r.adjustment_type === "percent") {
      const refBase =
        (r.room_id ? roomBaseById.get(r.room_id) : listingBaseNum) ?? 0;
      return Math.max(0, refBase * (1 + value / 100));
    }
    return value;
  };
  const seasons: SeasonRow[] = seasonRowsTyped.map((r) => ({
    id: r.id,
    label: r.label,
    startDate: r.start_date,
    endDate: r.end_date,
    price: seasonDisplayPrice(r),
    roomId: r.room_id,
    priority: r.priority,
  }));

  // Engine-shaped rules for the sidebar widget's live estimate.
  const seasonalRules: SeasonalRule[] = seasonRowsTyped.map((r) => ({
    roomId: r.room_id,
    startDate: r.start_date,
    endDate: r.end_date,
    adjustmentType: r.adjustment_type === "percent" ? "percent" : "absolute",
    adjustmentValue: Number(r.adjustment_value),
    label: r.label,
    priority: r.priority ?? 0,
    minNights: r.min_nights ?? null,
    isActive: r.is_active,
    createdAt: r.created_at,
  }));

  const unavailableDates = ((blockedRows ?? []) as Array<{ date: string }>).map(
    (r) => r.date,
  );

  const pois: Poi[] = (
    (poiRows ?? []) as Array<{
      id: string;
      category: "eat" | "do" | "travel";
      name: string;
      travel_time: string | null;
    }>
  ).map((p) => ({
    id: p.id,
    category: p.category,
    name: p.name,
    travelTime: p.travel_time,
  }));

  return {
    listing: coercedListing,
    photos: galleryPhotos,
    amenities,
    rooms,
    seasons,
    seasonalRules,
    unavailableDates,
    pois,
  };
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await loadListing(params.slug);
  if (!data) return { title: "Listing not found" };
  const { listing } = data;
  const brandName = await getBrandName();
  const where = locationLabel(listing);
  const plain = listing.description ? stripHtml(listing.description) : "";
  return {
    title: `${listing.name}${where ? ` · ${where}` : ""}`,
    description:
      plain.length > 0
        ? plain.slice(0, 200)
        : `Direct booking with ${listing.host.display_name} on ${brandName}.`,
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const data = await loadListing(params.slug);
  if (!data) notFound();
  const { listing, photos, amenities, rooms, seasons, unavailableDates, pois } =
    data;

  // If the visitor is signed in, prefill (and hide) the contact fields on the
  // quote-request form so they don't re-type details we already have. The
  // enquiry then matches their existing profile and lands them in their inbox.
  const guest = await loadGuestPrefill();

  const reviews = await loadListingReviews(listing.id);
  const reviewsNode =
    reviews.count > 0 ? <ReviewsSection data={reviews} /> : null;

  // The listing's effective policies (resolve → listing-wide → host default)
  // are the single source of truth for the refund note shown in the reserve
  // panel and the cancellation highlight, and they drive <ThingsToKnow/>.
  const policySummary = await getListingPolicySummary(listing.id);
  const refundNote = cancellationNote(policySummary);

  const locationNode =
    (listing.latitude != null && listing.longitude != null) ||
    pois.length > 0 ? (
      <LocationSection
        lat={listing.latitude}
        lng={listing.longitude}
        city={listing.city}
        province={listing.province}
        pois={pois}
      />
    ) : null;

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
        childPrice={Number(listing.child_price ?? 0)}
        petFee={Number(listing.pet_fee ?? 0)}
      />
    ) : null;

  const hasReviews =
    listing.avg_rating != null &&
    listing.total_reviews != null &&
    listing.total_reviews > 0;
  const isFavourite =
    hasReviews &&
    (listing.avg_rating ?? 0) >= 4.8 &&
    (listing.total_reviews ?? 0) >= 10;

  const t = await getTranslations("listing");

  return (
    <div className="bg-white text-brand-ink">
      <SiteHeader />

      <ListingHero
        country={listing.country}
        province={listing.province}
        city={listing.city}
        name={listing.name}
        locationLabel={locationLabel(listing)}
        rating={listing.avg_rating}
        reviewCount={listing.total_reviews}
        isSuperhost={listing.host.is_superhost}
        isVerified={listing.host.is_verified}
        isFavourite={isFavourite}
        instantBooking={listing.instant_booking}
        roomCount={rooms.length}
        maxGuests={listing.max_guests}
        trustCard={
          <TrustCard
            hostName={listing.host.display_name}
            avatarUrl={listing.host.avatar_url}
            isVerified={listing.host.is_verified}
            avgResponseHours={listing.host.avg_response_hours}
            hostingSince={listing.host.created_at}
            rating={listing.avg_rating}
            reviewCount={listing.total_reviews}
          />
        }
      />

      <main className="mx-auto max-w-7xl px-5 pb-24 lg:px-8 lg:pb-12">
        <div className="relative z-10 -mt-[126px] overflow-hidden rounded-card shadow-peek ring-1 ring-black/5 sm:-mt-[150px]">
          <PhotoGallery photos={photos} />
        </div>

        <ListingBody
          listing={listing}
          policySummary={policySummary}
          refundNote={refundNote}
          amenities={amenities}
          showRoomsGrid={rooms.length > 0}
          roomsNode={
            rooms.length > 0 ? (
              <RoomsInfoGrid rooms={rooms} currency={listing.currency} />
            ) : null
          }
          ratesNode={ratesNode}
          calendarNode={
            unavailableDates.length > 0 ? (
              <section
                id="sec-calendar"
                className="border-b border-brand-line py-7"
              >
                <h3 className="font-display text-xl font-bold text-brand-ink">
                  {t("availabilityTitle")}
                </h3>
                <p className="mt-1 text-sm text-brand-mute">
                  {t("availabilityBody")}
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
          reviewsNode={reviewsNode}
          locationNode={locationNode}
          sidebarNode={
            <ReservePanel
              slug={listing.slug ?? params.slug}
              basePrice={listing.base_price}
              currency={listing.currency}
              rating={listing.avg_rating}
              reviewCount={listing.total_reviews}
              instantBooking={listing.instant_booking}
              refundNote={refundNote?.note ?? t("cancellationFallback")}
              quoteButton={
                <RequestQuoteButton
                  listingId={listing.id}
                  listingName={listing.name}
                  bookingMode={listing.booking_mode}
                  rooms={rooms.map((r) => ({ id: r.id, name: r.name }))}
                  isAuthed={guest.isAuthed}
                  prefillName={guest.name}
                  prefillEmail={guest.email}
                  prefillPhone={guest.phone}
                  triggerLabel={t("requestQuote")}
                  triggerClassName="inline-flex w-full items-center justify-center gap-1.5 rounded border border-white/20 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.12]"
                />
              }
              quoteButtonMobile={
                <RequestQuoteButton
                  listingId={listing.id}
                  listingName={listing.name}
                  bookingMode={listing.booking_mode}
                  rooms={rooms.map((r) => ({ id: r.id, name: r.name }))}
                  isAuthed={guest.isAuthed}
                  prefillName={guest.name}
                  prefillEmail={guest.email}
                  prefillPhone={guest.phone}
                  triggerLabel={t("quoteShort")}
                  triggerClassName="inline-flex shrink-0 items-center gap-1.5 rounded border border-brand-line px-3 py-3 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light"
                />
              }
            />
          }
          quoteButton={
            <RequestQuoteButton
              listingId={listing.id}
              listingName={listing.name}
              bookingMode={listing.booking_mode}
              rooms={rooms.map((r) => ({ id: r.id, name: r.name }))}
              isAuthed={guest.isAuthed}
              prefillName={guest.name}
              prefillEmail={guest.email}
              prefillPhone={guest.phone}
            />
          }
        />

        <SimilarListings
          currentSlug={listing.slug ?? params.slug}
          city={listing.city}
          province={listing.province}
        />
      </main>

      <SiteFooter />
    </div>
  );
}

async function ListingBody({
  listing,
  policySummary,
  refundNote,
  amenities,
  showRoomsGrid,
  roomsNode,
  ratesNode,
  calendarNode,
  reviewsNode,
  locationNode,
  sidebarNode,
  quoteButton,
}: {
  listing: RawListing;
  policySummary: ListingPolicySummary;
  refundNote: { title: string; note: string } | null;
  amenities: string[];
  showRoomsGrid: boolean;
  roomsNode: React.ReactNode;
  ratesNode?: React.ReactNode;
  calendarNode?: React.ReactNode;
  reviewsNode?: React.ReactNode;
  locationNode?: React.ReactNode;
  sidebarNode: React.ReactNode;
  quoteButton?: React.ReactNode;
}) {
  const [brandName, t] = await Promise.all([
    getBrandName(),
    getTranslations("listing"),
  ]);
  const sectionLinks = [
    { id: "sec-overview", label: "Overview" },
    { id: "sec-amenities", label: "Amenities" },
    ...(showRoomsGrid ? [{ id: "sec-rooms", label: "Rooms" }] : []),
    ...(ratesNode ? [{ id: "sec-rates", label: "Rates" }] : []),
    ...(calendarNode ? [{ id: "sec-calendar", label: "Calendar" }] : []),
    ...(reviewsNode ? [{ id: "sec-reviews", label: "Reviews" }] : []),
    ...(locationNode ? [{ id: "sec-location", label: "Location" }] : []),
    { id: "sec-host", label: "Host" },
    { id: "sec-policies", label: "Things to know" },
  ];

  return (
    <>
      <StickySubnav links={sectionLinks} />

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
              title={refundNote?.title ?? "Cancellation policy"}
              body={
                <>
                  {refundNote?.note ?? "See the host's cancellation terms."}{" "}
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
                body={`Identity and payment details verified by ${brandName}.`}
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

          {/* ROOMS — display only; selection happens inside the booking flow */}
          {showRoomsGrid ? (
            <section id="sec-rooms" className="border-b border-brand-line py-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-bold text-brand-ink">
                    The rooms
                  </h3>
                  {listing.booking_mode !== "whole_listing" ? (
                    <p className="mt-1 text-sm text-brand-mute">
                      Book one room, a few, or the whole place — you&rsquo;ll
                      choose when you reserve.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-5">{roomsNode}</div>
              {listing.booking_mode !== "whole_listing" ? (
                <p className="mt-4 inline-flex items-start gap-1.5 text-[11.5px] leading-relaxed text-brand-mute">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Tap{" "}
                  <span className="font-medium text-brand-ink">Reserve</span> to
                  pick your dates and rooms.
                </p>
              ) : null}
            </section>
          ) : null}

          {/* RATES & SEASONAL PRICING */}
          {ratesNode}

          {/* AVAILABILITY CALENDAR */}
          {calendarNode}

          {/* REVIEWS — full section (distribution, categories, grid, votes) */}
          {reviewsNode}

          {/* LOCATION — map + neighbourhood */}
          {locationNode}

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
              isSuperhost={listing.host.is_superhost}
              responseRate={listing.host.response_rate}
              avgResponseHours={listing.host.avg_response_hours}
              languages={listing.host.languages_spoken}
              hostingSince={listing.host.created_at}
              rating={listing.avg_rating}
              reviewCount={listing.total_reviews}
              quoteButton={quoteButton}
            />
            <p className="mt-5 rounded border border-brand-line bg-brand-light/50 p-3 text-[12px] leading-relaxed text-brand-mute">
              <Shield className="mr-1 inline-block h-3.5 w-3.5 align-text-bottom text-brand-mute" />
              For your safety, never transfer money or chat outside {brandName}.
            </p>
          </section>

          {/* THINGS TO KNOW */}
          <section id="sec-policies" className="py-7">
            <h3 className="font-display text-xl font-bold text-brand-ink">
              {t("thingsToKnowHeading")}
            </h3>
            <div className="mt-5">
              <div className="mb-2 text-[13px] font-semibold text-brand-ink">
                {t("whoItSuits")}
              </div>
              <SuitabilityChips
                s={{
                  // Single source of truth: pets/children "allowed" come from the
                  // resolved house-rules POLICY (same data ThingsToKnow uses), not
                  // the legacy listings.allow_* columns — so "Who it suits" can
                  // never disagree with the House rules card. The listing columns
                  // only supply pricing + age bands + infants (no policy field).
                  allowChildren:
                    policySummary.house_rules?.children_welcome ??
                    listing.allow_children ??
                    true,
                  allowInfants: listing.allow_infants ?? true,
                  allowPets:
                    policySummary.house_rules?.pets_allowed ??
                    listing.allow_pets ??
                    true,
                  childPrice: Number(listing.child_price ?? 0),
                  infantPrice: Number(listing.infant_price ?? 0),
                  petFee: Number(listing.pet_fee ?? 0),
                  infantMaxAge: listing.infant_max_age ?? 2,
                  childMaxAge: listing.child_max_age ?? 12,
                  currency: listing.currency,
                }}
              />
            </div>
            {/* Single source of truth: the listing's effective policies drive
                the refund schedule, check-in/out and house rules (no legacy
                cancellation_policy enum). Booking terms + privacy are platform
                docs, linked at the foot. */}
            <ThingsToKnow
              listingId={listing.id}
              summary={policySummary}
              brandName={brandName}
              checkInTimeFallback={listing.check_in_time}
              checkOutTimeFallback={listing.check_out_time}
              maxGuests={listing.max_guests}
              minNights={listing.min_nights}
              houseRulesText={listing.house_rules}
            />

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
