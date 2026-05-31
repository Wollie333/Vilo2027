import type { Metadata } from "next";
import {
  BarChart3,
  BedDouble,
  Calendar,
  ExternalLink,
  Image as ImageIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Ruler,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";

import type { EditorRoom } from "../listings/[id]/edit/Editor";
import { type BedKind, bedKindLabel } from "../listings/[id]/edit/schemas";

export const metadata: Metadata = {
  title: "Rooms · Vilo",
};

export const dynamic = "force-dynamic";

type BookingMode = "whole_listing" | "rooms_only" | "flexible";

const BOOKING_MODE_LABEL: Record<BookingMode, string> = {
  whole_listing: "Whole listing",
  rooms_only: "Rooms only",
  flexible: "Flexible booking",
};

const BOOKING_MODE_PILL: Record<BookingMode, string> = {
  whole_listing: "bg-brand-light text-brand-mute",
  rooms_only: "bg-brand-light text-brand-mute",
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

export default async function RoomsPage({
  searchParams,
}: {
  searchParams?: { listing?: string; status?: string; q?: string };
}) {
  const supabase = createServerClient();

  // Scope to the logged-in host. `listings` has a `public_read_published`
  // RLS policy (so guests can browse the directory), which means relying on
  // RLS alone here would also return every OTHER host's published listing.
  // The explicit `host_id` filter is what keeps the portfolio private — never
  // remove it. Resolve the host by `user_id`, not RLS.
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

  // featured-photo join uses listing_rooms_featured_photo_id_fkey
  // (migration 20260524000004). Listings cover comes from the first
  // listing-level photo (sort_order = 0).
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

  // Flatten + filter rooms locally — Supabase doesn't filter nested rows.
  const groups: Group[] = (listings ?? []).map((l) => {
    const rawRooms =
      (l.rooms as Array<{
        id: string;
        name: string;
        description: string | null;
        bedrooms: number | null;
        bathrooms: number | null;
        max_guests: number;
        min_guests: number | null;
        min_nights: number | null;
        base_price: number | string;
        weekend_price: number | string | null;
        cleaning_fee: number | string | null;
        sort_order: number;
        is_active: boolean;
        deleted_at: string | null;
        room_size_sqm: number | string | null;
        bed_type: string | null;
        view_type: string | null;
        experiences: string[] | null;
        has_ensuite_bathroom: boolean | null;
        smoking_allowed: boolean | null;
        pets_allowed: boolean | null;
        wheelchair_accessible: boolean | null;
        private_entrance: boolean | null;
        floor_number: number | null;
        inventory_count: number | null;
        pricing_mode: string | null;
        price_per_person: number | string | null;
        base_occupancy: number | null;
        extra_guest_price: number | string | null;
        featured_photo_id: string | null;
        featured_photo: { url: string } | Array<{ url: string }> | null;
        beds: Array<{
          bed_kind: string;
          quantity: number;
          sleeps: number;
          sort_order: number;
        }> | null;
        photos: Array<{
          id: string;
          url: string;
          sort_order: number;
        }> | null;
        amenities: Array<{ amenity_key: string }> | null;
      }> | null) ?? [];

    const rooms: EditorRoom[] = rawRooms
      .filter((r) => r.deleted_at === null)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => {
        const fp = Array.isArray(r.featured_photo)
          ? r.featured_photo[0]
          : r.featured_photo;
        const beds = (r.beds ?? [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((b) => ({
            bed_kind: b.bed_kind,
            quantity: b.quantity,
            sleeps: b.sleeps,
          }));
        const photos = (r.photos ?? [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((p) => ({ id: p.id, url: p.url }));
        const amenityKeys = (r.amenities ?? []).map((a) => a.amenity_key);
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          bedrooms: r.bedrooms,
          bathrooms: r.bathrooms,
          max_guests: r.max_guests,
          min_guests: r.min_guests ?? 1,
          min_nights: r.min_nights ?? 1,
          base_price: Number(r.base_price),
          weekend_price:
            r.weekend_price == null ? null : Number(r.weekend_price),
          cleaning_fee: Number(r.cleaning_fee ?? 0),
          sort_order: r.sort_order,
          is_active: r.is_active,
          room_size_sqm:
            r.room_size_sqm == null ? null : Number(r.room_size_sqm),
          bed_type: r.bed_type ?? null,
          view_type: r.view_type ?? null,
          experiences: r.experiences ?? [],
          has_ensuite_bathroom: r.has_ensuite_bathroom ?? false,
          smoking_allowed: r.smoking_allowed ?? false,
          pets_allowed: r.pets_allowed ?? false,
          wheelchair_accessible: r.wheelchair_accessible ?? false,
          private_entrance: r.private_entrance ?? false,
          floor_number: r.floor_number ?? null,
          inventory_count: r.inventory_count ?? 1,
          pricing_mode: (r.pricing_mode ??
            "per_room") as EditorRoom["pricing_mode"],
          price_per_person:
            r.price_per_person == null ? null : Number(r.price_per_person),
          base_occupancy: r.base_occupancy ?? null,
          extra_guest_price:
            r.extra_guest_price == null ? null : Number(r.extra_guest_price),
          featured_photo_id: r.featured_photo_id ?? null,
          beds,
          featuredPhotoUrl: fp?.url ?? null,
          featuredPhotoId: r.featured_photo_id ?? null,
          photos,
          amenityKeys,
        };
      });

    // Pick a cover for the listing card: first listing-level (room_id = null) photo.
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

  // ── Hero aggregates ──
  const totalRooms = groups.reduce((acc, g) => acc + g.rooms.length, 0);
  const activeRooms = groups.reduce(
    (acc, g) => acc + g.rooms.filter((r) => r.is_active).length,
    0,
  );
  const draftRooms = totalRooms - activeRooms;
  const listingsCount = groups.length;
  const totalPhotos = groups.reduce(
    (acc, g) => acc + g.rooms.reduce((a, r) => a + (r.photos?.length ?? 0), 0),
    0,
  );
  const roomsMissingPhotos = groups.reduce(
    (acc, g) =>
      acc + g.rooms.filter((r) => (r.photos?.length ?? 0) === 0).length,
    0,
  );

  // Average base price across active rooms (only currency = ZAR rooms here;
  // assume ZAR until a multi-currency host exists).
  const activeRoomList = groups.flatMap((g) =>
    g.rooms.filter((r) => r.is_active),
  );
  const avgRate =
    activeRoomList.length === 0
      ? 0
      : Math.round(
          activeRoomList.reduce((a, r) => a + r.base_price, 0) /
            activeRoomList.length,
        );

  // Build hero montage from featured room photos (up to 9, dedup by URL).
  const heroPhotos: Array<{
    url: string;
    roomName: string;
    listingName: string;
  }> = [];
  const seen = new Set<string>();
  for (const g of groups) {
    for (const r of g.rooms) {
      const url = r.featuredPhotoUrl ?? r.photos?.[0]?.url ?? null;
      if (url && !seen.has(url)) {
        seen.add(url);
        heroPhotos.push({
          url,
          roomName: r.name,
          listingName: g.listing.name,
        });
        if (heroPhotos.length >= 9) break;
      }
    }
    if (heroPhotos.length >= 9) break;
  }

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

  return (
    <div className="space-y-6 lg:space-y-7">
      <PortfolioHero
        totalRooms={totalRooms}
        activeRooms={activeRooms}
        draftRooms={draftRooms}
        listingsCount={listingsCount}
        avgRate={avgRate}
        totalPhotos={totalPhotos}
        photos={heroPhotos}
        addRoomHref={
          listingsCount === 1
            ? `/dashboard/listings/${groups[0].listing.id}/edit?tab=rooms&add=1`
            : "/dashboard/listings"
        }
      />

      {groups.length === 0 ? (
        <EmptyStateNoListings />
      ) : (
        <>
          <FilterBar
            groups={groups}
            listingFilter={listingFilter}
            statusFilter={statusFilter}
            q={q}
            counts={{
              all: totalRooms,
              active: activeRooms,
              draft: draftRooms,
              missingPhotos: roomsMissingPhotos,
            }}
          />

          <div className="space-y-6">
            {visibleGroups.map((g) => (
              <ListingGroupCard key={g.listing.id} group={g} />
            ))}
            {visibleGroups.every((g) => g.rooms.length === 0) ? (
              <NoMatchingRooms />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PORTFOLIO HERO
// ─────────────────────────────────────────────────────────────
function PortfolioHero({
  totalRooms,
  activeRooms,
  draftRooms,
  listingsCount,
  avgRate,
  totalPhotos,
  photos,
  addRoomHref,
}: {
  totalRooms: number;
  activeRooms: number;
  draftRooms: number;
  listingsCount: number;
  avgRate: number;
  totalPhotos: number;
  photos: Array<{ url: string; roomName: string; listingName: string }>;
  /** Where the hero "Add room" button goes — the rooms editor, not the portfolio. */
  addRoomHref: string;
}) {
  const hasRooms = totalRooms > 0;

  return (
    <section className="relative overflow-hidden rounded-card border border-brand-line shadow-card">
      <div className="grid gap-0 md:grid-cols-[1.45fr_1fr]">
        {/* Left */}
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
                <BedDouble className="h-3 w-3" />
                Room manager
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary/15 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-primary backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
                {totalRooms} room{totalRooms === 1 ? "" : "s"} · {listingsCount}{" "}
                listing{listingsCount === 1 ? "" : "s"}
              </div>
            </div>

            <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight md:text-[34px]">
              {hasRooms ? "All rooms, one place." : "Add your first room."}
            </h2>

            <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-brand-accent/80">
              {hasRooms
                ? "Set rates, capacity and amenities across every room you let by the night. Edit per-room photos and details from the row editor."
                : "Rooms let guests book a single bedroom inside a multi-room property. Add your first one to start filling beds."}
            </p>

            {/* Stats ribbon */}
            <div className="mt-6 grid max-w-md grid-cols-4 gap-3">
              <div>
                <div className="text-[9.5px] font-semibold uppercase tracking-wider text-brand-accent/60">
                  Live rooms
                </div>
                <div className="num mt-1 font-display text-xl font-bold text-white">
                  {activeRooms}
                </div>
                <div className="text-[10px] text-brand-accent/60">
                  / {totalRooms} total
                </div>
              </div>
              <div>
                <div className="text-[9.5px] font-semibold uppercase tracking-wider text-brand-accent/60">
                  Drafts
                </div>
                <div className="num mt-1 font-display text-xl font-bold text-white">
                  {draftRooms}
                </div>
                <div className="text-[10px] text-brand-accent/60">
                  {draftRooms === 0 ? "all live" : "to finish"}
                </div>
              </div>
              <div>
                <div className="text-[9.5px] font-semibold uppercase tracking-wider text-brand-accent/60">
                  Avg rate
                </div>
                <div className="num mt-1 font-display text-xl font-bold text-white">
                  {avgRate > 0
                    ? `R ${avgRate.toLocaleString("en-ZA").replace(/,/g, " ")}`
                    : "—"}
                </div>
                <div className="text-[10px] text-brand-accent/60">/ night</div>
              </div>
              <div>
                <div className="text-[9.5px] font-semibold uppercase tracking-wider text-brand-accent/60">
                  Photos
                </div>
                <div className="num mt-1 font-display text-xl font-bold text-white">
                  {totalPhotos}
                </div>
                <div className="text-[10px] text-brand-accent/60">
                  across all rooms
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Link
                href={addRoomHref}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-white px-4 py-2.5 text-sm font-semibold text-brand-secondary shadow-[0_12px_32px_-10px_rgba(16,185,129,0.35)] hover:bg-brand-accent"
              >
                <Plus className="h-4 w-4" />
                Add room
              </Link>
              <Link
                href="/dashboard/listings"
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/20 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Manage listings
              </Link>
              <Link
                href="/dashboard/calendar-sync"
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/20 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
              >
                <Calendar className="h-4 w-4" />
                Calendar sync
              </Link>
            </div>
          </div>
        </div>

        {/* Right: room thumbnails montage */}
        <div className="relative bg-brand-dark">
          {photos.length > 0 ? (
            <div className="grid h-full min-h-[320px] grid-cols-3 grid-rows-4 gap-1 p-2">
              {/* Featured hero tile */}
              <div className="relative col-span-2 row-span-2 overflow-hidden rounded-[10px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photos[0].url}
                  alt={photos[0].roomName}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/80 via-transparent to-transparent" />
                <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill bg-white/95 px-2 py-0.5 text-[9.5px] font-semibold text-brand-secondary backdrop-blur">
                  <Sparkles className="h-2.5 w-2.5" />
                  Featured
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="truncate text-[11px] font-bold text-white drop-shadow">
                    {photos[0].roomName}
                  </div>
                  <div className="truncate text-[10px] text-white/85 drop-shadow">
                    {photos[0].listingName}
                  </div>
                </div>
              </div>
              {photos.slice(1, 8).map((p, i) => (
                <div
                  key={`${p.url}-${i}`}
                  className="overflow-hidden rounded-[10px]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.roomName}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
              {photos[8] ? (
                <div className="relative overflow-hidden rounded-[10px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photos[8].url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {totalPhotos > 9 ? (
                    <Link
                      href="/dashboard/listings"
                      className="absolute inset-0 flex items-center justify-center bg-brand-dark/70 text-[11px] font-semibold text-white hover:bg-brand-dark/85"
                    >
                      +{totalPhotos - 9} more
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
              <div
                aria-hidden
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage:
                    "radial-gradient(rgba(16,185,129,0.35) 1px, transparent 1px)",
                  backgroundSize: "18px 18px",
                }}
              />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-card bg-brand-primary/15 text-brand-primary">
                <ImageIcon className="h-6 w-6" />
              </div>
              <div className="relative">
                <div className="font-display text-sm font-bold text-white">
                  No room photos yet
                </div>
                <p className="mt-1 max-w-[220px] text-[11.5px] text-brand-accent/70">
                  Upload a featured photo to each room from the room editor.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// FILTER BAR
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
  counts: { all: number; active: number; draft: number; missingPhotos: number };
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
    const params = new URLSearchParams(merged);
    const s = params.toString();
    return s ? `/dashboard/rooms?${s}` : "/dashboard/rooms";
  };

  return (
    <section className="rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        {/* Listing chips */}
        <div className="hscroll flex items-center gap-0.5 overflow-x-auto">
          <Link
            href={baseQuery({ listing: "all" })}
            className={
              listingFilter === "all"
                ? "flex items-center gap-1.5 whitespace-nowrap rounded-md bg-brand-accent px-3 py-1.5 text-[12.5px] font-semibold text-brand-secondary"
                : "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12.5px] font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
            }
          >
            All listings
            <span
              className={
                listingFilter === "all"
                  ? "num rounded-pill bg-white/70 px-1.5 py-0.5 text-[9.5px] font-bold text-brand-secondary"
                  : "num rounded-pill bg-brand-line px-1.5 py-0.5 text-[9.5px] font-bold text-brand-mute"
              }
            >
              {counts.all}
            </span>
          </Link>
          {groups.map((g) => {
            const active = listingFilter === g.listing.id;
            return (
              <Link
                key={g.listing.id}
                href={baseQuery({ listing: g.listing.id })}
                className={
                  active
                    ? "flex items-center gap-1.5 whitespace-nowrap rounded-md bg-brand-accent px-3 py-1.5 text-[12.5px] font-semibold text-brand-secondary"
                    : "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12.5px] font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                }
              >
                <span className="max-w-[140px] truncate">{g.listing.name}</span>
                <span
                  className={
                    active
                      ? "num rounded-pill bg-white/70 px-1.5 py-0.5 text-[9.5px] font-bold text-brand-secondary"
                      : "num rounded-pill bg-brand-line px-1.5 py-0.5 text-[9.5px] font-bold text-brand-mute"
                  }
                >
                  {g.rooms.length}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mx-1 hidden h-5 w-px bg-brand-line lg:block" />

        {/* Status filters */}
        <div className="hidden items-center gap-0.5 lg:flex">
          <Link
            href={baseQuery({ status: "active" })}
            className={
              statusFilter === "active"
                ? "flex items-center gap-1.5 rounded-md border border-brand-line bg-brand-light/60 px-2.5 py-1.5 text-[11.5px] font-medium text-brand-ink"
                : "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed" />
            Live <span className="num text-brand-mute">{counts.active}</span>
          </Link>
          <Link
            href={baseQuery({ status: "draft" })}
            className={
              statusFilter === "draft"
                ? "flex items-center gap-1.5 rounded-md border border-brand-line bg-brand-light/60 px-2.5 py-1.5 text-[11.5px] font-medium text-brand-ink"
                : "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-status-draft" />
            Draft <span className="num">{counts.draft}</span>
          </Link>
          {counts.missingPhotos > 0 ? (
            <span className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-medium text-brand-mute">
              <span className="h-1.5 w-1.5 rounded-full bg-status-pending" />
              Missing photos <span className="num">{counts.missingPhotos}</span>
            </span>
          ) : null}
          {statusFilter !== "all" || listingFilter !== "all" || q ? (
            <Link
              href="/dashboard/rooms"
              className="ml-1 rounded-md px-2.5 py-1.5 text-[11.5px] font-medium text-brand-primary hover:underline"
            >
              Reset
            </Link>
          ) : null}
        </div>

        {/* Search */}
        <form
          action="/dashboard/rooms"
          method="GET"
          className="ml-auto flex items-center gap-2"
        >
          {listingFilter !== "all" ? (
            <input type="hidden" name="listing" value={listingFilter} />
          ) : null}
          {statusFilter !== "all" ? (
            <input type="hidden" name="status" value={statusFilter} />
          ) : null}
          <div className="relative">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search rooms…"
              className="w-44 rounded-[10px] border border-brand-line bg-white py-1.5 pl-8 pr-3 text-[12px] text-brand-ink transition-colors focus:border-brand-primary focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)] focus:outline-none"
            />
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-brand-mute" />
          </div>
        </form>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// LISTING GROUP CARD
// ─────────────────────────────────────────────────────────────
function ListingGroupCard({ group }: { group: Group }) {
  const { listing, rooms } = group;

  const totalSleeps = rooms.reduce((a, r) => a + r.max_guests, 0);
  const activeForAvg = rooms.filter((r) => r.is_active && r.base_price > 0);
  const avgPrice =
    activeForAvg.length === 0
      ? 0
      : Math.round(
          activeForAvg.reduce((a, r) => a + r.base_price, 0) /
            activeForAvg.length,
        );
  const locationLine = [listing.city, listing.province]
    .filter(Boolean)
    .join(", ");
  const editListingHref = `/dashboard/listings/${listing.id}/edit`;
  const addRoomHref = `/dashboard/listings/${listing.id}/edit?tab=rooms&add=1`;

  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-brand-line px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[10px] border border-brand-line bg-brand-light">
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
              <h3 className="truncate font-display text-[16px] font-bold text-brand-ink">
                {listing.name}
              </h3>
              <span
                className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ${BOOKING_MODE_PILL[listing.booking_mode]}`}
              >
                {BOOKING_MODE_LABEL[listing.booking_mode]}
              </span>
              {!listing.is_published ? (
                <span className="rounded-pill bg-brand-line px-2 py-0.5 text-[10px] font-semibold text-brand-mute">
                  Draft listing
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-brand-mute">
              {locationLine ? <span>{locationLine}</span> : null}
              {locationLine ? <span className="text-brand-line">·</span> : null}
              <span>
                {rooms.length} room{rooms.length === 1 ? "" : "s"}
              </span>
              {totalSleeps > 0 ? (
                <>
                  <span className="text-brand-line">·</span>
                  <span>Sleeps up to {totalSleeps}</span>
                </>
              ) : null}
              {avgPrice > 0 ? (
                <>
                  <span className="text-brand-line">·</span>
                  <span className="font-mono">
                    R {avgPrice.toLocaleString("en-ZA").replace(/,/g, " ")} avg
                    / night
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={addRoomHref}
            className="inline-flex items-center gap-1 rounded-[8px] border border-brand-line px-2.5 py-1.5 text-[11.5px] font-medium text-brand-ink hover:bg-brand-light/60"
          >
            <Plus className="h-3 w-3" />
            Add room
          </Link>
          {listing.is_published && listing.slug ? (
            <Link
              href={`/listing/${listing.slug}`}
              target="_blank"
              className="inline-flex h-7 items-center justify-center gap-1 rounded-[8px] px-2 text-[11.5px] text-brand-mute hover:bg-brand-light/60 hover:text-brand-ink"
              title="View public listing"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
          <Link
            href={editListingHref}
            className="flex h-7 w-7 items-center justify-center rounded-[8px] text-brand-mute hover:bg-brand-light/60 hover:text-brand-ink"
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
          {/* Column headers — hidden below md so the row collapses cleanly */}
          <div className="hidden grid-cols-[1.6fr_0.75fr_0.7fr_1fr_auto] gap-3 border-b border-brand-line bg-brand-light/40 px-6 py-2 text-[10px] font-semibold uppercase tracking-wider text-brand-mute md:grid">
            <div>Room</div>
            <div>Capacity</div>
            <div className="text-right">Rate / night</div>
            <div>Details</div>
            <div className="w-7" />
          </div>

          {/* Rooms */}
          <ul className="divide-y divide-brand-line">
            {rooms.map((r) => (
              <RoomRow key={r.id} listingId={listing.id} room={r} />
            ))}
          </ul>

          {/* Footer summary */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-brand-line bg-brand-light/40 px-6 py-2.5 text-[11.5px] text-brand-mute">
            <span className="inline-flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              <span>
                {rooms.filter((r) => r.is_active).length} of {rooms.length} live
              </span>
            </span>
            <span className="text-brand-line">·</span>
            <span>
              {rooms.reduce((a, r) => a + (r.photos?.length ?? 0), 0)} photos
            </span>
            <Link
              href={editListingHref}
              className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-secondary hover:underline"
            >
              Open listing
              <ExternalLink className="h-3 w-3" />
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
function RoomRow({ listingId, room }: { listingId: string; room: EditorRoom }) {
  const editHref = `/dashboard/listings/${listingId}/edit/rooms/${room.id}`;
  const photoCount = room.photos?.length ?? 0;
  const bedsText = describeBeds(room.beds);
  const featuresText = describeRoomFeatures(room);
  const subTitle = [bedsText, featuresText].filter(Boolean).join(" · ");
  const weekendBump =
    room.weekend_price && room.base_price > 0
      ? Math.round(
          ((room.weekend_price - room.base_price) / room.base_price) * 100,
        )
      : null;

  return (
    <li className="grid grid-cols-1 gap-y-2 px-6 py-3 hover:bg-brand-light/40 md:grid-cols-[1.6fr_0.75fr_0.7fr_1fr_auto] md:items-center md:gap-3">
      {/* Room */}
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`h-12 w-16 shrink-0 overflow-hidden rounded-[8px] border border-brand-line ${room.is_active ? "" : "opacity-70"}`}
        >
          {room.featuredPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={room.featuredPhotoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-white text-brand-mute">
              <ImageIcon className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${room.is_active ? "bg-status-confirmed" : "bg-status-draft"}`}
            />
            <span
              className={`truncate text-[13px] font-semibold ${room.is_active ? "text-brand-ink" : "text-brand-mute"}`}
            >
              {room.name}
            </span>
            {!room.is_active ? (
              <span className="inline-flex items-center rounded-pill bg-status-draft/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-status-draft">
                Draft
              </span>
            ) : null}
            {photoCount === 0 ? (
              <span className="inline-flex items-center gap-0.5 rounded-pill bg-status-pending/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-status-pending">
                <ImageIcon className="h-2.5 w-2.5" />
                No photos
              </span>
            ) : null}
            {room.has_ensuite_bathroom && room.private_entrance ? (
              <span className="inline-flex items-center rounded-pill bg-brand-accent px-1.5 py-0.5 text-[9.5px] font-semibold text-brand-secondary">
                Private suite
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-brand-mute">
            {subTitle || "Add room details"}
          </div>
        </div>
      </div>

      {/* Capacity */}
      <div className="text-[12.5px] text-brand-ink">
        <div className="num font-semibold">Sleeps {room.max_guests || "—"}</div>
        <div className="text-[10.5px] text-brand-mute">
          {room.inventory_count > 1
            ? `${room.inventory_count} identical units`
            : room.bedrooms != null && room.bedrooms > 0
              ? `${room.bedrooms} bedroom${room.bedrooms === 1 ? "" : "s"}`
              : "Single room"}
        </div>
      </div>

      {/* Rate / night */}
      <div className="md:text-right">
        {room.base_price > 0 ? (
          <>
            <div className="num font-display text-[14px] font-bold text-brand-ink">
              R{" "}
              {Math.round(room.base_price)
                .toLocaleString("en-ZA")
                .replace(/,/g, " ")}
            </div>
            <div className="num text-[10.5px] text-brand-mute">
              {weekendBump != null && weekendBump !== 0
                ? `Weekend ${weekendBump > 0 ? "+" : ""}${weekendBump}%`
                : room.cleaning_fee > 0
                  ? `+ R ${Math.round(room.cleaning_fee).toLocaleString("en-ZA").replace(/,/g, " ")} cleaning`
                  : "Flat rate"}
            </div>
          </>
        ) : (
          <>
            <div className="num font-display text-[14px] font-semibold text-brand-mute">
              Set rate
            </div>
            <div className="num text-[10.5px] text-brand-mute">—</div>
          </>
        )}
      </div>

      {/* Details — beds count, size, amenities */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-mute">
        <span className="inline-flex items-center gap-1">
          <BedDouble className="h-3 w-3" />
          {room.beds?.length ?? 0} bed
          {(room.beds?.length ?? 0) === 1 ? "" : "s"}
        </span>
        {room.room_size_sqm != null ? (
          <span className="inline-flex items-center gap-1">
            <Ruler className="h-3 w-3" />
            <span className="num">{room.room_size_sqm} m²</span>
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <ImageIcon className="h-3 w-3" />
          <span className="num">{photoCount}</span>
        </span>
        {(room.amenityKeys?.length ?? 0) > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            <span className="num">{room.amenityKeys?.length ?? 0}</span>
          </span>
        ) : null}
      </div>

      {/* Edit */}
      <div className="flex justify-end">
        <Link
          href={editHref}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-brand-mute hover:bg-brand-accent hover:text-brand-secondary"
          title="Edit room"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Link>
      </div>
    </li>
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
        className="mt-1 inline-flex items-center gap-1 rounded-[8px] bg-brand-primary px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-secondary"
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
