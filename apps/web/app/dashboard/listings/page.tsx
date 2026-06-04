import type { Metadata } from "next";
import {
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  Image as ImageIcon,
  MapPin,
  Plus,
  Sparkles,
  Star,
} from "lucide-react";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Listings",
};

export const dynamic = "force-dynamic";

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

const TYPE_LABEL: Record<string, string> = {
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  bb: "B&B",
  self_catering: "Self-catering",
  lodge: "Lodge",
  other: "Stay",
  tour: "Tour",
  activity: "Activity",
  workshop: "Workshop",
  transfer: "Transfer",
};

type StatusFilter = "all" | "published" | "draft";

type ListingRow = {
  id: string;
  name: string;
  slug: string | null;
  listing_type: string;
  accommodation_type: string | null;
  city: string | null;
  province: string | null;
  base_price: number | string | null;
  currency: string;
  is_published: boolean;
  photos: Array<{ url: string; sort_order: number }> | null;
  rooms: Array<{ id: string }> | null;
};

export default async function ListingsPage({
  searchParams,
}: {
  searchParams?: { status?: string; q?: string };
}) {
  const supabase = createServerClient();

  const status = ((): StatusFilter => {
    const raw = searchParams?.status;
    return raw === "published" || raw === "draft" ? raw : "all";
  })();
  const q = (searchParams?.q ?? "").trim();

  // Scope to the logged-in host. `listings` has a `public_read_published`
  // RLS policy (so guests can browse the directory), which means relying on
  // RLS alone here would also return every OTHER host's published listing.
  // The explicit `host_id` filter is what keeps the portfolio private — never
  // remove it. Likewise resolve the host by `user_id`, not RLS.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: host } = user
    ? await supabase
        .from("hosts")
        .select("id, avg_rating, total_reviews")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle()
    : { data: null };

  const { data: listingsRaw } = host
    ? await supabase
        .from("listings")
        .select(
          "id, name, slug, listing_type, accommodation_type, city, province, base_price, currency, is_published, photos:listing_photos ( url, sort_order ), rooms:listing_rooms ( id )",
        )
        .eq("host_id", host.id)
        .eq("listing_type", "accommodation")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
    : { data: [] as ListingRow[] };

  const all = (listingsRaw as ListingRow[] | null) ?? [];
  const totalAll = all.length;
  const totalPublished = all.filter((l) => l.is_published).length;
  const totalDraft = totalAll - totalPublished;

  // Pick the listing with the most photos as the "spotlight" — closest
  // proxy we have to "top performer" without bookings aggregates here.
  const spotlight = all
    .filter((l) => l.is_published)
    .map((l) => ({ l, count: (l.photos ?? []).length }))
    .sort((a, b) => b.count - a.count)[0]?.l;
  const spotlightHero = (spotlight?.photos ?? []).sort(
    (a, b) => a.sort_order - b.sort_order,
  )[0];

  const filtered = all
    .filter((l) => {
      if (status === "published" && !l.is_published) return false;
      if (status === "draft" && l.is_published) return false;
      return true;
    })
    .filter((l) => {
      if (!q) return true;
      const hay =
        `${l.name} ${l.city ?? ""} ${l.province ?? ""} ${l.slug ?? ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });

  const hostRating = host?.avg_rating ? Number(host.avg_rating) : null;
  const hostReviews = host?.total_reviews ?? 0;

  return (
    <div className="space-y-6 lg:space-y-7">
      <PortfolioHero
        total={totalAll}
        published={totalPublished}
        draft={totalDraft}
        avgRating={hostRating}
        reviewCount={hostReviews}
        spotlight={
          spotlight && spotlightHero
            ? {
                name: spotlight.name,
                imageUrl: spotlightHero.url,
                slug: spotlight.slug,
                id: spotlight.id,
              }
            : null
        }
      />

      {totalAll > 0 ? (
        <FilterBar
          status={status}
          q={q}
          counts={{
            all: totalAll,
            published: totalPublished,
            draft: totalDraft,
          }}
        />
      ) : null}

      {totalAll === 0 ? (
        <EmptyState />
      ) : (
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              isSpotlight={l.id === spotlight?.id}
            />
          ))}
          <AddListingTile />
        </section>
      )}
    </div>
  );
}

function PortfolioHero({
  total,
  published,
  draft,
  avgRating,
  reviewCount,
  spotlight,
}: {
  total: number;
  published: number;
  draft: number;
  avgRating: number | null;
  reviewCount: number;
  spotlight: {
    name: string;
    imageUrl: string;
    slug: string | null;
    id: string;
  } | null;
}) {
  return (
    <section className="relative overflow-hidden rounded-card border border-brand-line shadow-card">
      <div className="grid gap-0 md:grid-cols-[1.45fr_1fr]">
        {/* Left: title block */}
        <div className="relative bg-brand-gradient-dark p-7 text-white md:p-8">
          <div
            aria-hidden
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(rgba(16,185,129,0.18) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          />
          <div
            aria-hidden
            className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-primary/30 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -left-20 bottom-0 h-44 w-44 rounded-full bg-brand-secondary/40 blur-3xl"
          />

          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent backdrop-blur">
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 11l9-7 9 7" />
                  <path d="M5 10v10h14V10" />
                </svg>
                Portfolio
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary/15 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-primary backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
                {published} live · {draft} draft
              </div>
            </div>

            <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight md:text-[34px]">
              Your listings
            </h2>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-brand-accent/80">
              {total === 0
                ? "Add your first listing to start taking direct bookings."
                : `${total} ${total === 1 ? "place" : "places"} in your portfolio. Edit, pause, or publish — guests see your changes within a minute.`}
            </p>

            {total > 0 ? (
              <div className="mt-6 grid max-w-md grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-accent/60">
                    Published
                  </div>
                  <div className="num mt-1 font-display text-2xl font-bold text-white">
                    {published}
                    <span className="text-[12px] font-medium text-brand-accent/60">
                      /{total}
                    </span>
                  </div>
                  <div className="text-[10.5px] text-brand-accent/60">
                    {published === 0 ? "ready to publish" : "live now"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-accent/60">
                    Drafts
                  </div>
                  <div className="num mt-1 font-display text-2xl font-bold text-white">
                    {draft}
                  </div>
                  <div className="text-[10.5px] text-brand-accent/60">
                    {draft === 0 ? "all live" : "finish to publish"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-accent/60">
                    Avg rating
                  </div>
                  <div className="num mt-1 font-display text-2xl font-bold text-white">
                    {avgRating == null ? "—" : avgRating.toFixed(2)}
                    {avgRating != null ? (
                      <span className="text-[12px] font-medium text-brand-accent/60">
                        /5
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[10.5px] text-brand-accent/60">
                    {reviewCount === 0
                      ? "after first stay"
                      : `${reviewCount} review${reviewCount === 1 ? "" : "s"}`}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link
                href="/dashboard/listings/new"
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_32px_-10px_rgba(16,185,129,0.35)] transition-colors hover:bg-white hover:text-brand-secondary"
              >
                <Plus className="h-4 w-4" />
                New listing
              </Link>
              <Link
                href="/dashboard/calendar-sync"
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/20 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M21 12a9 9 0 1 1-3.5-7.1" />
                  <path d="M21 4v5h-5" />
                </svg>
                Import from iCal
              </Link>
            </div>
          </div>
        </div>

        {/* Right: spotlight */}
        <div className="relative bg-brand-dark text-white">
          <div className="relative h-full min-h-[280px]">
            {spotlight ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={spotlight.imageUrl}
                  alt={spotlight.name}
                  className="absolute inset-0 h-full w-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-brand-dark via-brand-dark/40 to-transparent" />
                <div className="relative flex h-full flex-col justify-between p-7 md:p-8">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                      <Star className="h-3 w-3" fill="currentColor" />
                      Featured listing
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent/70">
                      Spotlight
                    </div>
                    <div className="mt-1 font-display text-xl font-bold leading-tight">
                      {spotlight.name}
                    </div>
                    <Link
                      href={`/dashboard/listings/${spotlight.id}/edit`}
                      className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-white"
                    >
                      Open listing
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <div
                aria-hidden
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage:
                    "radial-gradient(rgba(16,185,129,0.35) 1px, transparent 1px)",
                  backgroundSize: "18px 18px",
                }}
              />
            )}
            {!spotlight ? (
              <div className="relative flex h-full flex-col justify-end p-7 md:p-8">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent/70">
                  No featured listing yet
                </div>
                <div className="mt-1 font-display text-xl font-bold leading-tight text-white">
                  Publish your first listing
                </div>
                <p className="mt-2 max-w-xs text-[12px] text-brand-accent/70">
                  Once it&rsquo;s live, the highest-rated listing lands here as
                  your portfolio&rsquo;s spotlight.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function FilterBar({
  status,
  q,
  counts,
}: {
  status: StatusFilter;
  q: string;
  counts: { all: number; published: number; draft: number };
}) {
  return (
    <section className="rounded-card border border-brand-line bg-white p-3 shadow-card">
      <form
        action="/dashboard/listings"
        method="GET"
        className="flex flex-wrap items-center gap-2"
      >
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-[10px] border border-brand-line bg-white px-3 py-2 focus-within:border-brand-primary focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]">
          <svg
            className="h-4 w-4 text-brand-mute"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search listings by name, city, or slug…"
            className="flex-1 bg-transparent text-[13px] text-brand-ink placeholder:text-brand-mute focus:outline-none"
          />
          {status !== "all" ? (
            <input type="hidden" name="status" value={status} />
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          <StatusChip
            href="/dashboard/listings"
            label="All"
            count={counts.all}
            active={status === "all"}
          />
          <StatusChip
            href="/dashboard/listings?status=published"
            label="Published"
            count={counts.published}
            active={status === "published"}
            dotClass="bg-status-confirmed"
          />
          <StatusChip
            href="/dashboard/listings?status=draft"
            label="Drafts"
            count={counts.draft}
            active={status === "draft"}
            dotClass="bg-status-draft"
          />
        </div>
      </form>
    </section>
  );
}

function StatusChip({
  href,
  label,
  count,
  active,
  dotClass,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  dotClass?: string;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-pill bg-brand-secondary px-3 py-1.5 text-[12px] font-semibold text-white"
          : "rounded-pill border border-brand-line bg-white px-3 py-1.5 text-[12px] font-medium text-brand-ink hover:bg-brand-accent"
      }
    >
      {dotClass ? (
        <span
          className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${dotClass}`}
        />
      ) : null}
      {label}
      <span
        className={`num ml-1 ${active ? "text-white/70" : "text-brand-mute"}`}
      >
        {count}
      </span>
    </Link>
  );
}

function ListingCard({
  listing,
  isSpotlight,
}: {
  listing: ListingRow;
  isSpotlight: boolean;
}) {
  const photos = (listing.photos ?? []).sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const hero = photos[0];
  const typeLabel = TYPE_LABEL[listing.accommodation_type ?? "other"] ?? "Stay";
  const location = [listing.city, listing.province].filter(Boolean).join(", ");
  const roomCount = (listing.rooms ?? []).length;
  const photoCount = photos.length;

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-card bg-white shadow-card transition-shadow hover:shadow-lift ${
        isSpotlight
          ? "border-2 border-brand-primary"
          : "border border-brand-line"
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-brand-accent">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero.url}
            alt={listing.name}
            className={`h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 ${
              listing.is_published ? "" : "opacity-90"
            }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-brand-mute">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}

        {/* Status pill */}
        {listing.is_published ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill bg-white/95 px-2 py-0.5 text-[10px] font-bold text-brand-secondary backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed" />
            Published
          </span>
        ) : (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill bg-brand-line px-2 py-0.5 text-[10px] font-bold text-brand-mute backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-status-draft" />
            Draft
          </span>
        )}

        {isSpotlight ? (
          <span className="absolute left-3 top-10 inline-flex items-center gap-1 rounded-pill bg-brand-primary px-2 py-0.5 text-[10px] font-bold text-white">
            <Star className="h-2.5 w-2.5" fill="currentColor" />
            Featured
          </span>
        ) : null}

        {photoCount > 0 ? (
          <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-pill bg-brand-dark/80 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
            <ImageIcon className="h-3 w-3" />
            {photoCount} photo{photoCount === 1 ? "" : "s"}
            {roomCount > 0
              ? ` · ${roomCount} room${roomCount === 1 ? "" : "s"}`
              : ""}
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-display text-[16px] font-semibold text-brand-ink">
              {listing.name}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-brand-mute">
              <MapPin className="h-3 w-3" />
              {typeLabel}
              {location ? ` · ${location}` : ""}
            </div>
          </div>
          {listing.base_price != null ? (
            <div className="shrink-0 text-right">
              <div className="num font-display text-[14px] font-bold text-brand-ink">
                {fmtR(Number(listing.base_price), listing.currency)}
              </div>
              <div className="text-[10px] text-brand-mute">/ night</div>
            </div>
          ) : null}
        </div>

        {/* Mini stats — without bookings/rating per-listing aggregates we
            surface the structural info we have: rooms, photos, status. */}
        <div className="mt-4 grid grid-cols-3 gap-3 rounded-[10px] bg-brand-light/60 px-3 py-2.5">
          <Stat label="Rooms" value={roomCount > 0 ? String(roomCount) : "—"} />
          <Stat
            label="Photos"
            value={photoCount > 0 ? String(photoCount) : "—"}
          />
          <Stat
            label="Status"
            value={listing.is_published ? "Live" : "Draft"}
            valueClass={
              listing.is_published ? "text-status-confirmed" : "text-brand-mute"
            }
          />
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-brand-line pt-3 text-[12.5px]">
          <Link
            href={`/dashboard/listings/${listing.id}/edit`}
            className="font-semibold text-brand-primary hover:underline"
          >
            Edit
          </Link>
          {listing.is_published && listing.slug ? (
            <Link
              href={`/listing/${listing.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-brand-mute hover:text-brand-ink"
            >
              View
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          ) : null}
          {listing.slug ? (
            <span className="ml-auto truncate font-mono text-[10.5px] text-brand-mute">
              /{listing.slug}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div
        className={`num mt-0.5 text-[13px] font-bold ${valueClass ?? "text-brand-ink"}`}
      >
        {value}
      </div>
    </div>
  );
}

function AddListingTile() {
  return (
    <Link
      href="/dashboard/listings/new"
      className="group flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-brand-line bg-white p-6 text-center transition-colors hover:border-brand-primary hover:bg-brand-accent/20"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-card bg-brand-accent text-brand-primary transition-transform group-hover:scale-110">
        <Plus className="h-6 w-6" />
      </div>
      <div>
        <div className="font-display text-[15px] font-bold text-brand-ink">
          Add another listing
        </div>
        <p className="mx-auto mt-1 max-w-[18ch] text-[12px] leading-relaxed text-brand-mute">
          Apartment, lodge, guesthouse, or cottage.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1 text-[10.5px] text-brand-mute">
        <span className="rounded-pill border border-brand-line bg-white px-2 py-0.5">
          5-10 min
        </span>
        <span className="rounded-pill border border-brand-line bg-white px-2 py-0.5">
          Save as draft
        </span>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
        <BedDouble className="h-6 w-6" />
      </div>
      <h2 className="font-display text-lg font-bold text-brand-ink">
        No listings yet
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
        Add your first listing to start taking direct bookings.
      </p>
      <Link
        href="/dashboard/listings/new"
        className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
      >
        <Sparkles className="h-4 w-4" />
        Add a listing
      </Link>
    </div>
  );
}
