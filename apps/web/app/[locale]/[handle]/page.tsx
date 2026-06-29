import type { Metadata } from "next";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Globe,
  Languages,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Sparkles,
  Star,
  User,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";

import { getBrandName } from "@/lib/brand";
import { Money } from "@/components/currency/Money";
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
  // Locale codes — a handle equal to a locale would be shadowed by the
  // [locale] segment (e.g. /de = German home, not a host "de").
  "en",
  "af",
  "fr",
  "de",
  "pt",
]);

const ACC_LABEL: Record<string, string> = {
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  bb: "B&B",
  self_catering: "Self-catering",
  lodge: "Lodge",
  other: "Stay",
};

type Listing = {
  id: string;
  slug: string | null;
  name: string;
  accommodation_type: string | null;
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
  is_featured: boolean;
  photos: Array<{ url: string; sort_order: number }> | null;
  property_rooms: Array<{
    base_price: number;
    is_active: boolean | null;
    deleted_at: string | null;
  }> | null;
};

function typeLabel(l: Pick<Listing, "accommodation_type">) {
  return ACC_LABEL[l.accommodation_type ?? "other"] ?? "Stay";
}

function priceForListing(
  l: Pick<Listing, "base_price" | "booking_mode" | "property_rooms">,
): {
  amount: number | null;
  fromLabel: boolean;
} {
  // listing.base_price = effective "from" price (cheapest active room incl.
  // per-person rates), maintained by recomputeListingFromRooms — use it so
  // per-person rooms (base_price 0, rate in price_per_person) still show.
  return {
    amount: l.base_price != null ? Number(l.base_price) : null,
    fromLabel: l.booking_mode === "rooms_only",
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
  if (l.max_guests) parts.push(`${l.max_guests} guests`);
  if (l.bedrooms != null)
    parts.push(`${l.bedrooms} ${l.bedrooms === 1 ? "bed" : "beds"}`);
  if (l.bathrooms != null)
    parts.push(`${l.bathrooms} ${l.bathrooms === 1 ? "bath" : "baths"}`);
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
    .from("properties")
    .select(
      "id, slug, name, accommodation_type, city, province, base_price, currency, booking_mode, avg_rating, total_reviews, max_guests, bedrooms, bathrooms, is_featured, photos:property_photos ( url, sort_order ), property_rooms ( base_price, is_active, deleted_at )",
    )
    .eq("host_id", host.id)
    .eq("is_published", true)
    // MVP: accommodation only — experiences/tour guides ship later.
    .eq("property_type", "accommodation")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Published, non-flagged reviews are public (RLS public_read_published_reviews).
  // Reviewer names live in user_profiles, which is NOT publicly readable, so
  // reviews render anonymised ("Verified guest") with the listing they're for.
  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, rating, body, created_at, property_id")
    .eq("host_id", host.id)
    .eq("is_published", true)
    .eq("flagged", false)
    .not("body", "is", null)
    .order("created_at", { ascending: false })
    .limit(6);

  // ── Defensive reads (the prod DB migration may lag the deploy) ──────────
  // These columns were added in a separate migration. If they don't exist yet
  // the query errors and `data` is null — we keep the safe defaults and never
  // throw, so the page can never 500/404 from a missing column.
  let hostExtra: HostExtra = {
    highlights: [],
    is_superhost: false,
    phone_verified: false,
    payout_verified: false,
  };
  const { data: extra } = await supabase
    .from("hosts")
    .select("highlights, is_superhost, phone_verified, payout_verified")
    .eq("id", host.id)
    .maybeSingle();
  if (extra) {
    hostExtra = {
      highlights: extra.highlights ?? [],
      is_superhost: !!extra.is_superhost,
      phone_verified: !!extra.phone_verified,
      payout_verified: !!extra.payout_verified,
    };
  }

  // Per-category rating averages over the same public review set.
  const { data: cats } = await supabase
    .from("reviews")
    .select(
      "rating_cleanliness, rating_communication, rating_checkin, rating_accuracy, rating_location, rating_value",
    )
    .eq("host_id", host.id)
    .eq("is_published", true)
    .eq("flagged", false);
  const ratingBreakdown = computeRatingBreakdown(cats ?? []);

  return {
    host,
    listings: (listings ?? []) as unknown as Listing[],
    reviews: reviews ?? [],
    hostExtra,
    ratingBreakdown,
  };
}

type HostExtra = {
  highlights: string[];
  is_superhost: boolean;
  phone_verified: boolean;
  payout_verified: boolean;
};

const RATING_CATEGORIES = [
  { key: "rating_cleanliness", label: "Cleanliness" },
  { key: "rating_communication", label: "Communication" },
  { key: "rating_checkin", label: "Check-in" },
  { key: "rating_accuracy", label: "Accuracy" },
  { key: "rating_location", label: "Location" },
  { key: "rating_value", label: "Value" },
] as const;

type CategoryRow = Partial<
  Record<(typeof RATING_CATEGORIES)[number]["key"], number | null>
>;

/**
 * Averages each category over its non-null values. Returns `null` when no
 * category has any data, so the breakdown block can be hidden entirely.
 */
function computeRatingBreakdown(
  rows: CategoryRow[],
): Array<{ label: string; avg: number }> | null {
  const out: Array<{ label: string; avg: number }> = [];
  for (const { key, label } of RATING_CATEGORIES) {
    const vals = rows
      .map((r) => r[key])
      .filter((v): v is number => v != null && !Number.isNaN(Number(v)))
      .map(Number);
    if (vals.length === 0) continue;
    out.push({ label, avg: vals.reduce((a, b) => a + b, 0) / vals.length });
  }
  return out.length > 0 ? out : null;
}

export async function generateMetadata({
  params,
}: {
  params: { handle: string };
}): Promise<Metadata> {
  const data = await loadHost(params.handle);
  if (!data) return { title: "Host not found" };
  const brandName = await getBrandName();
  return {
    title: `${data.host.display_name}`,
    description:
      data.host.bio?.slice(0, 200) ??
      `Book directly with ${data.host.display_name} on ${brandName}.`,
  };
}

export default async function HostProfilePage({
  params,
}: {
  params: { handle: string };
}) {
  const data = await loadHost(params.handle);
  if (!data) notFound();
  const { host, listings, reviews, hostExtra, ratingBreakdown } = data;

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

  // Confirmed-information rows — each honest to its own verification signal.
  const confirmed: Array<{ icon: typeof Check; label: string }> = [];
  if (host.is_verified) {
    confirmed.push({ icon: User, label: "Identity" });
    confirmed.push({ icon: Mail, label: "Email address" });
  }
  if (hostExtra.phone_verified) {
    confirmed.push({ icon: Phone, label: "Phone number" });
  }
  if (hostExtra.payout_verified) {
    confirmed.push({ icon: CreditCard, label: "Payout method" });
  }

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
                    wieloplatform.com/{host.handle}
                  </div>

                  {host.is_verified || hostExtra.is_superhost ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {hostExtra.is_superhost ? (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-brand-secondary px-2.5 py-1 text-xs font-medium text-white">
                          <Award className="h-3 w-3" /> Superhost
                        </span>
                      ) : null}
                      {host.is_verified ? (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-brand-primary/10 px-2.5 py-1 text-xs font-medium text-brand-primary">
                          <BadgeCheck className="h-3 w-3" /> Verified
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <a
                    href="#places"
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded bg-brand-primary px-5 py-3 font-medium text-white transition-colors hover:bg-brand-secondary"
                  >
                    <ArrowRight className="h-4 w-4" /> See our places
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

              {confirmed.length > 0 ? (
                <div className="mt-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
                  <div className="mb-3 text-sm font-semibold text-brand-ink">
                    Confirmed information
                  </div>
                  <div className="space-y-2.5 text-sm text-brand-ink">
                    {confirmed.map((c) => (
                      <div
                        key={c.label}
                        className="flex items-center justify-between gap-2.5"
                      >
                        <span className="flex items-center gap-2.5">
                          <c.icon className="h-4 w-4 shrink-0 text-brand-mute" />
                          {c.label}
                        </span>
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-accent text-brand-primary">
                          <Check className="h-3 w-3" />
                        </span>
                      </div>
                    ))}
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
              {hostExtra.highlights.length > 0 ||
              (host.languages_spoken && host.languages_spoken.length > 0) ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {hostExtra.highlights.map((h) => (
                    <span
                      key={h}
                      className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink shadow-card"
                    >
                      <Sparkles className="h-3 w-3 text-brand-primary" /> {h}
                    </span>
                  ))}
                  {host.languages_spoken && host.languages_spoken.length > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-accent/60 px-3 py-1.5 text-xs font-medium text-brand-ink">
                      <Languages className="h-3 w-3" />{" "}
                      {host.languages_spoken.join(" · ")}
                    </span>
                  ) : null}
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
                        href={`/property/${l.slug}`}
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
                                  <Money
                                    amount={price.amount}
                                    currency={l.currency}
                                  />
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
                                <Star className="h-3.5 w-3.5 fill-amber-400 stroke-amber-400" />
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
                  <Star className="h-5 w-5 fill-amber-400 stroke-amber-400" />
                  <h2 className="font-display text-xl font-bold text-brand-ink">
                    {host.avg_rating != null
                      ? `${Number(host.avg_rating).toFixed(2)} · `
                      : ""}
                    {host.total_reviews ?? reviews.length} review
                    {(host.total_reviews ?? reviews.length) === 1 ? "" : "s"}
                  </h2>
                </div>

                {ratingBreakdown ? (
                  <div className="mt-6 rounded-card border border-brand-line bg-white p-5 shadow-card sm:p-6">
                    <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
                      {ratingBreakdown.map((c) => (
                        <div
                          key={c.label}
                          className="flex items-center gap-3 text-sm"
                        >
                          <span className="w-28 shrink-0 text-brand-mute">
                            {c.label}
                          </span>
                          <span className="h-1.5 flex-1 overflow-hidden rounded-pill bg-brand-line">
                            <span
                              className="block h-full rounded-pill bg-brand-primary"
                              style={{
                                width: `${Math.min(100, (c.avg / 5) * 100)}%`,
                              }}
                            />
                          </span>
                          <span className="num w-10 shrink-0 text-right font-display font-bold tabular-nums text-brand-ink">
                            {c.avg.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  {reviews.map((r) => {
                    const listing = r.property_id
                      ? listingsById.get(r.property_id)
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
                                  ? "h-3.5 w-3.5 fill-amber-400 stroke-amber-400"
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
                  <a
                    href="#places"
                    className="mt-7 inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-4 py-2 text-sm font-medium text-brand-ink shadow-card transition-colors hover:bg-brand-light"
                  >
                    Show all {host.total_reviews} reviews
                    <ArrowRight className="h-4 w-4" />
                  </a>
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
