import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Globe,
  Languages,
  MapPin,
  MessageSquare,
  Star,
  User,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { createServerClient } from "@/lib/supabase/server";

import { ProfileTabs } from "./ProfileTabs";

// Reserved top-level paths must NOT resolve to a host profile. Next.js prefers
// static segments over dynamic, so this is belt-and-braces in case a host
// somehow gets a handle that collides (the DB CHECK enforces the format but
// no blacklist exists yet).
const RESERVED = new Set([
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "dashboard",
  "booking",
  "booking-management",
  "change-log",
  "cookies",
  "privacy",
  "terms",
  "status",
  "listing",
  "signup",
  "auth",
  "explore",
  "api",
]);

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

type Listing = {
  id: string;
  slug: string | null;
  name: string;
  listing_type: string;
  accommodation_type: string | null;
  experience_type: string | null;
  city: string | null;
  province: string | null;
  base_price: number | null;
  currency: string;
  booking_mode: string;
  avg_rating: number | null;
  total_reviews: number | null;
  max_guests: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  duration_minutes: number | null;
  is_featured: boolean;
  photos: Array<{ url: string; sort_order: number }> | null;
  listing_rooms: Array<{
    base_price: number;
    is_active: boolean | null;
    deleted_at: string | null;
  }> | null;
};

function typeLabel(
  l: Pick<Listing, "listing_type" | "accommodation_type" | "experience_type">,
) {
  if (l.listing_type === "accommodation") {
    return ACC_LABEL[l.accommodation_type ?? "other"] ?? "Stay";
  }
  return EXP_LABEL[l.experience_type ?? "other"] ?? "Experience";
}

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

function priceForListing(
  l: Pick<Listing, "base_price" | "booking_mode" | "listing_rooms">,
): {
  amount: number | null;
  fromLabel: boolean;
} {
  if (l.booking_mode === "rooms_only") {
    const prices = (l.listing_rooms ?? [])
      .filter((r) => r.is_active !== false && r.deleted_at == null)
      .map((r) => Number(r.base_price))
      .filter((p) => p > 0);
    if (prices.length === 0) return { amount: null, fromLabel: true };
    return { amount: Math.min(...prices), fromLabel: true };
  }
  return {
    amount: l.base_price != null ? Number(l.base_price) : null,
    fromLabel: false,
  };
}

/** "~1 hr" / "~6 hrs" / "~2 days" from the host's avg response hours. */
function responseTimeLabel(hours: number | null): string | null {
  if (hours == null || hours <= 0) return null;
  if (hours < 1.5) return "~1 hr";
  if (hours < 24) return `~${Math.round(hours)} hrs`;
  const days = Math.round(hours / 24);
  return `~${days} ${days === 1 ? "day" : "days"}`;
}

/** Most common "City, Province" across the host's published listings. */
function deriveLocation(listings: Listing[]): string | null {
  const counts = new Map<string, number>();
  for (const l of listings) {
    const loc = [l.city, l.province].filter(Boolean).join(", ");
    if (loc) counts.set(loc, (counts.get(loc) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Data-derived listing badge — no per-listing badge column exists. */
function listingBadge(l: Listing): string | null {
  if (l.is_featured) return "Featured";
  if (l.total_reviews == null || l.total_reviews === 0) return "New";
  if (l.avg_rating != null && l.avg_rating >= 4.8 && l.total_reviews >= 3) {
    return "Guest favourite";
  }
  return null;
}

function capacityLabel(l: Listing): string | null {
  const parts: string[] = [];
  if (l.listing_type === "accommodation") {
    if (l.max_guests) parts.push(`${l.max_guests} guests`);
    if (l.bedrooms != null)
      parts.push(`${l.bedrooms} ${l.bedrooms === 1 ? "bed" : "beds"}`);
    if (l.bathrooms != null)
      parts.push(`${l.bathrooms} ${l.bathrooms === 1 ? "bath" : "baths"}`);
  } else {
    if (l.max_guests) parts.push(`${l.max_guests} guests`);
    if (l.duration_minutes) {
      const h = Math.round((l.duration_minutes / 60) * 10) / 10;
      parts.push(h >= 1 ? `${h} hr` : `${l.duration_minutes} min`);
    }
  }
  return parts.length ? parts.join(" · ") : null;
}

async function loadHost(handle: string) {
  if (RESERVED.has(handle)) return null;
  // RLS public_read_active_hosts allows this read.
  const supabase = createServerClient();
  const { data: host } = await supabase
    .from("hosts")
    .select(
      "id, display_name, handle, bio, avatar_url, cover_photo_url, is_verified, avg_rating, total_reviews, languages_spoken, website_url, created_at, avg_response_hours, response_rate, total_bookings",
    )
    .eq("handle", handle)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!host) return null;

  // Public published listings + their hero photo.
  const { data: listings } = await supabase
    .from("listings")
    .select(
      "id, slug, name, listing_type, accommodation_type, experience_type, city, province, base_price, currency, booking_mode, avg_rating, total_reviews, max_guests, bedrooms, bathrooms, duration_minutes, is_featured, photos:listing_photos ( url, sort_order ), listing_rooms ( base_price, is_active, deleted_at )",
    )
    .eq("host_id", host.id)
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Published, non-flagged reviews are public (RLS public_read_published_reviews).
  // Reviewer names live in user_profiles, which is NOT publicly readable, so
  // reviews render anonymised ("Verified guest") with the listing they're for.
  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, rating, body, created_at, listing_id")
    .eq("host_id", host.id)
    .eq("is_published", true)
    .eq("flagged", false)
    .not("body", "is", null)
    .order("created_at", { ascending: false })
    .limit(6);

  return {
    host,
    listings: (listings ?? []) as unknown as Listing[],
    reviews: reviews ?? [],
  };
}

export async function generateMetadata({
  params,
}: {
  params: { handle: string };
}): Promise<Metadata> {
  const data = await loadHost(params.handle);
  if (!data) return { title: "Host not found · Vilo" };
  return {
    title: `${data.host.display_name} · Vilo`,
    description:
      data.host.bio?.slice(0, 200) ??
      `Book directly with ${data.host.display_name} on Vilo.`,
  };
}

export default async function HostProfilePage({
  params,
}: {
  params: { handle: string };
}) {
  const data = await loadHost(params.handle);
  if (!data) notFound();
  const { host, listings, reviews } = data;

  const firstName = host.display_name.split(/[\s&]+/)[0];
  const location = deriveLocation(listings);
  const responseTime = responseTimeLabel(host.avg_response_hours);
  const hostingSince = new Date(host.created_at).getFullYear();
  const listingsById = new Map(listings.map((l) => [l.id, l]));

  const stats: Array<{ icon: typeof Star; value: string; label: string }> = [];
  if (host.avg_rating != null && (host.total_reviews ?? 0) > 0) {
    stats.push({
      icon: Star,
      value: Number(host.avg_rating).toFixed(2),
      label: "Overall rating",
    });
  }
  if ((host.total_reviews ?? 0) > 0) {
    stats.push({
      icon: MessageSquare,
      value: String(host.total_reviews),
      label: "Reviews",
    });
  }
  if (responseTime) {
    stats.push({ icon: Clock, value: responseTime, label: "Response time" });
  }
  if (host.response_rate != null) {
    stats.push({
      icon: CheckCircle2,
      value: `${Math.round(host.response_rate)}%`,
      label: "Response rate",
    });
  }
  stats.push({
    icon: Calendar,
    value: String(hostingSince),
    label: "Hosting since",
  });

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "places", label: "Listings", count: listings.length },
    ...(reviews.length > 0
      ? [
          {
            id: "reviews",
            label: "Reviews",
            count: host.total_reviews ?? reviews.length,
          },
        ]
      : []),
  ];

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[320px_1fr]">
          {/* ── Left rail ───────────────────────────────────────── */}
          <aside>
            <div className="lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-lift">
                <div className="h-20 bg-brand-gradient" />
                <div className="-mt-12 px-6 pb-6">
                  <div className="relative inline-block">
                    <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-brand-accent font-display text-2xl font-bold text-brand-primary shadow-lift ring-4 ring-white">
                      {host.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={host.avatar_url}
                          alt={host.display_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        host.display_name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    {host.is_verified ? (
                      <span className="absolute bottom-0.5 right-0.5 grid h-6 w-6 place-items-center rounded-full bg-brand-primary text-white ring-2 ring-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </div>

                  <h1 className="mt-3 font-display text-2xl font-bold leading-tight text-brand-ink">
                    {host.display_name}
                  </h1>
                  {location ? (
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-brand-mute">
                      <MapPin className="h-3.5 w-3.5" /> {location}
                    </div>
                  ) : null}
                  <div className="mt-1 font-mono text-xs text-brand-mute">
                    viloplatform.com/{host.handle}
                  </div>

                  {host.is_verified ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-pill bg-brand-primary/10 px-2.5 py-1 text-xs font-medium text-brand-primary">
                        <BadgeCheck className="h-3 w-3" /> Verified host
                      </span>
                    </div>
                  ) : null}

                  <a
                    href="#places"
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded bg-brand-primary px-5 py-3 font-medium text-white transition-colors hover:bg-brand-secondary"
                  >
                    <MessageSquare className="h-4 w-4" /> See our places
                  </a>
                  {host.website_url ? (
                    <a
                      href={host.website_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded border border-brand-line px-5 py-2.5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light"
                    >
                      <Globe className="h-4 w-4" /> Visit website
                    </a>
                  ) : null}
                </div>

                <div className="divide-y divide-brand-line border-t border-brand-line">
                  {stats.map((s) => {
                    const Icon = s.icon;
                    return (
                      <div
                        key={s.label}
                        className="flex items-center gap-3 px-6 py-3"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-brand-primary" />
                        <span className="num font-display font-bold text-brand-ink">
                          {s.value}
                        </span>
                        <span className="ml-auto text-sm text-brand-mute">
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {host.is_verified ? (
                <div className="mt-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
                  <div className="mb-3 text-sm font-semibold text-brand-ink">
                    Confirmed information
                  </div>
                  <div className="space-y-2.5 text-sm text-brand-ink">
                    <div className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-brand-primary" /> Identity
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-brand-primary" /> Email
                      address
                    </div>
                  </div>
                </div>
              ) : null}

              <Link
                href="/help"
                className="mt-3 block text-center text-xs text-brand-mute underline underline-offset-2 hover:text-brand-ink"
              >
                Report this profile
              </Link>
            </div>
          </aside>

          {/* ── Right column ────────────────────────────────────── */}
          <div>
            <ProfileTabs tabs={tabs} />

            {/* Overview */}
            <section id="overview" className="scroll-mt-32 pt-7">
              <h2 className="mb-3 font-display text-xl font-bold text-brand-ink">
                A little about {firstName}
              </h2>
              {host.bio ? (
                <p className="max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-brand-ink/90">
                  {host.bio}
                </p>
              ) : (
                <p className="text-sm text-brand-mute">
                  {host.display_name} hasn&rsquo;t added a bio yet.
                </p>
              )}
              {host.languages_spoken && host.languages_spoken.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-accent/60 px-2.5 py-1 text-xs font-medium text-brand-ink">
                    <Languages className="h-3 w-3" />{" "}
                    {host.languages_spoken.join(" · ")}
                  </span>
                </div>
              ) : null}
            </section>

            {/* Listings */}
            <section id="places" className="scroll-mt-32 pt-10">
              <div className="mb-4 flex items-end justify-between">
                <h2 className="font-display text-xl font-bold text-brand-ink">
                  {firstName}&rsquo;s places
                </h2>
              </div>

              {listings.length === 0 ? (
                <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center text-sm text-brand-mute shadow-card">
                  No published listings yet. Check back soon.
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  {listings.map((l) => {
                    const photos = l.photos ?? [];
                    const hero = [...photos].sort(
                      (a, b) => a.sort_order - b.sort_order,
                    )[0];
                    const badge = listingBadge(l);
                    const capacity = capacityLabel(l);
                    const price = priceForListing(l);
                    return (
                      <Link
                        key={l.id}
                        href={`/listing/${l.slug}`}
                        className="group flex gap-4 overflow-hidden rounded-card border border-brand-line bg-white p-3 shadow-card transition-shadow hover:shadow-lift"
                      >
                        <div className="relative h-28 w-32 shrink-0 overflow-hidden rounded-[10px] bg-brand-accent">
                          {hero ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={hero.url}
                              alt={l.name}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 py-1">
                          {badge ? (
                            <span className="mb-1.5 inline-flex items-center rounded-pill bg-brand-primary/10 px-2 py-0.5 text-[11px] font-medium text-brand-primary">
                              {badge}
                            </span>
                          ) : null}
                          <div className="truncate font-medium leading-snug text-brand-ink transition-colors group-hover:text-brand-primary">
                            {l.name}
                          </div>
                          <div className="mt-0.5 text-sm text-brand-mute">
                            {capacity ?? typeLabel(l)}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            {price.amount != null ? (
                              <span className="text-sm text-brand-ink">
                                {price.fromLabel ? (
                                  <span className="text-brand-mute">from </span>
                                ) : null}
                                <span className="num font-semibold">
                                  {fmtR(price.amount, l.currency)}
                                </span>{" "}
                                <span className="text-brand-mute">/ night</span>
                              </span>
                            ) : (
                              <span />
                            )}
                            {l.avg_rating != null &&
                            l.total_reviews != null &&
                            l.total_reviews > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs text-brand-ink">
                                <Star className="h-3.5 w-3.5 fill-brand-ink stroke-brand-ink" />
                                <span className="num font-semibold">
                                  {Number(l.avg_rating).toFixed(2)}
                                </span>
                                <span className="num text-brand-mute">
                                  ({l.total_reviews})
                                </span>
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Reviews */}
            {reviews.length > 0 ? (
              <section id="reviews" className="scroll-mt-32 pt-10">
                <div className="mb-1 flex items-center gap-2">
                  <Star className="h-5 w-5 fill-brand-ink stroke-brand-ink" />
                  <h2 className="font-display text-xl font-bold text-brand-ink">
                    {host.avg_rating != null
                      ? `${Number(host.avg_rating).toFixed(2)} · `
                      : ""}
                    {host.total_reviews ?? reviews.length} review
                    {(host.total_reviews ?? reviews.length) === 1 ? "" : "s"}
                  </h2>
                </div>

                <div className="mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  {reviews.map((r) => {
                    const listing = r.listing_id
                      ? listingsById.get(r.listing_id)
                      : undefined;
                    const when = new Date(r.created_at).toLocaleDateString(
                      "en-ZA",
                      { month: "short", year: "numeric" },
                    );
                    const filled = Math.round(Number(r.rating));
                    return (
                      <div
                        key={r.id}
                        className="rounded-card border border-brand-line bg-white p-5 shadow-card"
                      >
                        <div className="mb-2 flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-accent text-brand-primary">
                            <User className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-brand-ink">
                              Verified guest
                            </div>
                            <div className="truncate text-xs text-brand-mute">
                              {listing ? `${listing.name} · ` : ""}
                              {when}
                            </div>
                          </div>
                        </div>
                        <div className="mb-1.5 flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={
                                i < filled
                                  ? "h-3.5 w-3.5 fill-brand-ink stroke-brand-ink"
                                  : "h-3.5 w-3.5 fill-brand-line stroke-brand-line"
                              }
                            />
                          ))}
                        </div>
                        <p className="text-sm leading-relaxed text-brand-ink/90">
                          {r.body}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {(host.total_reviews ?? 0) > reviews.length ? (
                  <div className="mt-7 inline-flex items-center gap-1 text-sm text-brand-mute">
                    Showing {reviews.length} of {host.total_reviews} reviews
                    <ArrowRight className="h-4 w-4" />
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
