"use client";

import {
  ArrowLeft,
  Bath,
  BedDouble,
  ExternalLink,
  ImageIcon,
  Settings,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { RoomAmenitiesSection } from "./sections/RoomAmenitiesSection";
import { RoomDetailsForm } from "./sections/RoomDetailsForm";
import { RoomPhotosSection } from "./sections/RoomPhotosSection";

export type RoomPricingMode = "per_room" | "per_person" | "per_room_plus_extra";

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
  // Bed composition — capacity (max_guests) is derived from these.
  beds: { bed_kind: string; quantity: number }[];
  // Pricing model.
  pricing_mode: RoomPricingMode;
  price_per_person: number | null;
  base_occupancy: number | null;
  extra_guest_price: number | null;
};

/** The room's effective "from" nightly figure for the chosen pricing mode. */
export function effectiveNightly(room: {
  pricing_mode: RoomPricingMode;
  base_price: number;
  price_per_person: number | null;
}): number {
  return room.pricing_mode === "per_person"
    ? (room.price_per_person ?? 0)
    : room.base_price;
}

export type RoomEditorPhoto = { id: string; url: string };

type TabId = "details" | "photos" | "amenities";

const TABS: { id: TabId; label: string; icon: typeof Settings }[] = [
  { id: "details", label: "Details", icon: Settings },
  { id: "photos", label: "Photos", icon: ImageIcon },
  { id: "amenities", label: "Amenities", icon: Sparkles },
];

function formatPrice(amount: number, currency: string): string {
  const prefix = currency === "ZAR" ? "R " : `${currency} `;
  const rounded = Math.round(amount).toLocaleString("en-ZA").replace(/,/g, " ");
  return `${prefix}${rounded}`;
}

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
  const [activeTab, setActiveTab] = useState<TabId>("details");

  const featuredPhoto =
    photos.find((p) => p.id === room.featured_photo_id) ?? photos[0] ?? null;
  const stripPhotos = photos.slice(0, 6);
  const remainingPhotos = Math.max(0, photos.length - stripPhotos.length);

  const bedSummary =
    room.bed_type && room.bedrooms
      ? `${room.bedrooms} ${room.bed_type}${room.bedrooms > 1 ? "s" : ""}`
      : room.bed_type
        ? room.bed_type
        : room.bedrooms
          ? `${room.bedrooms} bed${room.bedrooms > 1 ? "s" : ""}`
          : "Beds not set";

  const bathSummary = room.bathrooms
    ? `${room.bathrooms} bath${room.bathrooms > 1 ? "s" : ""}`
    : "Bath not set";

  const tabCounts: Record<TabId, string | null> = {
    details: null,
    photos: String(photos.length),
    amenities: String(amenityKeys.length),
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Back link */}
      <div>
        <Link
          href={`/dashboard/listings/${listingId}/edit?tab=rooms`}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-mute hover:text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          All rooms · {listingName}
        </Link>
      </div>

      {/* DARK HERO */}
      <section className="relative overflow-hidden rounded-card border border-brand-line shadow-card">
        <div className="grid gap-0 md:grid-cols-[1.45fr_1fr]">
          {/* Left: identity + actions */}
          <div className="relative bg-brand-gradient-dark p-7 text-white md:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-primary/30 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -left-20 bottom-0 h-44 w-44 rounded-full bg-brand-secondary/40 blur-3xl"
            />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent backdrop-blur">
                  Room editor
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider backdrop-blur ${
                    room.is_active
                      ? "bg-brand-primary/15 text-brand-primary"
                      : "bg-white/10 text-brand-accent/80"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      room.is_active ? "bg-brand-primary" : "bg-brand-accent/50"
                    }`}
                  />
                  {room.is_active ? "Bookable now" : "Hidden"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent/80 backdrop-blur">
                  Inside{" "}
                  <Link
                    href={`/dashboard/listings/${listingId}/edit`}
                    className="underline decoration-brand-primary underline-offset-2 hover:text-white"
                  >
                    {listingName}
                  </Link>
                </span>
              </div>

              <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight md:text-[34px]">
                {room.name}
              </h2>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-brand-accent/80">
                <span className="inline-flex items-center gap-1.5">
                  <BedDouble className="h-3.5 w-3.5" />
                  {bedSummary} · sleeps {room.max_guests}
                </span>
                <span className="text-brand-accent/40">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Bath className="h-3.5 w-3.5" />
                  {bathSummary}
                </span>
                <span className="text-brand-accent/40">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-mono text-brand-accent/70">ID</span>
                  <span className="font-mono font-semibold text-white">
                    {room.id.slice(0, 8)}
                  </span>
                </span>
              </div>

              {/* Spec ribbon */}
              <div className="mt-6 grid max-w-md grid-cols-4 gap-3">
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-wider text-brand-accent/60">
                    {room.pricing_mode === "per_person"
                      ? "Per person"
                      : room.pricing_mode === "per_room_plus_extra"
                        ? "From / night"
                        : "Base / night"}
                  </div>
                  <div className="mt-1 font-display text-xl font-bold text-white">
                    {formatPrice(effectiveNightly(room), currency)}
                  </div>
                  <div className="text-[10px] text-brand-accent/60">
                    {room.pricing_mode === "per_person"
                      ? "per guest / night"
                      : currency}
                  </div>
                </div>
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-wider text-brand-accent/60">
                    Weekend
                  </div>
                  <div className="mt-1 font-display text-xl font-bold text-white">
                    {room.weekend_price != null
                      ? formatPrice(room.weekend_price, currency)
                      : "—"}
                  </div>
                  <div className="text-[10px] text-brand-accent/60">
                    {room.weekend_price != null ? "Fri & Sat" : "uses base"}
                  </div>
                </div>
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-wider text-brand-accent/60">
                    Photos
                  </div>
                  <div className="mt-1 font-display text-xl font-bold text-white">
                    {photos.length}
                  </div>
                  <div className="text-[10px] text-brand-accent/60">
                    {photos.length === 0 ? "add some" : "uploaded"}
                  </div>
                </div>
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-wider text-brand-accent/60">
                    Amenities
                  </div>
                  <div className="mt-1 font-display text-xl font-bold text-white">
                    {amenityKeys.length}
                  </div>
                  <div className="text-[10px] text-brand-accent/60">
                    selected
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                {listingSlug ? (
                  <Link
                    href={`/listing/${listingSlug}/rooms/${room.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 rounded-[10px] bg-white px-4 py-2.5 text-sm font-semibold text-brand-secondary shadow-glow hover:bg-brand-accent"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View public
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-white/10 px-4 py-2.5 text-sm font-medium text-white/60">
                    <ExternalLink className="h-4 w-4" />
                    Publish listing to share
                  </span>
                )}
                <Link
                  href={`/dashboard/listings/${listingId}/edit?tab=rooms`}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/20 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to rooms
                </Link>
                <div className="ml-auto flex items-center gap-2 rounded-pill border border-white/15 bg-black/30 px-3 py-1.5 backdrop-blur">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      room.is_active ? "bg-brand-primary" : "bg-brand-accent/40"
                    }`}
                  />
                  <span className="text-[11.5px] font-medium text-white/90">
                    {room.is_active ? "Bookable" : "Hidden"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: photo strip */}
          <div className="relative bg-brand-dark">
            {photos.length === 0 ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/70">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <p className="text-[12px] font-medium text-white/80">
                  No photos uploaded yet
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("photos")}
                  className="mt-1 text-[11.5px] font-semibold text-brand-primary hover:text-white"
                >
                  Add the first photo →
                </button>
              </div>
            ) : (
              <div className="grid h-full min-h-[300px] grid-cols-3 grid-rows-3 gap-1 p-2">
                {featuredPhoto ? (
                  <div className="col-span-2 row-span-2 overflow-hidden rounded-[10px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={featuredPhoto.url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : null}
                {stripPhotos
                  .filter((p) => p.id !== featuredPhoto?.id)
                  .slice(0, 4)
                  .map((p, idx, arr) => {
                    const isLast =
                      idx === arr.length - 1 && remainingPhotos > 0;
                    return (
                      <div
                        key={p.id}
                        className="relative overflow-hidden rounded-[10px]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        {isLast ? (
                          <button
                            type="button"
                            onClick={() => setActiveTab("photos")}
                            className="absolute inset-0 flex items-center justify-center bg-brand-dark/70 text-[11px] font-semibold text-white hover:bg-brand-dark/85"
                          >
                            +{remainingPhotos} more
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* STICKY TAB BAR */}
      <section className="sticky top-16 z-10 rounded-card border border-brand-line bg-white shadow-card">
        <div className="flex items-center gap-0.5 overflow-x-auto px-2 py-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const count = tabCounts[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12.5px] transition-colors ${
                  active
                    ? "bg-brand-accent font-semibold text-brand-secondary"
                    : "font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {count !== null ? (
                  <span
                    className={`rounded-pill px-1.5 py-0.5 text-[9.5px] font-bold ${
                      active
                        ? "bg-white/80 text-brand-secondary"
                        : "bg-brand-line text-brand-mute"
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
          <div className="ml-auto hidden items-center gap-1.5 pl-2 text-[11px] text-brand-mute md:flex">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Changes save per section</span>
          </div>
        </div>
      </section>

      {/* TAB CONTENT */}
      {activeTab === "details" ? (
        <RoomDetailsForm
          listingId={listingId}
          room={room}
          onSaved={(patch) => setRoom((r) => ({ ...r, ...patch }))}
        />
      ) : null}

      {activeTab === "photos" ? (
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
      ) : null}

      {activeTab === "amenities" ? (
        <RoomAmenitiesSection
          listingId={listingId}
          roomId={room.id}
          amenityKeys={amenityKeys}
          onChange={setAmenityKeys}
        />
      ) : null}
    </div>
  );
}
