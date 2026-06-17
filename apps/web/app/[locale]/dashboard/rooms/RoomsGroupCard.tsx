"use client";

import { ExternalLink } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useState } from "react";

import type { EditorRoom } from "../properties/[id]/edit/Editor";
import { RoomsManager } from "../properties/[id]/edit/tabs/RoomsManager";
import {
  ListingSettingsDialog,
  type BookingMode,
} from "./ListingSettingsDialog";

const BOOKING_MODE_LABEL: Record<BookingMode, string> = {
  whole_listing: "Whole place",
  rooms_only: "Per-room only",
  flexible: "Per-room or whole place",
};

export type RoomsGroupCardListing = {
  id: string;
  name: string;
  slug: string | null;
  booking_mode: BookingMode;
  is_published: boolean;
};

export function RoomsGroupCard({
  listing,
  initialRooms,
}: {
  listing: RoomsGroupCardListing;
  initialRooms: EditorRoom[];
}) {
  const [rooms, setRooms] = useState<EditorRoom[]>(initialRooms);
  const [bookingMode, setBookingMode] = useState<BookingMode>(
    listing.booking_mode,
  );

  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      {/* Listing header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-line bg-brand-light/40 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-display text-lg font-bold text-brand-ink">
              {listing.name}
            </h2>
            <span
              className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ${
                listing.is_published
                  ? "bg-green-100 text-green-800"
                  : "bg-brand-line text-brand-mute"
              }`}
            >
              {listing.is_published ? "Published" : "Draft"}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-brand-mute">
            Mode:{" "}
            <span className="text-brand-ink">
              {BOOKING_MODE_LABEL[bookingMode]}
            </span>{" "}
            · {rooms.length} room{rooms.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {listing.is_published && listing.slug ? (
            <Link
              href={`/property/${listing.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-mute hover:text-brand-ink"
            >
              View public
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
          <ListingSettingsDialog
            listingId={listing.id}
            listingName={listing.name}
            currentMode={bookingMode}
            onSaved={setBookingMode}
          />
        </div>
      </div>

      {/* Embedded RoomsManager — full CRUD inline */}
      <RoomsManager
        listingId={listing.id}
        rooms={rooms}
        onChange={setRooms}
        embedded
      />
    </section>
  );
}
