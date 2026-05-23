import type { Metadata } from "next";
import { MapPin, Star, Users } from "lucide-react";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { UtilityBar } from "@/app/_components/home/UtilityBar";
import { createServerClient } from "@/lib/supabase/server";

import { AmenitiesList } from "./AmenitiesList";
import { BookingWidget } from "./BookingWidget";
import { HostCard } from "./HostCard";
import { PhotoGallery, type GalleryPhoto } from "./PhotoGallery";

type RawListing = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  listing_type: "accommodation" | "experience";
  accommodation_type: string | null;
  experience_type: string | null;
  city: string | null;
  province: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  max_guests: number | null;
  min_nights: number | null;
  check_in_time: string | null;
  check_out_time: string | null;
  base_price: number | null;
  cleaning_fee: number | null;
  currency: string;
  cancellation_policy: "flexible" | "moderate" | "strict";
  house_rules: string | null;
  instant_booking: boolean;
  avg_rating: number | null;
  total_reviews: number | null;
  host: {
    display_name: string;
    handle: string;
    bio: string | null;
    avatar_url: string | null;
    is_verified: boolean;
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

const EXP_LABEL: Record<string, string> = {
  tour: "Tour",
  activity: "Activity",
  workshop: "Workshop",
  transfer: "Transfer",
  other: "Experience",
};

function typeLabel(l: RawListing): string {
  if (l.listing_type === "accommodation") {
    return ACC_LABEL[l.accommodation_type ?? "other"] ?? "Stay";
  }
  return EXP_LABEL[l.experience_type ?? "other"] ?? "Experience";
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
        listing_type, accommodation_type, experience_type,
        city, province,
        bedrooms, bathrooms, max_guests, min_nights,
        check_in_time, check_out_time,
        base_price, cleaning_fee, currency,
        cancellation_policy, house_rules, instant_booking,
        avg_rating, total_reviews,
        host:hosts!inner ( display_name, handle, bio, avatar_url, is_verified )
      `,
    )
    .eq("slug", slug)
    .maybeSingle<RawListing>();

  if (!listing) return null;

  const [{ data: photoRows }, { data: amenityRows }] = await Promise.all([
    supabase
      .from("listing_photos")
      .select("id, url, sort_order")
      .eq("listing_id", listing.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("listing_amenities")
      .select("amenity_key")
      .eq("listing_id", listing.id),
  ]);

  const photos: GalleryPhoto[] = (photoRows ?? []).map((r) => ({
    id: r.id,
    url: r.url,
  }));
  const amenities = (amenityRows ?? []).map((r) => r.amenity_key);

  return { listing, photos, amenities };
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
  return {
    title: `${listing.name}${where ? ` · ${where}` : ""} · Vilo`,
    description:
      listing.description?.slice(0, 200) ??
      `Direct booking with ${listing.host.display_name} on Vilo.`,
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const data = await loadListing(params.slug);
  if (!data) notFound();
  const { listing, photos, amenities } = data;

  return (
    <div className="bg-brand-light text-brand-ink">
      <UtilityBar />
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
        {/* Title strip */}
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            {typeLabel(listing)}
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl lg:text-4xl">
            {listing.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-brand-mute">
            {locationLabel(listing) ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4 text-brand-primary" />
                {locationLabel(listing)}
              </span>
            ) : null}
            {listing.avg_rating != null &&
            listing.total_reviews != null &&
            listing.total_reviews > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-brand-ink">
                  {listing.avg_rating.toFixed(1)}
                </span>{" "}
                ({listing.total_reviews})
              </span>
            ) : null}
            {listing.max_guests != null ? (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> Up to {listing.max_guests}{" "}
                guests
              </span>
            ) : null}
          </div>
        </div>

        {/* Gallery */}
        <div className="mb-10">
          <PhotoGallery photos={photos} />
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.7fr_1fr]">
          <div className="space-y-10">
            {/* Quick facts */}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Fact label="Bedrooms" value={listing.bedrooms ?? "—"} />
              <Fact label="Bathrooms" value={listing.bathrooms ?? "—"} />
              <Fact label="Min nights" value={listing.min_nights ?? 1} />
              <Fact
                label="Check-in"
                value={listing.check_in_time?.slice(0, 5) ?? "—"}
              />
            </section>

            {/* Description */}
            {listing.description ? (
              <section>
                <h2 className="mb-3 font-display text-xl font-bold text-brand-ink">
                  About this{" "}
                  {listing.listing_type === "accommodation"
                    ? "stay"
                    : "experience"}
                </h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-brand-dark">
                  {listing.description}
                </p>
              </section>
            ) : null}

            {/* Host */}
            <section>
              <h2 className="mb-3 font-display text-xl font-bold text-brand-ink">
                Hosted by {listing.host.display_name}
              </h2>
              <HostCard
                displayName={listing.host.display_name}
                handle={listing.host.handle}
                bio={listing.host.bio}
                avatarUrl={listing.host.avatar_url}
                isVerified={listing.host.is_verified}
              />
            </section>

            {/* Amenities */}
            <section>
              <h2 className="mb-3 font-display text-xl font-bold text-brand-ink">
                What this place offers
              </h2>
              <AmenitiesList keys={amenities} />
            </section>

            {/* Policies */}
            <section>
              <h2 className="mb-3 font-display text-xl font-bold text-brand-ink">
                Things to know
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <PolicyCard title="Check-in / out">
                  <ul className="space-y-1 text-sm text-brand-dark">
                    <li>
                      Check-in from{" "}
                      <span className="font-medium">
                        {listing.check_in_time?.slice(0, 5) ?? "—"}
                      </span>
                    </li>
                    <li>
                      Check-out by{" "}
                      <span className="font-medium">
                        {listing.check_out_time?.slice(0, 5) ?? "—"}
                      </span>
                    </li>
                  </ul>
                </PolicyCard>
                <PolicyCard title="Cancellation policy">
                  <p className="text-sm text-brand-dark">
                    <span className="font-medium capitalize">
                      {listing.cancellation_policy}.
                    </span>{" "}
                    {CANCELLATION_BLURB[listing.cancellation_policy]}
                  </p>
                </PolicyCard>
                {listing.house_rules ? (
                  <PolicyCard title="House rules" wide>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-brand-dark">
                      {listing.house_rules}
                    </p>
                  </PolicyCard>
                ) : null}
              </div>
            </section>
          </div>

          {/* Booking widget */}
          <aside className="lg:pl-4">
            <BookingWidget
              slug={listing.slug ?? params.slug}
              basePrice={listing.base_price}
              cleaningFee={listing.cleaning_fee}
              currency={listing.currency}
              maxGuests={listing.max_guests}
              instantBooking={listing.instant_booking}
              rating={listing.avg_rating}
              reviewCount={listing.total_reviews}
            />
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div className="mt-1 font-display text-lg font-bold text-brand-ink">
        {value}
      </div>
    </div>
  );
}

function PolicyCard({
  title,
  children,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-card border border-brand-line bg-white p-4 ${
        wide ? "sm:col-span-2" : ""
      }`}
    >
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
        {title}
      </div>
      {children}
    </div>
  );
}
