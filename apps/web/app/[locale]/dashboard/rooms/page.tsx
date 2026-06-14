import type { Metadata } from "next";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BedDouble,
  ChevronRight,
  Image as ImageIcon,
  ImageOff,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

import { createServerClient } from "@/lib/supabase/server";

import type { EditorRoom } from "../listings/[id]/edit/Editor";
import { type BedKind, bedKindLabel } from "../listings/[id]/edit/schemas";

export const metadata: Metadata = {
  title: "Rooms",
};

export const dynamic = "force-dynamic";

const OCC_DAYS = 14; // 14-day occupancy window shown per room.

type BookingMode = "whole_listing" | "rooms_only" | "flexible";

const BOOKING_MODE_LABEL: Record<BookingMode, string> = {
  whole_listing: "Whole listing",
  rooms_only: "Rooms only",
  flexible: "Flexible booking",
};

const BOOKING_MODE_PILL: Record<BookingMode, string> = {
  whole_listing: "border border-brand-line bg-brand-light text-brand-mute",
  rooms_only: "border border-brand-line bg-brand-light text-brand-mute",
  flexible: "bg-brand-accent text-brand-secondary",
};

type Group = {
  listing: {
    id: string;
    name: string;
    slug: string | null;
    booking_mode: BookingMode;
    is_published: boolean;
    cover_photo_url: string | null;
    city: string | null;
    province: string | null;
  };
  rooms: EditorRoom[];
};

// One day in a room's 14-day occupancy strip.
type Cell = "b" | "h" | "x" | "o"; // booked · held · blocked · open
type Occ = { cells: Cell[]; booked: number; pct: number };

function describeBeds(beds: EditorRoom["beds"]): string {
  if (!beds || beds.length === 0) return "Beds not set";
  return beds
    .map((b) => {
      const label = bedKindLabel(b.bed_kind as BedKind, b.quantity);
      return b.quantity > 1
        ? `${b.quantity} ${label.toLowerCase()}`
        : `1 ${label.toLowerCase()}`;
    })
    .join(" · ");
}

function describeRoomFeatures(r: EditorRoom): string {
  const parts: string[] = [];
  if (r.has_ensuite_bathroom) parts.push("en-suite");
  else if ((r.bathrooms ?? 0) > 0) parts.push("private bath");
  if (r.view_type) parts.push(`${r.view_type.replace(/_/g, " ")} view`);
  if (r.private_entrance) parts.push("private entrance");
  return parts.slice(0, 2).join(" · ");
}

// All currency on this page is assumed ZAR (single-currency host).
function fmtRand(n: number): string {
  return `R ${Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}

// The single nightly figure used for averages — for per-person rooms the
// rate lives in price_per_person (base_price is saved as 0).
function effectiveNightly(r: EditorRoom): number {
  if (r.pricing_mode === "per_person") return r.price_per_person ?? 0;
  return r.base_price;
}

// Headline rate + caption for the table, resolved per pricing mode. Returns
// null only when no rate has actually been set for the room's mode.
function roomRate(r: EditorRoom): { amount: string; sub: string } | null {
  if (r.pricing_mode === "per_person") {
    const pp = r.price_per_person ?? 0;
    if (pp <= 0) return null;
    return { amount: fmtRand(pp), sub: "per person / night" };
  }
  if (r.pricing_mode === "per_room_plus_extra") {
    if (r.base_price <= 0) return null;
    const extra = r.extra_guest_price ?? 0;
    const covers = r.base_occupancy ?? null;
    return {
      amount: fmtRand(r.base_price),
      sub:
        extra > 0
          ? `${covers ? `${covers} guest${covers === 1 ? "" : "s"}` : "base"} · +${fmtRand(extra)}/extra`
          : "from / night",
    };
  }
  if (r.base_price <= 0) return null;
  const weekendBump =
    r.weekend_price && r.base_price > 0
      ? Math.round(((r.weekend_price - r.base_price) / r.base_price) * 100)
      : null;
  return {
    amount: fmtRand(r.base_price),
    sub:
      weekendBump != null && weekendBump !== 0
        ? `Weekend ${weekendBump > 0 ? "+" : ""}${weekendBump}%`
        : r.cleaning_fee > 0
          ? `+ ${fmtRand(r.cleaning_fee)} cleaning`
          : "per night",
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default async function RoomsPage({
  searchParams,
}: {
  searchParams?: { listing?: string; status?: string; q?: string };
}) {
  const supabase = createServerClient();

  // Scope to the logged-in host. `listings` has a `public_read_published` RLS
  // policy, so the explicit host_id filter is what keeps the portfolio private
  // — never remove it. Resolve the host by user_id, not RLS.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: host } = user
    ? await supabase
        .from("hosts")
        .select("id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle()
    : { data: null };

  const { data: listings } = host
    ? await supabase
        .from("listings")
        .select(
          "id, name, slug, booking_mode, is_published, city, province, deleted_at, listing_photos!listing_photos_listing_id_fkey ( url, sort_order, room_id ), rooms:listing_rooms ( id, name, description, bedrooms, bathrooms, max_guests, min_guests, min_nights, base_price, weekend_price, cleaning_fee, sort_order, is_active, deleted_at, room_size_sqm, bed_type, view_type, experiences, has_ensuite_bathroom, smoking_allowed, pets_allowed, wheelchair_accessible, private_entrance, floor_number, inventory_count, pricing_mode, price_per_person, base_occupancy, extra_guest_price, featured_photo_id, featured_photo:listing_photos!listing_rooms_featured_photo_id_fkey ( url ), beds:room_beds ( bed_kind, quantity, sleeps, sort_order ), photos:listing_photos!listing_photos_room_id_fkey ( id, url, sort_order ), amenities:listing_amenities!listing_amenities_room_id_fkey ( amenity_key ) )",
        )
        .eq("host_id", host.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
    : { data: null };

  const groups: Group[] = (listings ?? []).map((l) => {
    const rawRooms = (l.rooms as Array<Record<string, unknown>> | null) ?? [];

    const rooms: EditorRoom[] = rawRooms
      .filter((r) => r.deleted_at === null)
      .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
      .map((r) => {
        const fpRaw = r.featured_photo as
          | { url: string }
          | Array<{ url: string }>
          | null;
        const fp = Array.isArray(fpRaw) ? fpRaw[0] : fpRaw;
        const beds = (
          (r.beds as Array<{
            bed_kind: string;
            quantity: number;
            sleeps: number;
            sort_order: number;
          }> | null) ?? []
        )
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((b) => ({
            bed_kind: b.bed_kind,
            quantity: b.quantity,
            sleeps: b.sleeps,
          }));
        const photos = (
          (r.photos as Array<{
            id: string;
            url: string;
            sort_order: number;
          }> | null) ?? []
        )
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((p) => ({ id: p.id, url: p.url }));
        const amenityKeys = (
          (r.amenities as Array<{ amenity_key: string }> | null) ?? []
        ).map((a) => a.amenity_key);
        return {
          id: r.id as string,
          name: r.name as string,
          description: (r.description as string | null) ?? null,
          bedrooms: (r.bedrooms as number | null) ?? null,
          bathrooms: (r.bathrooms as number | null) ?? null,
          max_guests: r.max_guests as number,
          min_guests: (r.min_guests as number | null) ?? 1,
          min_nights: (r.min_nights as number | null) ?? 1,
          base_price: Number(r.base_price),
          weekend_price:
            r.weekend_price == null ? null : Number(r.weekend_price),
          cleaning_fee: Number(r.cleaning_fee ?? 0),
          sort_order: r.sort_order as number,
          is_active: r.is_active as boolean,
          room_size_sqm:
            r.room_size_sqm == null ? null : Number(r.room_size_sqm),
          bed_type: (r.bed_type as string | null) ?? null,
          view_type: (r.view_type as string | null) ?? null,
          experiences: (r.experiences as string[] | null) ?? [],
          has_ensuite_bathroom: (r.has_ensuite_bathroom as boolean) ?? false,
          smoking_allowed: (r.smoking_allowed as boolean) ?? false,
          pets_allowed: (r.pets_allowed as boolean) ?? false,
          wheelchair_accessible: (r.wheelchair_accessible as boolean) ?? false,
          private_entrance: (r.private_entrance as boolean) ?? false,
          floor_number: (r.floor_number as number | null) ?? null,
          inventory_count: (r.inventory_count as number | null) ?? 1,
          pricing_mode: ((r.pricing_mode as string | null) ??
            "per_room") as EditorRoom["pricing_mode"],
          price_per_person:
            r.price_per_person == null ? null : Number(r.price_per_person),
          base_occupancy: (r.base_occupancy as number | null) ?? null,
          extra_guest_price:
            r.extra_guest_price == null ? null : Number(r.extra_guest_price),
          featured_photo_id: (r.featured_photo_id as string | null) ?? null,
          beds,
          // Thumbnail = the room's featured photo; if none is set explicitly,
          // fall back to its first photo so the thumbnail still shows an image.
          featuredPhotoUrl: fp?.url ?? photos[0]?.url ?? null,
          featuredPhotoId: (r.featured_photo_id as string | null) ?? null,
          photos,
          amenityKeys,
        };
      });

    const listingPhotos =
      (l.listing_photos as Array<{
        url: string;
        sort_order: number;
        room_id: string | null;
      }> | null) ?? [];
    const coverPhoto = listingPhotos
      .filter((p) => p.room_id === null)
      .sort((a, b) => a.sort_order - b.sort_order)[0];

    return {
      listing: {
        id: l.id,
        name: l.name,
        slug: l.slug,
        booking_mode: l.booking_mode as BookingMode,
        is_published: l.is_published,
        cover_photo_url: coverPhoto?.url ?? rooms[0]?.featuredPhotoUrl ?? null,
        city: (l as { city: string | null }).city ?? null,
        province: (l as { province: string | null }).province ?? null,
      },
      rooms,
    };
  });

  // ── 14-day occupancy, computed from real blocked_dates ──────────────────
  // Each confirmed booking / hold / manual block writes rows here; we classify
  // a day as booked (booking/ical), held (quote hold) or blocked (manual).
  const today = new Date();
  const days = Array.from({ length: OCC_DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return { ymd: ymd(d), dom: d.getDate(), isToday: i === 0 };
  });
  const rangeStart = days[0].ymd;
  const rangeEnd = days[OCC_DAYS - 1].ymd;
  const listingIds = groups.map((g) => g.listing.id);

  const { data: blockRows } = listingIds.length
    ? await supabase
        .from("blocked_dates")
        .select("listing_id, room_id, date, source, booking_id, quote_id")
        .in("listing_id", listingIds)
        .gte("date", rangeStart)
        .lte("date", rangeEnd)
    : { data: [] as BlockRow[] };

  type BlockRow = {
    listing_id: string;
    room_id: string | null;
    date: string;
    source: string;
    booking_id: string | null;
    quote_id: string | null;
  };
  const classify = (b: BlockRow): Exclude<Cell, "o"> => {
    if (b.booking_id || b.source === "booking" || b.source === "ical")
      return "b";
    if (b.quote_id || b.source === "hold" || b.source === "quote") return "h";
    return "x";
  };

  // listing-wide blocks (room_id null) apply to every room in that listing.
  const listingWide = new Map<string, Map<string, Cell>>();
  const perRoom = new Map<string, Map<string, Cell>>();
  for (const raw of (blockRows as BlockRow[] | null) ?? []) {
    const cell = classify(raw);
    if (raw.room_id) {
      const m = perRoom.get(raw.room_id) ?? new Map();
      // Booked wins over held wins over blocked if two rows clash.
      if (rank(m.get(raw.date)) < rank(cell)) m.set(raw.date, cell);
      perRoom.set(raw.room_id, m);
    } else {
      const m = listingWide.get(raw.listing_id) ?? new Map();
      if (rank(m.get(raw.date)) < rank(cell)) m.set(raw.date, cell);
      listingWide.set(raw.listing_id, m);
    }
  }
  const occFor = (listingId: string, roomId: string): Occ => {
    const rm = perRoom.get(roomId);
    const lm = listingWide.get(listingId);
    const cells = days.map<Cell>(
      (d) => rm?.get(d.ymd) ?? lm?.get(d.ymd) ?? "o",
    );
    const booked = cells.filter((c) => c !== "o").length;
    return { cells, booked, pct: Math.round((booked / OCC_DAYS) * 100) };
  };
  const occByRoom = new Map<string, Occ>();
  for (const g of groups)
    for (const r of g.rooms) occByRoom.set(r.id, occFor(g.listing.id, r.id));

  // ── Portfolio aggregates (all real) ──
  const totalRooms = groups.reduce((a, g) => a + g.rooms.length, 0);
  const activeRoomsList = groups.flatMap((g) =>
    g.rooms.filter((r) => r.is_active),
  );
  const activeRooms = activeRoomsList.length;
  const draftRooms = totalRooms - activeRooms;
  const listingsCount = groups.length;

  const pricedActive = activeRoomsList.filter((r) => roomRate(r) != null);
  const rates = pricedActive.map((r) => effectiveNightly(r));
  const avgRate =
    rates.length === 0
      ? 0
      : Math.round(rates.reduce((a, n) => a + n, 0) / rates.length);
  const minRate = rates.length ? Math.min(...rates) : 0;
  const maxRate = rates.length ? Math.max(...rates) : 0;

  const occBookedTotal = activeRoomsList.reduce(
    (a, r) => a + (occByRoom.get(r.id)?.booked ?? 0),
    0,
  );
  const avgOccupancy =
    activeRooms === 0
      ? 0
      : Math.round((occBookedTotal / (activeRooms * OCC_DAYS)) * 100);
  const openTonight = activeRoomsList.filter(
    (r) => occByRoom.get(r.id)?.cells[0] === "o",
  ).length;
  const unpriced = activeRoomsList.filter((r) => roomRate(r) == null).length;

  // Needs attention — real, actionable signals only.
  const attention: AttnItem[] = [];
  for (const g of groups) {
    for (const r of g.rooms) {
      if (attention.length >= 6) break;
      if ((r.photos?.length ?? 0) === 0) {
        attention.push({
          icon: "photo",
          title: `${r.name} · no photos`,
          sub: "Rooms with photos get far more bookings.",
          cta: "Upload",
          href: `/dashboard/listings/${g.listing.id}/edit/rooms/${r.id}`,
        });
      } else if (r.is_active && roomRate(r) == null) {
        attention.push({
          icon: "rate",
          title: `${r.name} · no rate`,
          sub: "Set a nightly rate so guests can book it.",
          cta: "Set rate",
          href: `/dashboard/listings/${g.listing.id}/edit/rooms/${r.id}`,
        });
      }
    }
  }

  // Top performers — active rooms by real 14-day occupancy.
  const topPerformers = activeRoomsList
    .map((r) => {
      const g = groups.find((gr) => gr.rooms.some((x) => x.id === r.id))!;
      return { room: r, listing: g.listing, occ: occByRoom.get(r.id)! };
    })
    .filter((t) => t.occ.booked > 0)
    .sort((a, b) => b.occ.pct - a.occ.pct)
    .slice(0, 4);

  // ── Filtering from searchParams ──
  const listingFilter = searchParams?.listing ?? "all";
  const statusFilter = ((): "all" | "active" | "draft" => {
    const raw = searchParams?.status;
    return raw === "active" || raw === "draft" ? raw : "all";
  })();
  const q = (searchParams?.q ?? "").trim().toLowerCase();

  const visibleGroups = groups
    .filter((g) => listingFilter === "all" || g.listing.id === listingFilter)
    .map((g) => ({
      ...g,
      rooms: g.rooms.filter((r) => {
        if (statusFilter === "active" && !r.is_active) return false;
        if (statusFilter === "draft" && r.is_active) return false;
        if (q) {
          const hay =
            `${r.name} ${describeBeds(r.beds)} ${describeRoomFeatures(r)}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    }));

  const addRoomHref =
    listingsCount === 1
      ? `/dashboard/listings/${groups[0].listing.id}/edit?tab=rooms&add=1`
      : "/dashboard/listings";

  if (groups.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader addRoomHref="/dashboard/listings/new" />
        <EmptyStateNoListings />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader addRoomHref={addRoomHref} />

      {/* ── Stat band ── */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-brand-line bg-brand-line sm:grid-cols-4">
        <StatCell
          label="Live rooms"
          value={
            <>
              {activeRooms}
              <span className="text-[13px] font-semibold text-brand-mute">
                {" "}
                / {totalRooms}
              </span>
            </>
          }
          foot={`across ${listingsCount} listing${listingsCount === 1 ? "" : "s"}`}
        />
        <StatCell
          label="Avg occupancy"
          value={`${avgOccupancy}%`}
          foot={`next ${OCC_DAYS} days`}
        />
        <StatCell
          label="Avg rate · night"
          value={avgRate > 0 ? fmtRand(avgRate) : "—"}
          foot={
            minRate > 0
              ? `${fmtRand(minRate)} – ${fmtRand(maxRate)} range`
              : "no rates set"
          }
        />
        <StatCell
          label="Open tonight"
          value={String(openTonight)}
          foot={
            unpriced > 0 ? (
              <span className="inline-flex items-center gap-1 font-medium text-status-pending">
                <AlertTriangle className="h-3 w-3" /> {unpriced} unpriced
              </span>
            ) : (
              "all priced"
            )
          }
        />
      </section>

      {/* ── Filter bar ── */}
      <FilterBar
        groups={groups}
        listingFilter={listingFilter}
        statusFilter={statusFilter}
        q={q}
        counts={{ all: totalRooms, active: activeRooms, draft: draftRooms }}
      />

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: listing groups */}
        <div className="min-w-0 space-y-5">
          {visibleGroups.map((g) => (
            <ListingGroupCard key={g.listing.id} group={g} occ={occByRoom} />
          ))}
          {visibleGroups.every((g) => g.rooms.length === 0) ? (
            <NoMatchingRooms />
          ) : null}
        </div>

        {/* Right rail */}
        <div className="space-y-5">
          {attention.length > 0 ? (
            <RailCard title="Needs attention" badge={attention.length}>
              <div className="divide-y divide-brand-line">
                {attention.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-status-pending/[0.12] text-status-pending">
                      {a.icon === "photo" ? (
                        <ImageOff className="h-4 w-4" />
                      ) : (
                        <Tag className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold text-brand-ink">
                        {a.title}
                      </div>
                      <div className="mt-0.5 text-[11px] leading-snug text-brand-mute">
                        {a.sub}
                      </div>
                    </div>
                    <Link
                      href={a.href}
                      className="shrink-0 text-[11px] font-semibold text-brand-primary hover:underline"
                    >
                      {a.cta}
                    </Link>
                  </div>
                ))}
              </div>
            </RailCard>
          ) : null}

          {topPerformers.length > 0 ? (
            <RailCard
              title="Top performers"
              subtitle={`By occupancy · next ${OCC_DAYS} days`}
            >
              <div className="divide-y divide-brand-line">
                {topPerformers.map((t, i) => {
                  const rate = roomRate(t.room);
                  return (
                    <Link
                      key={t.room.id}
                      href={`/dashboard/listings/${t.listing.id}/edit/rooms/${t.room.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-brand-light/50"
                    >
                      <span className="num w-4 text-center font-display text-[16px] font-bold text-brand-mute">
                        {i + 1}
                      </span>
                      <div className="h-9 w-12 shrink-0 overflow-hidden rounded-[8px] border border-brand-line bg-brand-light">
                        {t.room.featuredPhotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.room.featuredPhotoUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-brand-mute">
                            <ImageIcon className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-semibold text-brand-ink">
                          {t.room.name}
                        </div>
                        <div className="truncate text-[10.5px] text-brand-mute">
                          {t.listing.name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="num text-[13px] font-bold text-brand-primary">
                          {t.occ.pct}%
                        </div>
                        {rate ? (
                          <div className="num text-[10px] text-brand-mute">
                            {rate.amount}
                          </div>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </RailCard>
          ) : null}

          <RailCard title="Calendar legend">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 text-[12px] text-brand-ink">
              <LegendSwatch cell="b" label="Booked" />
              <LegendSwatch cell="h" label="Held" />
              <LegendSwatch cell="o" label="Open" />
              <LegendSwatch cell="x" label="Blocked" />
            </div>
          </RailCard>
        </div>
      </div>
    </div>
  );
}

type AttnItem = {
  icon: "photo" | "rate";
  title: string;
  sub: string;
  cta: string;
  href: string;
};

// "Booked beats held beats blocked beats open" when two rows land on one day.
function rank(c: Cell | undefined): number {
  return c === "b" ? 3 : c === "h" ? 2 : c === "x" ? 1 : 0;
}

// ─────────────────────────────────────────────────────────────
// PAGE HEADER (breadcrumb + title + actions)
// ─────────────────────────────────────────────────────────────
function PageHeader({ addRoomHref }: { addRoomHref: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-brand-line pb-4">
      <div className="shrink-0">
        <nav className="flex items-center gap-1.5 text-[11.5px] text-brand-mute">
          <Link href="/dashboard/listings" className="hover:text-brand-ink">
            Listings
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-brand-ink">Rooms</span>
        </nav>
        <h1 className="mt-1 font-display text-[22px] font-extrabold leading-none tracking-tight text-brand-ink">
          Rooms
        </h1>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/dashboard/calendar-sync"
          className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
        >
          <RefreshCw className="h-4 w-4 text-brand-mute" />
          Calendar sync
        </Link>
        <Link
          href={addRoomHref}
          className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white shadow-glow transition hover:bg-brand-secondary"
        >
          <Plus className="h-4 w-4" />
          Add room
        </Link>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  foot,
}: {
  label: string;
  value: React.ReactNode;
  foot: React.ReactNode;
}) {
  return (
    <div className="bg-[#FAFCFB] p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        {label}
      </div>
      <div className="num mt-1.5 font-display text-[22px] font-bold leading-none text-brand-ink">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-brand-mute">{foot}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FILTER BAR (listing chips + status + search)
// ─────────────────────────────────────────────────────────────
function FilterBar({
  groups,
  listingFilter,
  statusFilter,
  q,
  counts,
}: {
  groups: Group[];
  listingFilter: string;
  statusFilter: "all" | "active" | "draft";
  q: string;
  counts: { all: number; active: number; draft: number };
}) {
  const baseQuery = (next: {
    listing?: string;
    status?: string;
    q?: string;
  }): string => {
    const merged: Record<string, string> = {};
    const listing = next.listing ?? listingFilter;
    const status = next.status ?? statusFilter;
    const query = next.q ?? q;
    if (listing && listing !== "all") merged.listing = listing;
    if (status && status !== "all") merged.status = status;
    if (query) merged.q = query;
    const s = new URLSearchParams(merged).toString();
    return s ? `/dashboard/rooms?${s}` : "/dashboard/rooms";
  };

  return (
    <section className="flex flex-wrap items-center gap-2.5">
      <div
        className="-mx-1 flex items-center gap-1 overflow-x-auto px-1"
        style={{ scrollbarWidth: "none" }}
      >
        <Chip
          href={baseQuery({ listing: "all" })}
          on={listingFilter === "all"}
          label="All listings"
          count={counts.all}
        />
        {groups.map((g) => (
          <Chip
            key={g.listing.id}
            href={baseQuery({ listing: g.listing.id })}
            on={listingFilter === g.listing.id}
            label={g.listing.name}
            count={g.rooms.length}
          />
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* status chips */}
        <div className="hidden items-center gap-1 sm:flex">
          <StatusChip
            href={baseQuery({ status: "active" })}
            on={statusFilter === "active"}
            dot="bg-status-confirmed"
            label="Live"
            count={counts.active}
          />
          <StatusChip
            href={baseQuery({ status: "draft" })}
            on={statusFilter === "draft"}
            dot="bg-status-draft"
            label="Draft"
            count={counts.draft}
          />
          {statusFilter !== "all" || listingFilter !== "all" || q ? (
            <Link
              href="/dashboard/rooms"
              className="px-2 text-[12px] font-medium text-brand-primary hover:underline"
            >
              Reset
            </Link>
          ) : null}
        </div>

        <form
          action="/dashboard/rooms"
          method="GET"
          className="relative hidden sm:block"
        >
          {listingFilter !== "all" ? (
            <input type="hidden" name="listing" value={listingFilter} />
          ) : null}
          {statusFilter !== "all" ? (
            <input type="hidden" name="status" value={statusFilter} />
          ) : null}
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search rooms…"
            className="h-9 w-48 rounded-pill border border-brand-line bg-white pl-9 pr-3 text-[12.5px] text-brand-ink outline-none transition focus:border-brand-primary focus:shadow-[0_0_0_4px_rgba(16,185,129,0.12)]"
          />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
        </form>
      </div>
    </section>
  );
}

function Chip({
  href,
  on,
  label,
  count,
}: {
  href: string;
  on: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-pill px-3 text-[12.5px] font-semibold transition ${
        on
          ? "bg-brand-accent text-brand-secondary"
          : "text-brand-mute hover:bg-brand-light hover:text-brand-ink"
      }`}
    >
      <span className="max-w-[140px] truncate">{label}</span>
      <span
        className={`num rounded-pill px-[7px] py-px text-[11px] font-bold ${
          on ? "bg-white/70 text-brand-secondary" : "bg-white text-brand-mute"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}

function StatusChip({
  href,
  on,
  dot,
  label,
  count,
}: {
  href: string;
  on: boolean;
  dot: string;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 text-[11.5px] font-medium transition ${
        on
          ? "border border-brand-line bg-brand-light/60 text-brand-ink"
          : "text-brand-mute hover:bg-brand-light hover:text-brand-ink"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label} <span className="num text-brand-mute">{count}</span>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// LISTING GROUP CARD
// ─────────────────────────────────────────────────────────────
function ListingGroupCard({
  group,
  occ,
}: {
  group: Group;
  occ: Map<string, Occ>;
}) {
  const { listing, rooms } = group;
  const totalSleeps = rooms.reduce((a, r) => a + r.max_guests, 0);
  const activeForAvg = rooms.filter(
    (r) => r.is_active && effectiveNightly(r) > 0,
  );
  const avgPrice =
    activeForAvg.length === 0
      ? 0
      : Math.round(
          activeForAvg.reduce((a, r) => a + effectiveNightly(r), 0) /
            activeForAvg.length,
        );
  const activeRooms = rooms.filter((r) => r.is_active);
  const bookedNights = activeRooms.reduce(
    (a, r) => a + (occ.get(r.id)?.booked ?? 0),
    0,
  );
  const listingOcc =
    activeRooms.length === 0
      ? 0
      : Math.round((bookedNights / (activeRooms.length * OCC_DAYS)) * 100);
  const locationLine = [listing.city, listing.province]
    .filter(Boolean)
    .join(", ");
  const editListingHref = `/dashboard/listings/${listing.id}/edit`;
  const addRoomHref = `/dashboard/listings/${listing.id}/edit?tab=rooms&add=1`;

  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-brand-line px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-[11px] border border-brand-line bg-brand-light">
            {listing.cover_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={listing.cover_photo_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-brand-mute">
                <ImageIcon className="h-4 w-4" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-display text-[15.5px] font-bold text-brand-ink">
                {listing.name}
              </h3>
              <span
                className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ${BOOKING_MODE_PILL[listing.booking_mode]}`}
              >
                {BOOKING_MODE_LABEL[listing.booking_mode]}
              </span>
              {!listing.is_published ? (
                <span className="rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand-mute">
                  Draft listing
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-brand-mute">
              {locationLine ? <span>{locationLine}</span> : null}
              {locationLine ? <span className="text-brand-line">·</span> : null}
              <span>
                {rooms.length} room{rooms.length === 1 ? "" : "s"}
              </span>
              {totalSleeps > 0 ? (
                <>
                  <span className="text-brand-line">·</span>
                  <span>sleeps up to {totalSleeps}</span>
                </>
              ) : null}
              {avgPrice > 0 ? (
                <>
                  <span className="text-brand-line">·</span>
                  <span className="num font-mono">
                    {fmtRand(avgPrice)} avg / night
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={addRoomHref}
            className="inline-flex items-center gap-1 rounded-pill border border-brand-line px-3 py-1.5 text-[11.5px] font-medium text-brand-ink hover:bg-brand-light"
          >
            <Plus className="h-3.5 w-3.5" />
            Add room
          </Link>
          <Link
            href={editListingHref}
            className="flex h-8 w-8 items-center justify-center rounded-pill text-brand-mute hover:bg-brand-light hover:text-brand-ink"
            title="Listing settings"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {rooms.length === 0 ? (
        <EmptyStateNoRooms listingId={listing.id} />
      ) : (
        <>
          {/* Column headers */}
          <div className="hidden items-center gap-3.5 border-b border-brand-line bg-[#FAFCFB] px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-brand-mute md:grid md:grid-cols-[1.7fr_0.62fr_0.62fr_1.45fr_34px]">
            <div>Room</div>
            <div>Capacity</div>
            <div className="text-right">Rate / night</div>
            <div>{OCC_DAYS}-day occupancy</div>
            <div />
          </div>

          <div className="divide-y divide-brand-line">
            {rooms.map((r) => (
              <RoomRow
                key={r.id}
                listingId={listing.id}
                room={r}
                occ={occ.get(r.id)}
              />
            ))}
          </div>

          {/* Footer summary */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-brand-line bg-[#FAFCFB] px-5 py-2.5 text-[11.5px] text-brand-mute">
            <span className="num">
              Occupancy{" "}
              <span className="font-semibold text-brand-ink">
                {listingOcc}%
              </span>
            </span>
            <span className="text-brand-line">·</span>
            <span className="num">
              {bookedNights} night{bookedNights === 1 ? "" : "s"} booked ·{" "}
              {OCC_DAYS}d
            </span>
            <span className="text-brand-line">·</span>
            <span className="num">
              {rooms.reduce((a, r) => a + (r.photos?.length ?? 0), 0)} photos
            </span>
            <Link
              href={editListingHref}
              className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-secondary hover:underline"
            >
              Open listing
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOM ROW
// ─────────────────────────────────────────────────────────────
function RoomRow({
  listingId,
  room,
  occ,
}: {
  listingId: string;
  room: EditorRoom;
  occ: Occ | undefined;
}) {
  const editHref = `/dashboard/listings/${listingId}/edit/rooms/${room.id}`;
  const photoCount = room.photos?.length ?? 0;
  const subTitle =
    [describeBeds(room.beds), describeRoomFeatures(room)]
      .filter(Boolean)
      .join(" · ") || "Add room details";
  const rate = roomRate(room);
  const muted = !room.is_active;

  return (
    <div className="grid grid-cols-1 gap-y-2.5 px-5 py-3 transition hover:bg-[#FAFCFB] md:grid-cols-[1.7fr_0.62fr_0.62fr_1.45fr_34px] md:items-center md:gap-3.5">
      {/* Room */}
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`h-12 w-16 shrink-0 overflow-hidden rounded-[9px] border border-brand-line bg-brand-light ${muted ? "opacity-70" : ""}`}
        >
          {room.featuredPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={room.featuredPhotoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-brand-mute">
              <ImageIcon className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${room.is_active ? "bg-status-confirmed" : "bg-status-draft"}`}
            />
            <span
              className={`truncate text-[13.5px] font-semibold ${muted ? "text-brand-mute" : "text-brand-ink"}`}
            >
              {room.name}
            </span>
            {muted ? (
              <Taglet tone="gray">Draft</Taglet>
            ) : photoCount === 0 ? (
              <Taglet tone="amber" icon={<ImageOff className="h-3 w-3" />}>
                Missing photos
              </Taglet>
            ) : room.has_ensuite_bathroom && room.private_entrance ? (
              <Taglet tone="green" icon={<Award className="h-3 w-3" />}>
                Private suite
              </Taglet>
            ) : null}
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-brand-mute">
            {subTitle}
          </div>
        </div>
      </div>

      {/* Capacity */}
      <div
        className={`text-[12.5px] ${muted ? "text-brand-mute" : "text-brand-ink"}`}
      >
        <div className="num font-semibold">Sleeps {room.max_guests || "—"}</div>
        <div className="text-[10.5px] text-brand-mute">
          {room.inventory_count > 1
            ? `${room.inventory_count} units`
            : room.beds && room.beds.length > 0
              ? `${room.beds.length} bed${room.beds.length === 1 ? "" : "s"}`
              : "Single room"}
        </div>
      </div>

      {/* Rate */}
      <div className="md:text-right">
        {rate ? (
          <>
            <div
              className={`num font-display text-[14px] font-bold ${muted ? "text-brand-mute" : "text-brand-ink"}`}
            >
              {rate.amount}
            </div>
            <div className="num text-[10.5px] text-brand-mute">{rate.sub}</div>
          </>
        ) : (
          <>
            <div className="num font-display text-[14px] font-semibold text-brand-mute">
              —
            </div>
            <div className="text-[10.5px] text-brand-mute">No rate</div>
          </>
        )}
      </div>

      {/* 14-day occupancy */}
      <div>
        {occ ? (
          <OccStrip occ={occ} muted={muted} />
        ) : (
          <div className="text-[10.5px] text-brand-mute">—</div>
        )}
      </div>

      {/* Edit */}
      <div className="flex justify-end">
        <Link
          href={editHref}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] text-brand-mute transition hover:bg-brand-accent hover:text-brand-secondary"
          title="Edit room"
        >
          <Pencil className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

const CELL_CLASS: Record<Cell, string> = {
  b: "bg-brand-primary text-white",
  h: "bg-status-pending/[0.18] text-[#92590e]",
  x: "bg-brand-line text-brand-mute line-through",
  o: "bg-brand-light text-brand-mute",
};

function OccStrip({ occ, muted }: { occ: Occ; muted?: boolean }) {
  return (
    <div className={muted ? "opacity-70" : ""}>
      <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-0.5">
        {occ.cells.map((c, i) => (
          <div
            key={i}
            className={`flex h-[22px] items-center justify-center rounded-[4px] font-mono text-[10px] ${CELL_CLASS[c]} ${
              i === 0 ? "ring-[1.5px] ring-inset ring-brand-secondary" : ""
            }`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-brand-mute">
        <span className="num">
          {occ.booked} / {OCC_DAYS} nights booked
        </span>
        <span
          className={`num font-semibold ${occ.pct >= 50 ? "text-brand-primary" : "text-status-pending"}`}
        >
          {occ.pct}%
        </span>
      </div>
    </div>
  );
}

function Taglet({
  children,
  tone,
  icon,
}: {
  children: React.ReactNode;
  tone: "green" | "amber" | "gray";
  icon?: React.ReactNode;
}) {
  const cls =
    tone === "green"
      ? "border-[#C7F0DC] bg-[#ECFDF5] text-[#047857]"
      : tone === "amber"
        ? "border-[#FCE9B6] bg-[#FFFBEB] text-[#B45309]"
        : "border-brand-line bg-[#F4F7F5] text-[#5B7065]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill border px-2 py-[2px] text-[10.5px] font-semibold ${cls}`}
    >
      {icon}
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// RIGHT RAIL
// ─────────────────────────────────────────────────────────────
function RailCard({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-0.5 text-[12px] text-brand-mute">{subtitle}</div>
          ) : null}
        </div>
        {badge != null ? (
          <span className="num inline-flex items-center rounded-pill bg-status-pending/15 px-2 py-0.5 text-[10.5px] font-semibold text-status-pending">
            {badge}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function LegendSwatch({ cell, label }: { cell: Cell; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`h-[22px] w-6 rounded-[4px] ${CELL_CLASS[cell]} ${cell === "o" ? "border border-brand-line" : ""}`}
      />
      {label}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EMPTY STATES
// ─────────────────────────────────────────────────────────────
function EmptyStateNoListings() {
  return (
    <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
        <BedDouble className="h-6 w-6" />
      </div>
      <h2 className="font-display text-lg font-bold text-brand-ink">
        Add a listing first
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
        Rooms live inside a listing — create one to start managing rooms.
      </p>
      <Link
        href="/dashboard/listings/new"
        className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
      >
        <Plus className="h-4 w-4" />
        New listing
      </Link>
    </div>
  );
}

function EmptyStateNoRooms({ listingId }: { listingId: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-card bg-brand-light text-brand-mute">
        <BedDouble className="h-5 w-5" />
      </div>
      <div className="text-[13px] font-semibold text-brand-ink">
        No rooms in this listing yet
      </div>
      <p className="max-w-sm text-[11.5px] text-brand-mute">
        Add a room to let guests book a single bedroom inside this property.
      </p>
      <Link
        href={`/dashboard/listings/${listingId}/edit?tab=rooms&add=1`}
        className="mt-1 inline-flex items-center gap-1 rounded-[9px] bg-brand-primary px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-secondary"
      >
        <Plus className="h-3 w-3" />
        Add first room
      </Link>
    </div>
  );
}

function NoMatchingRooms() {
  return (
    <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-card bg-brand-light text-brand-mute">
        <Search className="h-5 w-5" />
      </div>
      <div className="font-display text-base font-bold text-brand-ink">
        No rooms match these filters
      </div>
      <p className="mx-auto mt-1 max-w-md text-[12.5px] text-brand-mute">
        Try clearing the search or switching back to all listings.
      </p>
      <Link
        href="/dashboard/rooms"
        className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-primary hover:underline"
      >
        Reset filters
      </Link>
    </div>
  );
}
