import type { Metadata } from "next";
import { BedDouble, Plus } from "lucide-react";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";

import type { EditorRoom } from "../listings/[id]/edit/Editor";
import { RoomsGroupCard } from "./RoomsGroupCard";

export const metadata: Metadata = {
  title: "Rooms · Vilo",
};

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const supabase = createServerClient();

  // RLS host_manage_own_listings — only the signed-in host's listings.
  const { data: listings } = await supabase
    .from("listings")
    .select(
      "id, name, slug, booking_mode, is_published, deleted_at, rooms:listing_rooms ( id, name, description, bedrooms, bathrooms, max_guests, base_price, weekend_price, cleaning_fee, sort_order, is_active, deleted_at )",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Flatten + filter rooms locally — Supabase doesn't filter nested rows.
  const groups = (listings ?? []).map((l) => {
    const rawRooms =
      (l.rooms as Array<{
        id: string;
        name: string;
        description: string | null;
        bedrooms: number | null;
        bathrooms: number | null;
        max_guests: number;
        base_price: number | string;
        weekend_price: number | string | null;
        cleaning_fee: number | string | null;
        sort_order: number;
        is_active: boolean;
        deleted_at: string | null;
      }> | null) ?? [];

    const rooms: EditorRoom[] = rawRooms
      .filter((r) => r.deleted_at === null)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        bedrooms: r.bedrooms,
        bathrooms: r.bathrooms,
        max_guests: r.max_guests,
        base_price: Number(r.base_price),
        weekend_price: r.weekend_price == null ? null : Number(r.weekend_price),
        cleaning_fee: Number(r.cleaning_fee ?? 0),
        sort_order: r.sort_order,
        is_active: r.is_active,
      }));

    return {
      listing: {
        id: l.id,
        name: l.name,
        slug: l.slug,
        booking_mode: l.booking_mode as
          | "whole_listing"
          | "rooms_only"
          | "flexible",
        is_published: l.is_published,
      },
      rooms,
    };
  });

  const totalRooms = groups.reduce((acc, g) => acc + g.rooms.length, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            Rooms
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Add, edit and manage rooms across every listing — all from here.
            Photos &amp; amenities live in the per-room editor (link in each
            expanded row).
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

      <div className="space-y-6">
        {groups.map((g) => (
          <RoomsGroupCard
            key={g.listing.id}
            listing={g.listing}
            initialRooms={g.rooms}
          />
        ))}
      </div>
    </div>
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
