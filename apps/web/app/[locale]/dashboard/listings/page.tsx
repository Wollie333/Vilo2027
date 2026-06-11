import type { Metadata } from "next";
import {
  AlertCircle,
  ArrowUpRight,
  ArrowUpDown,
  Award,
  BedDouble,
  Calendar,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  LayoutGrid,
  List as ListIcon,
  MapPin,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

import { formatMoney } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";

import {
  OCCUPIED_STATUSES,
  formatNextDate,
  monthWindow,
  occupancyPct,
  overlapNights,
} from "./occupancy";

export const metadata: Metadata = {
  title: "Listings",
};

export const dynamic = "force-dynamic";

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

const PHOTO_TARGET = 8; // Vilo guideline: 8+ photos before publish.

type StatusFilter = "all" | "published" | "draft" | "paused";
type SortKey = "newest" | "booked" | "rating" | "price" | "name";
type ViewMode = "grid" | "list";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "booked", label: "Most booked" },
  { key: "rating", label: "Top rated" },
  { key: "price", label: "Price (high–low)" },
  { key: "name", label: "Name (A–Z)" },
];

type ListingRow = {
  id: string;
  name: string;
  slug: string | null;
  listing_type: string;
  accommodation_type: string | null;
  city: string | null;
  province: string | null;
  description: string | null;
  base_price: number | string | null;
  currency: string;
  is_published: boolean;
  is_suspended: boolean;
  is_featured: boolean;
  avg_rating: number | string | null;
  total_reviews: number | null;
  total_bookings: number | null;
  created_at: string;
  photos: Array<{ url: string; sort_order: number }> | null;
  rooms: Array<{ id: string }> | null;
};

type MonthBookingRow = {
  listing_id: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
};
type UpcomingBookingRow = { listing_id: string; check_in: string | null };

type Derived = ListingRow & {
  status: "published" | "draft" | "paused";
  hero: { url: string; sort_order: number } | undefined;
  photoCount: number;
  roomCount: number;
  rating: number | null;
  reviews: number;
  bookings: number;
  price: number | null;
  typeLabel: string;
  location: string;
  setup: { done: number; total: number; missing: string[] };
  /** This-month occupancy as 0–100, or null when not computable. */
  occupancy: number | null;
  /** Booked nights this month (for the occupancy bar context). */
  bookedNights: number;
  /** Next upcoming check-in, formatted ("Today" / "14 Jun"), or null. */
  nextBooking: string | null;
};

function statusOf(l: ListingRow): "published" | "draft" | "paused" {
  if (l.is_suspended) return "paused";
  return l.is_published ? "published" : "draft";
}

// Real "finish to publish" checklist — computed only from columns we store.
function setupOf(l: ListingRow, photoCount: number, roomCount: number) {
  const checks: { ok: boolean; label: string }[] = [
    { ok: photoCount >= 1, label: "photos" },
    { ok: l.base_price != null, label: "pricing" },
    {
      ok: !!(l.description && l.description.trim().length >= 30),
      label: "description",
    },
    { ok: !!l.city, label: "location" },
    { ok: roomCount >= 1, label: "rooms" },
  ];
  return {
    done: checks.filter((c) => c.ok).length,
    total: checks.length,
    missing: checks.filter((c) => !c.ok).map((c) => c.label),
  };
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams?: {
    status?: string;
    q?: string;
    sort?: string;
    view?: string;
  };
}) {
  const supabase = createServerClient();

  const status = ((): StatusFilter => {
    const raw = searchParams?.status;
    return raw === "published" || raw === "draft" || raw === "paused"
      ? raw
      : "all";
  })();
  const q = (searchParams?.q ?? "").trim();
  const sort: SortKey = SORT_OPTIONS.some((o) => o.key === searchParams?.sort)
    ? (searchParams!.sort as SortKey)
    : "newest";
  const view: ViewMode = searchParams?.view === "list" ? "list" : "grid";

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

  // Calendar-month windows for occupancy. `cur` drives the live KPIs; `prev`
  // gives the month-on-month trend chips. `todayStr` anchors "next booking".
  const now = new Date();
  const cur = monthWindow(now.getUTCFullYear(), now.getUTCMonth());
  const prev = monthWindow(now.getUTCFullYear(), now.getUTCMonth() - 1);
  const todayStr = now.toISOString().slice(0, 10);

  const [
    { data: listingsRaw },
    { data: monthBookings },
    { data: upcomingBookings },
  ] = host
    ? await Promise.all([
        supabase
          .from("listings")
          .select(
            "id, name, slug, listing_type, accommodation_type, city, province, description, base_price, currency, is_published, is_suspended, is_featured, avg_rating, total_reviews, total_bookings, created_at, photos:listing_photos ( url, sort_order ), rooms:listing_rooms ( id )",
          )
          .eq("host_id", host.id)
          .eq("listing_type", "accommodation")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        // Occupied stays overlapping the previous or current month — enough to
        // compute both months' booked nights for the occupancy trend.
        supabase
          .from("bookings")
          .select("listing_id, check_in, check_out, status")
          .eq("host_id", host.id)
          .is("deleted_at", null)
          .in("status", [...OCCUPIED_STATUSES])
          .not("check_in", "is", null)
          .not("check_out", "is", null)
          .lt("check_in", cur.endISO)
          .gt("check_out", prev.startISO),
        // Future arrivals, soonest first — first hit per listing is its "Next".
        supabase
          .from("bookings")
          .select("listing_id, check_in")
          .eq("host_id", host.id)
          .is("deleted_at", null)
          .in("status", [...OCCUPIED_STATUSES])
          .gte("check_in", todayStr)
          .order("check_in", { ascending: true }),
      ])
    : [
        { data: [] as ListingRow[] },
        { data: [] as MonthBookingRow[] },
        { data: [] as UpcomingBookingRow[] },
      ];

  const raw = (listingsRaw as ListingRow[] | null) ?? [];

  // Booked nights per listing for each month, from the overlapping stays.
  const bookedCur = new Map<string, number>();
  const bookedPrev = new Map<string, number>();
  for (const b of (monthBookings as MonthBookingRow[] | null) ?? []) {
    if (!b.check_in || !b.check_out) continue;
    const c = overlapNights(b.check_in, b.check_out, cur);
    if (c > 0)
      bookedCur.set(b.listing_id, (bookedCur.get(b.listing_id) ?? 0) + c);
    const p = overlapNights(b.check_in, b.check_out, prev);
    if (p > 0)
      bookedPrev.set(b.listing_id, (bookedPrev.get(b.listing_id) ?? 0) + p);
  }

  // Soonest future arrival per listing (rows already sorted ascending).
  const nextBy = new Map<string, string>();
  for (const b of (upcomingBookings as UpcomingBookingRow[] | null) ?? []) {
    if (b.check_in && !nextBy.has(b.listing_id))
      nextBy.set(b.listing_id, b.check_in);
  }

  const all: Derived[] = raw.map((l) => {
    const photos = (l.photos ?? []).sort((a, b) => a.sort_order - b.sort_order);
    const photoCount = photos.length;
    const roomCount = (l.rooms ?? []).length;
    const nights = bookedCur.get(l.id) ?? 0;
    const nextDate = nextBy.get(l.id);
    return {
      ...l,
      status: statusOf(l),
      hero: photos[0],
      photoCount,
      roomCount,
      rating: l.avg_rating != null ? Number(l.avg_rating) : null,
      reviews: l.total_reviews ?? 0,
      bookings: l.total_bookings ?? 0,
      price: l.base_price != null ? Number(l.base_price) : null,
      typeLabel: TYPE_LABEL[l.accommodation_type ?? "other"] ?? "Stay",
      location: [l.city, l.province].filter(Boolean).join(", "),
      setup: setupOf(l, photoCount, roomCount),
      occupancy: occupancyPct(nights, cur.days),
      bookedNights: nights,
      nextBooking: nextDate ? formatNextDate(nextDate, todayStr) : null,
    };
  });

  const totalAll = all.length;
  const counts = {
    all: totalAll,
    published: all.filter((l) => l.status === "published").length,
    draft: all.filter((l) => l.status === "draft").length,
    paused: all.filter((l) => l.status === "paused").length,
  };

  // Spotlight = explicit feature flag, else best-rated published listing.
  const spotlight =
    all.find((l) => l.is_featured && l.status === "published") ??
    all
      .filter((l) => l.status === "published")
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];

  // Portfolio KPIs — every figure is computed from real rows, never a
  // placeholder. Occupancy is measured against published (on-sale) inventory.
  const priced = all.filter((l) => l.price != null);
  const avgRate =
    priced.length > 0
      ? priced.reduce((s, l) => s + (l.price ?? 0), 0) / priced.length
      : null;
  const hostRating = host?.avg_rating ? Number(host.avg_rating) : null;
  const hostReviews = host?.total_reviews ?? 0;
  const currency = all[0]?.currency ?? "ZAR";

  const publishedListings = all.filter((l) => l.status === "published");
  const publishedIds = new Set(publishedListings.map((l) => l.id));
  const bookedNightsCur = publishedListings.reduce(
    (s, l) => s + l.bookedNights,
    0,
  );
  const bookedNightsPrev = [...bookedPrev.entries()]
    .filter(([id]) => publishedIds.has(id))
    .reduce((s, [, n]) => s + n, 0);
  const availableNightsCur = cur.days * publishedListings.length;
  const availableNightsPrev = prev.days * publishedListings.length;
  const occCur = occupancyPct(bookedNightsCur, availableNightsCur);
  const occPrev = occupancyPct(bookedNightsPrev, availableNightsPrev);
  // Month-on-month deltas — only shown when last month had something to compare.
  const nightsTrendPct =
    bookedNightsPrev > 0
      ? Math.round(
          ((bookedNightsCur - bookedNightsPrev) / bookedNightsPrev) * 100,
        )
      : null;
  const occTrendPp =
    occCur != null && occPrev != null ? occCur - occPrev : null;

  const filtered = all
    .filter((l) => (status === "all" ? true : l.status === status))
    .filter((l) => {
      if (!q) return true;
      const hay =
        `${l.name} ${l.city ?? ""} ${l.province ?? ""} ${l.slug ?? ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "booked":
        return b.bookings - a.bookings;
      case "rating":
        return (b.rating ?? 0) - (a.rating ?? 0);
      case "price":
        return (b.price ?? 0) - (a.price ?? 0);
      case "name":
        return a.name.localeCompare(b.name);
      default:
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  });

  const recs = buildRecommendations(all);

  return (
    <div className="space-y-6">
      {/* ===== Page header ===== */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-brand-line pb-5">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-tight text-brand-ink">
            Listings
          </h1>
          <p className="mt-1 text-[13.5px] text-brand-mute">
            <CountPart value={totalAll} className="text-brand-ink" />{" "}
            {totalAll === 1 ? "place" : "places"}
            {" · "}
            <CountPart
              value={counts.published}
              className="text-status-confirmed"
            />{" "}
            published
            {" · "}
            <CountPart value={counts.draft} className="text-brand-mute" /> draft
            {counts.paused > 0 ? (
              <>
                {" · "}
                <CountPart
                  value={counts.paused}
                  className="text-status-pending"
                />{" "}
                paused
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/calendar-sync"
            className="hidden h-10 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light sm:inline-flex"
          >
            <RefreshCw className="h-4 w-4 text-brand-mute" />
            Import iCal
          </Link>
          <Link
            href="/dashboard/listings/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-brand-primary px-5 text-[13.5px] font-semibold text-white shadow-glow transition hover:bg-brand-secondary"
          >
            <Plus className="h-4 w-4" />
            New listing
          </Link>
        </div>
      </div>

      {totalAll === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* ===== KPI strip ===== */}
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiCard
              label={`Booked nights · ${cur.label}`}
              chip={
                nightsTrendPct != null && nightsTrendPct !== 0 ? (
                  <TrendChip value={nightsTrendPct} unit="%" />
                ) : (
                  <CountChip>{publishedListings.length} live</CountChip>
                )
              }
            >
              {availableNightsCur > 0 ? (
                <span className="num">
                  {bookedNightsCur}
                  <span className="text-[14px] font-semibold text-brand-mute">
                    /{availableNightsCur}
                  </span>
                </span>
              ) : (
                "—"
              )}
            </KpiCard>
            <KpiCard
              label="Avg nightly rate"
              chip={<CountChip>{priced.length} priced</CountChip>}
            >
              <span className="num">
                {avgRate == null
                  ? "—"
                  : formatMoney(Math.round(avgRate), currency)}
              </span>
            </KpiCard>
            <KpiCard
              label="Portfolio occupancy"
              chip={
                occTrendPp != null && occTrendPp !== 0 ? (
                  <TrendChip value={occTrendPp} unit="pp" />
                ) : (
                  <CountChip>{publishedListings.length} live</CountChip>
                )
              }
            >
              <span className="num">{occCur == null ? "—" : `${occCur}%`}</span>
            </KpiCard>
            <KpiCard
              label="Avg rating"
              chip={
                <CountChip>
                  {hostReviews} review{hostReviews === 1 ? "" : "s"}
                </CountChip>
              }
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="num">
                  {hostRating == null ? "—" : hostRating.toFixed(2)}
                </span>
                <Star
                  className="h-4 w-4"
                  style={{ fill: "#F59E0B", color: "#F59E0B" }}
                />
              </span>
            </KpiCard>
          </section>

          {/* ===== Filter card ===== */}
          <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            {/* tabs */}
            <div
              className="flex items-stretch overflow-x-auto border-b border-brand-line px-5"
              style={{ scrollbarWidth: "none" }}
            >
              <Tab
                label="All"
                count={counts.all}
                active={status === "all"}
                href={buildUrl(searchParams, { status: undefined })}
              />
              <Tab
                label="Published"
                count={counts.published}
                active={status === "published"}
                href={buildUrl(searchParams, { status: "published" })}
              />
              <Tab
                label="Drafts"
                count={counts.draft}
                active={status === "draft"}
                href={buildUrl(searchParams, { status: "draft" })}
              />
              {counts.paused > 0 ? (
                <Tab
                  label="Paused"
                  count={counts.paused}
                  active={status === "paused"}
                  href={buildUrl(searchParams, { status: "paused" })}
                />
              ) : null}
            </div>

            {/* filter row */}
            <div className="flex flex-wrap items-center gap-2 bg-[#FBFDFC] px-5 py-3">
              <form
                action="/dashboard/listings"
                method="GET"
                className="flex min-w-[220px] flex-1 items-center gap-2 rounded-[9px] border border-brand-line bg-white px-3 py-2 transition focus-within:border-brand-primary focus-within:shadow-ring"
              >
                <Search className="h-4 w-4 text-brand-mute" />
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder="Search by name, city, or slug…"
                  className="flex-1 bg-transparent text-[13px] text-brand-ink placeholder:text-brand-mute focus:outline-none"
                />
                {status !== "all" ? (
                  <input type="hidden" name="status" value={status} />
                ) : null}
                {sort !== "newest" ? (
                  <input type="hidden" name="sort" value={sort} />
                ) : null}
                {view !== "grid" ? (
                  <input type="hidden" name="view" value={view} />
                ) : null}
              </form>

              {/* sort */}
              <details className="group relative">
                <summary className="fpill flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-[9px] border border-brand-line bg-white px-3 text-[12.5px] font-medium text-brand-ink [&::-webkit-details-marker]:hidden">
                  <ArrowUpDown className="h-3.5 w-3.5 text-brand-mute" />
                  <span className="text-brand-mute">Sort:</span>
                  {SORT_OPTIONS.find((o) => o.key === sort)?.label}
                  <ChevronDown className="h-3.5 w-3.5 text-brand-mute" />
                </summary>
                <div className="absolute right-0 z-20 mt-1.5 w-48 overflow-hidden rounded-[10px] border border-brand-line bg-white py-1 shadow-lift">
                  {SORT_OPTIONS.map((o) => (
                    <Link
                      key={o.key}
                      href={buildUrl(searchParams, {
                        sort: o.key === "newest" ? undefined : o.key,
                      })}
                      className={`block px-3.5 py-1.5 text-[12.5px] ${
                        o.key === sort
                          ? "bg-brand-light font-semibold text-brand-secondary"
                          : "text-brand-ink hover:bg-brand-light"
                      }`}
                    >
                      {o.label}
                    </Link>
                  ))}
                </div>
              </details>

              {/* view toggle */}
              <div className="ml-auto inline-flex items-center rounded-[9px] border border-brand-line bg-white p-0.5">
                <Link
                  href={buildUrl(searchParams, { view: undefined })}
                  title="Grid"
                  className={`flex h-7 w-8 items-center justify-center rounded-[7px] ${
                    view === "grid"
                      ? "bg-brand-secondary text-white"
                      : "text-brand-mute hover:text-brand-ink"
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Link>
                <Link
                  href={buildUrl(searchParams, { view: "list" })}
                  title="List"
                  className={`flex h-7 w-8 items-center justify-center rounded-[7px] ${
                    view === "list"
                      ? "bg-brand-secondary text-white"
                      : "text-brand-mute hover:text-brand-ink"
                  }`}
                >
                  <ListIcon className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>

          {/* ===== Listings ===== */}
          {sorted.length === 0 ? (
            <div className="py-16 text-center text-brand-mute">
              <SearchX className="mx-auto mb-2 h-7 w-7 text-brand-mute/60" />
              <div className="text-[14px]">
                No listings match those filters.
              </div>
            </div>
          ) : view === "grid" ? (
            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {sorted.map((l) => (
                <ListingCard
                  key={l.id}
                  l={l}
                  isSpotlight={l.id === spotlight?.id}
                />
              ))}
              {status === "all" || status === "draft" ? (
                <AddListingTile />
              ) : null}
            </section>
          ) : (
            <section className="flex flex-col gap-3">
              {sorted.map((l) => (
                <ListingRowItem
                  key={l.id}
                  l={l}
                  isSpotlight={l.id === spotlight?.id}
                />
              ))}
            </section>
          )}

          {/* ===== Listing health ===== */}
          {recs.length > 0 ? (
            <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                    Listing health
                  </div>
                  <span className="num inline-flex items-center rounded-pill bg-brand-accent px-2 py-0.5 text-[10.5px] font-semibold text-brand-secondary">
                    {recs.length}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-brand-line">
                {recs.map((r, i) => (
                  <RecRow key={i} rec={r} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function CountPart({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <span className={`num font-semibold ${className ?? "text-brand-ink"}`}>
      {value}
    </span>
  );
}

function KpiCard({
  label,
  chip,
  children,
}: {
  label: string;
  chip: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
          {label}
        </span>
        {chip}
      </div>
      <div className="mt-2 font-display text-[26px] font-bold leading-none text-brand-ink">
        {children}
      </div>
    </div>
  );
}

// Muted pill for a contextual count (e.g. "6 priced").
function CountChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="num inline-flex items-center gap-1 whitespace-nowrap rounded-pill bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold text-brand-mute">
      {children}
    </span>
  );
}

// Month-on-month delta pill — green up / red down. `unit` is "%" (booked
// nights) or "pp" (occupancy points).
function TrendChip({ value, unit }: { value: number; unit: "%" | "pp" }) {
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`num inline-flex items-center gap-1 whitespace-nowrap rounded-pill bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold ${
        up ? "text-status-confirmed" : "text-status-cancelled"
      }`}
    >
      <Icon className="h-3 w-3" />
      {up ? "+" : "−"}
      {Math.abs(value)}
      {unit}
    </span>
  );
}

function Tab({
  label,
  count,
  active,
  href,
}: {
  label: string;
  count: number;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`relative mx-4 inline-flex items-center gap-2 whitespace-nowrap py-[13px] text-[13.5px] font-semibold first:ml-0 ${
        active ? "text-brand-secondary" : "text-brand-mute hover:text-brand-ink"
      }`}
    >
      {label}
      <span
        className={`num rounded-pill border px-[7px] py-px text-[11px] ${
          active
            ? "border-brand-accent bg-brand-accent text-brand-secondary"
            : "border-brand-line bg-brand-light text-brand-mute"
        }`}
      >
        {count}
      </span>
      {active ? (
        <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-[3px] bg-brand-primary" />
      ) : null}
    </Link>
  );
}

const STATUS_TAG: Record<Derived["status"], { cls: string; label: string }> = {
  published: {
    cls: "border-[#C7F0DC] bg-[#ECFDF5] text-[#047857]",
    label: "Published",
  },
  draft: {
    cls: "border-brand-line bg-[#F4F7F5] text-[#5B7065]",
    label: "Draft",
  },
  paused: {
    cls: "border-[#FCE9B6] bg-[#FFFBEB] text-[#B45309]",
    label: "Paused",
  },
};
const STATUS_DOT: Record<Derived["status"], string> = {
  published: "#10B981",
  draft: "#94A3B8",
  paused: "#F59E0B",
};

function StatusTag({ status }: { status: Derived["status"] }) {
  const t = STATUS_TAG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border px-2.5 py-[3px] text-[11.5px] font-semibold ${t.cls}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: STATUS_DOT[status] }}
      />
      {t.label}
    </span>
  );
}

function MiniStat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
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

function RatingStat({ rating }: { rating: number | null }) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold uppercase tracking-wider text-brand-mute">
        Rating
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-[13px] font-bold text-brand-ink">
        <Star
          className="h-3 w-3"
          style={{ fill: "#F59E0B", color: "#F59E0B" }}
        />
        <span className="num">{rating == null ? "—" : rating.toFixed(2)}</span>
      </div>
    </div>
  );
}

function ListingCard({ l, isSpotlight }: { l: Derived; isSpotlight: boolean }) {
  const top = isSpotlight && l.status === "published";
  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-card bg-white shadow-card transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-lift ${
        top ? "border-2 border-brand-primary" : "border border-brand-line"
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-brand-accent">
        {l.hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={l.hero.url}
            alt={l.name}
            loading="lazy"
            className={`h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 ${
              l.status === "draft"
                ? "opacity-90 grayscale-[15%]"
                : l.status === "paused"
                  ? "opacity-80"
                  : ""
            }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-brand-mute">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}

        <span className="absolute left-3 top-3 backdrop-blur-[4px]">
          <StatusTag status={l.status} />
        </span>

        {top ? (
          <span className="absolute left-3 top-12 inline-flex items-center gap-1 rounded-pill bg-brand-primary px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            <Award className="h-2.5 w-2.5" />
            Top performer
          </span>
        ) : null}

        <button
          type="button"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-brand-ink shadow-sm backdrop-blur hover:bg-white"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {l.status === "draft" ? (
          <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-pill bg-status-pending px-2 py-0.5 text-[10px] font-bold text-white">
            <AlertCircle className="h-3 w-3" />
            {l.setup.total - l.setup.done} step
            {l.setup.total - l.setup.done === 1 ? "" : "s"} left
          </div>
        ) : l.status === "published" ? (
          <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-pill bg-brand-dark/75 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
            <ImageIcon className="h-3 w-3" />
            {l.photoCount} photo{l.photoCount === 1 ? "" : "s"}
          </div>
        ) : null}

        {l.status === "paused" ? (
          <>
            <div className="absolute inset-0 bg-brand-dark/35" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-pill bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-brand-ink shadow-lift">
                Hidden from search
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-display text-[16px] font-semibold text-brand-ink">
              {l.name}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-brand-mute">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {l.typeLabel}
                {l.location ? ` · ${l.location}` : ""}
              </span>
            </div>
          </div>
          {l.price != null ? (
            <div className="shrink-0 text-right">
              <div
                className={`num whitespace-nowrap font-display text-[14px] font-bold ${
                  l.status === "draft" ? "text-brand-mute" : "text-brand-ink"
                }`}
              >
                {formatMoney(l.price, l.currency)}
              </div>
              <div className="whitespace-nowrap text-[10px] text-brand-mute">
                / night
              </div>
            </div>
          ) : null}
        </div>

        {l.status === "draft" ? (
          <>
            <div className="mt-4 rounded-[12px] border border-status-pending/30 bg-status-pending/5 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-status-pending">
                  Finish to publish
                </div>
                <div className="num text-[11px] font-bold text-brand-ink">
                  {l.setup.done}
                  <span className="text-brand-mute">/{l.setup.total}</span>
                </div>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-pill"
                style={{ background: "#FDF0D6" }}
              >
                <span
                  className="block h-full rounded-pill"
                  style={{
                    width: `${Math.round((l.setup.done / l.setup.total) * 100)}%`,
                    background: "#F59E0B",
                  }}
                />
              </div>
              {l.setup.missing.length > 0 ? (
                <div className="mt-2 text-[11.5px] text-brand-mute">
                  Missing: {l.setup.missing.join(", ")}
                </div>
              ) : null}
            </div>
            <CardFooter l={l}>
              <Link
                href={`/dashboard/listings/${l.id}/edit`}
                className="font-semibold text-brand-primary hover:underline"
              >
                Continue setup
              </Link>
            </CardFooter>
          </>
        ) : l.status === "published" ? (
          <>
            <div
              className="mt-4 grid grid-cols-3 gap-3 rounded-[12px] px-3 py-2.5"
              style={{ background: top ? "#D1FAE5" : "#F0FDF4" }}
            >
              <MiniStat
                label="Occupancy"
                value={
                  <span className="num">
                    {l.occupancy == null ? "—" : `${l.occupancy}%`}
                  </span>
                }
              />
              <MiniStat label="Next" value={l.nextBooking ?? "—"} />
              <RatingStat rating={l.rating} />
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-pill bg-[#EAF4EE]">
              <span
                className="block h-full rounded-pill bg-brand-primary"
                style={{ width: `${l.occupancy ?? 0}%` }}
              />
            </div>
            <CardFooter l={l}>
              <Link
                href={`/dashboard/listings/${l.id}/edit`}
                className="font-semibold text-brand-primary hover:underline"
              >
                Edit
              </Link>
              {l.slug ? (
                <Link
                  href={`/listing/${l.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-brand-mute hover:text-brand-ink"
                >
                  View
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              ) : null}
            </CardFooter>
          </>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-3 gap-3 rounded-[12px] bg-brand-light px-3 py-2.5">
              <MiniStat
                label="Bookings"
                value={<span className="num">{l.bookings}</span>}
              />
              <MiniStat
                label="Reviews"
                value={<span className="num">{l.reviews}</span>}
              />
              <RatingStat rating={l.rating} />
            </div>
            <CardFooter l={l}>
              <Link
                href={`/dashboard/listings/${l.id}/edit`}
                className="font-semibold text-brand-primary hover:underline"
              >
                Resume
              </Link>
            </CardFooter>
          </>
        )}
      </div>
    </article>
  );
}

function CardFooter({
  l,
  children,
}: {
  l: Derived;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 flex items-center gap-3 border-t border-brand-line pt-3 text-[12.5px]">
      {children}
      {l.slug ? (
        <span className="ml-auto truncate font-mono text-[10.5px] text-brand-mute">
          /{l.slug}
        </span>
      ) : null}
    </div>
  );
}

function ListingRowItem({
  l,
  isSpotlight,
}: {
  l: Derived;
  isSpotlight: boolean;
}) {
  const top = isSpotlight && l.status === "published";
  return (
    <Link
      href={`/dashboard/listings/${l.id}/edit`}
      className={`flex items-center gap-4 rounded-card border bg-white p-3 shadow-card transition-[border-color,box-shadow] hover:border-[#CDE6D8] hover:shadow-lift ${
        top ? "border-brand-primary" : "border-brand-line"
      }`}
    >
      <div className="h-16 w-20 shrink-0 overflow-hidden rounded-[11px] bg-brand-accent">
        {l.hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.hero.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-brand-mute">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-[15px] font-semibold text-brand-ink">
            {l.name}
          </span>
          <StatusTag status={l.status} />
          {top ? (
            <span className="hidden rounded-pill bg-brand-accent px-2 py-0.5 text-[10px] font-semibold text-brand-secondary sm:inline-block">
              Top
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-brand-mute">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {l.typeLabel}
            {l.location ? ` · ${l.location}` : ""}
          </span>
          {l.slug ? (
            <span className="ml-1 hidden font-mono text-[10.5px] md:inline">
              /{l.slug}
            </span>
          ) : null}
        </div>
      </div>
      {l.price != null ? (
        <div className="hidden shrink-0 text-right sm:block">
          <div className="num whitespace-nowrap font-display text-[14px] font-bold text-brand-ink">
            {formatMoney(l.price, l.currency)}
          </div>
          <div className="whitespace-nowrap text-[10px] text-brand-mute">
            / night
          </div>
        </div>
      ) : null}
      <div className="hidden w-[180px] shrink-0 justify-end md:flex">
        {l.status === "draft" ? (
          <span className="num text-[12.5px] font-semibold text-status-pending">
            {l.setup.done}/{l.setup.total} steps
          </span>
        ) : l.status === "paused" ? (
          <span className="text-[12.5px] text-brand-mute">
            Hidden from search
          </span>
        ) : (
          <span className="inline-flex items-center gap-3 text-[12.5px]">
            <span className="num font-semibold text-brand-ink">
              {l.occupancy == null ? "—" : `${l.occupancy}% occ`}
            </span>
            <span className="num inline-flex items-center gap-1 font-semibold text-brand-ink">
              <Star
                className="h-3 w-3"
                style={{ fill: "#F59E0B", color: "#F59E0B" }}
              />
              {l.rating == null ? "—" : l.rating.toFixed(2)}
            </span>
          </span>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-brand-mute" />
    </Link>
  );
}

function AddListingTile() {
  return (
    <Link
      href="/dashboard/listings/new"
      className="group flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-brand-line bg-white p-6 text-center transition-colors hover:border-brand-primary hover:bg-brand-light"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-card bg-brand-accent text-brand-primary transition-transform group-hover:scale-110">
        <Plus className="h-6 w-6" />
      </div>
      <div>
        <div className="font-display text-[15px] font-bold text-brand-ink">
          Add another listing
        </div>
        <p className="mx-auto mt-1 max-w-[20ch] text-[12px] leading-relaxed text-brand-mute">
          Apartment, lodge, guesthouse, or cottage.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10.5px] text-brand-mute">
        <span className="rounded-pill border border-brand-line bg-white px-2 py-0.5">
          5–10 min
        </span>
        <span className="rounded-pill border border-brand-line bg-white px-2 py-0.5">
          Save as draft
        </span>
      </div>
    </Link>
  );
}

type Rec = {
  priority: "High" | "Medium";
  icon: "image" | "calendar" | "trending";
  title: React.ReactNode;
  body: string;
  cta: { label: string; href: string };
};

function buildRecommendations(all: Derived[]): Rec[] {
  const recs: Rec[] = [];
  for (const l of all) {
    if (l.status === "draft") {
      recs.push({
        priority: "High",
        icon: "calendar",
        title: (
          <>
            Finish setup for{" "}
            <span className="text-brand-primary">{l.name}</span>
          </>
        ),
        body: `${l.setup.total - l.setup.done} step${
          l.setup.total - l.setup.done === 1 ? "" : "s"
        } left${l.setup.missing.length ? ` · missing ${l.setup.missing.join(", ")}` : ""}.`,
        cta: {
          label: "Continue setup",
          href: `/dashboard/listings/${l.id}/edit`,
        },
      });
      continue;
    }
    if (l.status === "published" && l.photoCount < PHOTO_TARGET) {
      recs.push({
        priority: "High",
        icon: "image",
        title: (
          <>
            Add {PHOTO_TARGET - l.photoCount} more photo
            {PHOTO_TARGET - l.photoCount === 1 ? "" : "s"} to{" "}
            <span className="text-brand-primary">{l.name}</span>
          </>
        ),
        body: `Vilo guideline: ${PHOTO_TARGET}+ photos before publish. Listings with ${PHOTO_TARGET}+ photos book far more often.`,
        cta: {
          label: "Upload photos",
          href: `/dashboard/listings/${l.id}/edit`,
        },
      });
    }
    if (l.status === "published" && l.price == null) {
      recs.push({
        priority: "High",
        icon: "trending",
        title: (
          <>
            Set a nightly price for{" "}
            <span className="text-brand-primary">{l.name}</span>
          </>
        ),
        body: "This listing is live without a base price — guests can't see what a night costs.",
        cta: { label: "Set pricing", href: `/dashboard/listings/${l.id}/edit` },
      });
    }
  }
  // Highest-value first, cap to keep the panel calm.
  return recs
    .sort((a, b) =>
      a.priority === b.priority ? 0 : a.priority === "High" ? -1 : 1,
    )
    .slice(0, 4);
}

function RecRow({ rec }: { rec: Rec }) {
  const Icon =
    rec.icon === "image"
      ? ImageIcon
      : rec.icon === "trending"
        ? TrendingUp
        : Calendar;
  const iconTone =
    rec.priority === "High"
      ? "bg-status-pending/12 text-status-pending"
      : "bg-brand-accent text-brand-secondary";
  const tag =
    rec.priority === "High"
      ? "border-[#FCE9B6] bg-[#FFFBEB] text-[#B45309]"
      : "border-brand-line bg-[#F4F7F5] text-[#5B7065]";
  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${iconTone}`}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[13.5px] font-semibold text-brand-ink">
            {rec.title}
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-2.5 py-[3px] text-[11.5px] font-semibold ${tag}`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: rec.priority === "High" ? "#F59E0B" : "#94A3B8",
              }}
            />
            {rec.priority}
          </span>
        </div>
        <p className="mt-0.5 text-[12.5px] text-brand-mute">{rec.body}</p>
        <Link
          href={rec.cta.href}
          className="mt-1.5 inline-block text-[12px] font-semibold text-brand-primary hover:underline"
        >
          {rec.cta.label} →
        </Link>
      </div>
    </div>
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

// Build a /dashboard/listings URL, preserving current params and applying
// patch (undefined removes a param). Keeps tab/sort/view server-rendered.
function buildUrl(
  current:
    | { status?: string; q?: string; sort?: string; view?: string }
    | undefined,
  patch: Partial<{ status: string; q: string; sort: string; view: string }>,
): string {
  const merged = { ...(current ?? {}), ...patch };
  const sp = new URLSearchParams();
  for (const key of ["status", "q", "sort", "view"] as const) {
    const v = merged[key];
    if (v) sp.set(key, v);
  }
  const qs = sp.toString();
  return qs ? `/dashboard/listings?${qs}` : "/dashboard/listings";
}
