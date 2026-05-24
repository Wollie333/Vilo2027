import type { Metadata } from "next";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { createServerClient } from "@/lib/supabase/server";

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

function typeLabel(l: {
  listing_type: string;
  accommodation_type: string | null;
  experience_type: string | null;
}) {
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

async function loadHost(handle: string) {
  if (RESERVED.has(handle)) return null;
  // RLS public_read_active_hosts allows this read.
  const supabase = createServerClient();
  const { data: host } = await supabase
    .from("hosts")
    .select(
      "id, display_name, handle, bio, avatar_url, cover_photo_url, is_verified, avg_rating, total_reviews",
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
      "id, slug, name, listing_type, accommodation_type, experience_type, city, province, base_price, currency, booking_mode, avg_rating, total_reviews, photos:listing_photos ( url, sort_order ), listing_rooms ( base_price, is_active, deleted_at )",
    )
    .eq("host_id", host.id)
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return { host, listings: listings ?? [] };
}

function priceForListing(l: {
  base_price: number | null;
  booking_mode: string;
  listing_rooms?: Array<{
    base_price: number;
    is_active: boolean | null;
    deleted_at: string | null;
  }> | null;
}): { amount: number | null; fromLabel: boolean } {
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
  const { host, listings } = data;

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      {/* Cover / header */}
      <section className="relative border-b border-brand-line bg-white">
        <div aria-hidden className="dotgrid absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-5xl px-5 py-10 lg:px-8 lg:py-14">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-line bg-brand-accent font-display text-2xl font-bold text-brand-primary">
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
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
                  {host.display_name}
                </h1>
                {host.is_verified ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary">
                    <BadgeCheck className="h-4 w-4" /> Verified host
                  </span>
                ) : null}
              </div>
              <div className="mt-1 font-mono text-xs text-brand-mute">
                viloplatform.com/{host.handle}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-brand-mute">
                {host.avg_rating != null &&
                host.total_reviews != null &&
                host.total_reviews > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-brand-ink">
                      {Number(host.avg_rating).toFixed(1)}
                    </span>
                    <span>({host.total_reviews} reviews)</span>
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  {listings.length}{" "}
                  {listings.length === 1 ? "listing" : "listings"}
                </span>
              </div>
            </div>
          </div>

          {host.bio ? (
            <p className="mt-6 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-brand-dark">
              {host.bio}
            </p>
          ) : null}
        </div>
      </section>

      {/* Listings */}
      <section className="mx-auto max-w-5xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="font-display text-xl font-bold tracking-tight text-brand-ink md:text-2xl">
            {host.display_name.split(" ")[0]}&rsquo;s places
          </h2>
        </div>

        {listings.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center text-sm text-brand-mute shadow-card">
            No published listings yet. Check back soon.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => {
              const photos =
                (l.photos as Array<{
                  url: string;
                  sort_order: number;
                }> | null) ?? [];
              const hero = photos.sort(
                (a, b) => a.sort_order - b.sort_order,
              )[0];
              const location = [l.city, l.province].filter(Boolean).join(", ");
              return (
                <Link
                  key={l.id}
                  href={`/listing/${l.slug}`}
                  className="group overflow-hidden rounded-card border border-brand-line bg-white shadow-card transition-shadow hover:shadow-lift"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-brand-accent">
                    {hero ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hero.url}
                        alt={l.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-display font-semibold text-brand-ink group-hover:text-brand-secondary">
                          {l.name}
                        </div>
                        <div className="mt-0.5 text-xs text-brand-mute">
                          {typeLabel(l)}
                          {location ? ` · ${location}` : ""}
                        </div>
                      </div>
                      {(() => {
                        const price = priceForListing(l);
                        if (price.amount == null) return null;
                        return (
                          <div className="shrink-0 text-right">
                            <div className="num font-display text-sm font-bold text-brand-primary">
                              {price.fromLabel ? "from " : ""}
                              {fmtR(price.amount, l.currency)}
                            </div>
                            <div className="text-[10px] text-brand-mute">
                              /night
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    {l.avg_rating != null &&
                    l.total_reviews != null &&
                    l.total_reviews > 0 ? (
                      <div className="mt-2 flex items-center gap-1 text-[11px]">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="font-medium text-brand-ink">
                          {Number(l.avg_rating).toFixed(1)}
                        </span>
                        <span className="text-brand-mute">
                          ({l.total_reviews})
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-brand-mute">
                        <MapPin className="h-3 w-3" /> New
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
