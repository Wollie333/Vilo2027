"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { RoomAmenitiesSection } from "./sections/RoomAmenitiesSection";
import { RoomDetailsForm } from "./sections/RoomDetailsForm";
import { RoomPhotosSection } from "./sections/RoomPhotosSection";

export type RoomEditorRoom = {
  id: string;
  name: string;
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  max_guests: number;
  base_price: number;
  weekend_price: number | null;
  cleaning_fee: number;
  is_active: boolean;
  room_size_sqm: number | null;
  bed_type: string | null;
  view_type: string | null;
  experiences: string[];
  featured_photo_id: string | null;
};

export type RoomEditorPhoto = { id: string; url: string };

export function RoomEditor({
  listingId,
  listingName,
  listingSlug,
  currency,
  room: initialRoom,
  initialPhotos,
  initialAmenityKeys,
}: {
  listingId: string;
  listingName: string;
  listingSlug: string | null;
  currency: string;
  room: RoomEditorRoom;
  initialPhotos: RoomEditorPhoto[];
  initialAmenityKeys: string[];
}) {
  const [room, setRoom] = useState<RoomEditorRoom>(initialRoom);
  const [photos, setPhotos] = useState<RoomEditorPhoto[]>(initialPhotos);
  const [amenityKeys, setAmenityKeys] = useState<string[]>(initialAmenityKeys);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/listings/${listingId}/edit?tab=rooms`}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-mute hover:text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          All rooms · {listingName}
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              Room editor
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
              {room.name}
            </h1>
            <div className="mt-1 text-xs text-brand-mute">
              {room.is_active ? "Bookable" : "Hidden from guests"} ·{" "}
              {currency === "ZAR" ? "R " : ""}
              {Math.round(room.base_price)
                .toLocaleString("en-ZA")
                .replace(/,/g, " ")}{" "}
              / night
            </div>
          </div>
          {listingSlug ? (
            <Link
              href={`/listing/${listingSlug}/rooms/${room.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent"
            >
              View public
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      </div>

      <RoomDetailsForm
        listingId={listingId}
        room={room}
        onSaved={(patch) => setRoom((r) => ({ ...r, ...patch }))}
      />

      <RoomPhotosSection
        listingId={listingId}
        roomId={room.id}
        featuredPhotoId={room.featured_photo_id}
        photos={photos}
        onPhotosChange={setPhotos}
        onFeaturedChange={(id) =>
          setRoom((r) => ({ ...r, featured_photo_id: id }))
        }
      />

      <RoomAmenitiesSection
        listingId={listingId}
        roomId={room.id}
        amenityKeys={amenityKeys}
        onChange={setAmenityKeys}
      />
    </div>
  );
}
