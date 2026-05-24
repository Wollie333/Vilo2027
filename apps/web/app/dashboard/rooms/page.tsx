import type { Metadata } from "next";
import {
  ArrowRight,
  BedDouble,
  ExternalLink,
  Plus,
  Settings2,
} from "lucide-react";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Rooms · Vilo",
};

export const dynamic = "force-dynamic";

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

const BOOKING_MODE_LABEL: Record<string, string> = {
  whole_listing: "Whole place",
  rooms_only: "Per-room only",
  flexible: "Per-room or whole place",
};

export default async function RoomsPage() {
  const supabase = createServerClient();

  // RLS host_manage_own_listings — only the signed-in host's listings.
  const { data: listings } = await supabase
    .from("listings")
    .select(
      "id, name, slug, booking_mode, currency, is_published, deleted_at, rooms:listing_rooms ( id, name, description, bedrooms, bathrooms, max_guests, base_price, cleaning_fee, sort_order, is_active, deleted_at )",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Flatten + filter rooms locally — Supabase doesn't filter nested rows.
  const groups = (listings ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    slug: l.slug,
    booking_mode: l.booking_mode as "whole_listing" | "rooms_only" | "flexible",
    currency: l.currency,
    is_published: l.is_published,
    rooms: (
      (l.rooms as Array<{
        id: string;
        name: string;
        description: string | null;
        bedrooms: number | null;
        bathrooms: number | null;
        max_guests: number;
        base_price: number | string;
        cleaning_fee: number | string | null;
        sort_order: number;
        is_active: boolean;
        deleted_at: string | null;
      }> | null) ?? []
    )
      .filter((r) => r.deleted_at === null)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));

  const totalRooms = groups.reduce((acc, g) => acc + g.rooms.length, 0);
  const listingsWithRoomsMode = groups.filter(
    (g) => g.booking_mode !== "whole_listing",
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            Rooms
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Manage rooms across all your listings — pricing, capacity, photos,
            amenities.
          </p>
        </div>
        <div className="text-right text-xs text-brand-mute">
          <div className="font-mono">
            <span className="font-display text-lg font-bold text-brand-ink">
              {totalRooms}
            </span>{" "}
            room{totalRooms === 1 ? "" : "s"}
          </div>
          <div>
            across {groups.length} listing{groups.length === 1 ? "" : "s"}
          </div>
        </div>
      </header>

      {groups.length === 0 ? <EmptyStateNoListings /> : null}

      {groups.length > 0 && listingsWithRoomsMode.length === 0 ? (
        <EmptyStateAllWhole groups={groups} />
      ) : null}

      <div className="space-y-6">
        {groups.map((g) => (
          <ListingRoomsCard key={g.id} group={g} />
        ))}
      </div>
    </div>
  );
}

type Group = {
  id: string;
  name: string;
  slug: string | null;
  booking_mode: "whole_listing" | "rooms_only" | "flexible";
  currency: string;
  is_published: boolean;
  rooms: Array<{
    id: string;
    name: string;
    description: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    max_guests: number;
    base_price: number | string;
    cleaning_fee: number | string | null;
    sort_order: number;
    is_active: boolean;
  }>;
};

function ListingRoomsCard({ group }: { group: Group }) {
  const isWholeOnly = group.booking_mode === "whole_listing";
  const roomsHref = `/dashboard/listings/${group.id}/edit?tab=rooms`;

  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      {/* Listing header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-line bg-brand-light/40 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-display text-lg font-bold text-brand-ink">
              {group.name}
            </h2>
            <span
              className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ${
                group.is_published
                  ? "bg-green-100 text-green-800"
                  : "bg-brand-line text-brand-mute"
              }`}
            >
              {group.is_published ? "Published" : "Draft"}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-brand-mute">
            Mode:{" "}
            <span className="text-brand-ink">
              {BOOKING_MODE_LABEL[group.booking_mode]}
            </span>{" "}
            · {group.rooms.length} room
            {group.rooms.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {group.is_published && group.slug ? (
            <Link
              href={`/listing/${group.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-mute hover:text-brand-ink"
            >
              View public
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
          <Link
            href={roomsHref}
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-secondary"
          >
            <Plus className="h-3.5 w-3.5" />
            {group.rooms.length === 0 ? "Add first room" : "Add room"}
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {isWholeOnly ? (
          <div className="rounded border border-dashed border-brand-line bg-brand-light/40 px-4 py-5 text-sm text-brand-mute">
            This listing is set to{" "}
            <span className="font-medium text-brand-ink">whole-place</span>{" "}
            bookings — guests book the entire listing, not individual rooms.{" "}
            <Link
              href={`/dashboard/listings/${group.id}/edit?tab=rooms`}
              className="font-medium text-brand-primary hover:underline"
            >
              Switch to per-room
            </Link>{" "}
            to start adding rooms.
          </div>
        ) : group.rooms.length === 0 ? (
          <div className="rounded border border-dashed border-brand-line bg-brand-light/40 px-4 py-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
              <BedDouble className="h-5 w-5" />
            </div>
            <div className="font-medium text-brand-ink">
              No rooms on this listing yet
            </div>
            <p className="mx-auto mt-1 max-w-sm text-xs text-brand-mute">
              Add your first room to enable per-room booking — pricing and
              capacity are per-room from there.
            </p>
            <Link
              href={roomsHref}
              className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-secondary"
            >
              <Plus className="h-3.5 w-3.5" />
              Add first room
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-brand-line">
            {group.rooms.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
                    <BedDouble className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate font-medium text-brand-ink">
                        {r.name}
                      </div>
                      {!r.is_active ? (
                        <span className="rounded-pill bg-brand-line px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                          Hidden
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-xs text-brand-mute">
                      Sleeps {r.max_guests}
                      {r.bedrooms
                        ? ` · ${r.bedrooms} bedroom${r.bedrooms === 1 ? "" : "s"}`
                        : ""}
                      {r.bathrooms != null
                        ? ` · ${r.bathrooms} bath${r.bathrooms === 1 ? "" : "s"}`
                        : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="num font-display text-sm font-bold text-brand-ink">
                      {fmtR(Number(r.base_price), group.currency)}
                    </div>
                    <div className="text-[10px] text-brand-mute">/night</div>
                  </div>
                  <Link
                    href={`/dashboard/listings/${group.id}/edit/rooms/${r.id}`}
                    className="inline-flex items-center gap-1.5 rounded border border-brand-line px-3 py-1.5 text-xs font-medium text-brand-ink transition-colors hover:bg-brand-accent"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

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
        className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
      >
        <Plus className="h-4 w-4" />
        New listing
      </Link>
    </div>
  );
}

function EmptyStateAllWhole({ groups }: { groups: Group[] }) {
  return (
    <div className="rounded-card border border-dashed border-brand-line bg-white p-6 shadow-card">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <BedDouble className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold text-brand-ink">
            None of your listings use per-room bookings yet
          </h2>
          <p className="mt-1 text-sm text-brand-mute">
            Rooms only show up for listings set to{" "}
            <span className="text-brand-ink">Per-room</span> or{" "}
            <span className="text-brand-ink">Flexible</span> booking mode.
            Switch a listing to enable rooms.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {groups.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-3"
              >
                <span className="truncate text-brand-ink">{g.name}</span>
                <Link
                  href={`/dashboard/listings/${g.id}/edit?tab=rooms`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
                >
                  Switch to per-room
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
