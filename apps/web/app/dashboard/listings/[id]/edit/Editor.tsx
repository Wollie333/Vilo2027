"use client";

import {
  AlertTriangle,
  CalendarClock,
  Camera,
  ExternalLink,
  Home,
  Image as ImageIcon,
  ListChecks,
  Link2,
  MapPin,
  PackagePlus,
  Play,
  Receipt,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { CategoryPickerLeaf } from "@/lib/taxonomy/CategoryPicker";
import type { AmenityGroupWithItems } from "@/lib/taxonomy/types";

import { togglePublishAction } from "./actions";
import {
  AddonsTab,
  type AssignedAddon,
  type AvailableAddon,
} from "./tabs/AddonsTab";
import { AmenitiesTab } from "./tabs/AmenitiesTab";
import { BasicTab } from "./tabs/BasicTab";
import { DangerTab } from "./tabs/DangerTab";
import { LocationTab } from "./tabs/LocationTab";
import { PhotosTab } from "./tabs/PhotosTab";
import {
  PoliciesTab,
  type AssignedPolicy,
  type AvailablePolicy,
} from "./tabs/PoliciesTab";
import { PricingTab } from "./tabs/PricingTab";
import { RoomsTab } from "./tabs/RoomsTab";
import { SettingsTab } from "./tabs/SettingsTab";

export type EditorListing = {
  id: string;
  host_id: string;
  listing_type: "accommodation";
  accommodation_type: string | null;
  category_id: string | null;
  name: string;
  slug: string | null;
  description: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  max_guests: number | null;
  min_nights: number | null;
  max_nights: number | null;
  check_in_time: string | null;
  check_out_time: string | null;
  base_price: number | null;
  weekend_price: number | null;
  cleaning_fee: number | null;
  whole_listing_discount_pct: number | null;
  weekly_discount_pct: number | null;
  monthly_discount_pct: number | null;
  currency: string;
  cancellation_policy: "flexible" | "moderate" | "strict";
  house_rules: string | null;
  instant_booking: boolean;
  is_published: boolean;
  booking_mode: "whole_listing" | "rooms_only" | "flexible";
};

export type EditorPhoto = {
  id: string;
  url: string;
  roomId: string | null;
};

export type EditorAmenity = {
  id: string;
  key: string;
  label: string | null;
  roomId: string | null;
};

export type EditorRoom = {
  id: string;
  name: string;
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  max_guests: number;
  min_guests: number;
  min_nights: number;
  base_price: number;
  weekend_price: number | null;
  cleaning_fee: number;
  sort_order: number;
  is_active: boolean;
  // Drill-in editor fields (migration 20260524000004).
  room_size_sqm: number | null;
  bed_type: string | null;
  view_type: string | null;
  experiences: string[];
  // Enterprise fields (migration 20260524000007).
  has_ensuite_bathroom: boolean;
  smoking_allowed: boolean;
  pets_allowed: boolean;
  wheelchair_accessible: boolean;
  private_entrance: boolean;
  floor_number: number | null;
  inventory_count: number;
  // Pricing model (migration 20260530000001).
  pricing_mode: "per_room" | "per_person" | "per_room_plus_extra";
  price_per_person: number | null;
  base_occupancy: number | null;
  extra_guest_price: number | null;
  featured_photo_id: string | null;
  beds: { bed_kind: string; quantity: number; sleeps: number }[];
  // Optional — populated by /dashboard/rooms so the inline tabbed editor
  // has everything it needs without a follow-up fetch. The listing editor
  // page doesn't populate these (it uses the drill-in editor for photos
  // + amenities).
  featuredPhotoUrl?: string | null;
  featuredPhotoId?: string | null;
  photos?: { id: string; url: string }[];
  amenityKeys?: string[];
};

type TabKey =
  | "basic"
  | "photos"
  | "location"
  | "rooms"
  | "amenities"
  | "addons"
  | "pricing"
  | "policies"
  | "settings"
  | "danger";

type TabDef = { key: TabKey; label: string; icon: LucideIcon };

const ACCOMMODATION_TABS: TabDef[] = [
  { key: "basic", label: "Basic info", icon: Home },
  { key: "photos", label: "Photos", icon: ImageIcon },
  { key: "location", label: "Location", icon: MapPin },
  { key: "rooms", label: "Rooms & capacity", icon: Camera },
  { key: "amenities", label: "Amenities", icon: ListChecks },
  { key: "addons", label: "Add-ons", icon: PackagePlus },
  { key: "pricing", label: "Pricing", icon: Receipt },
  { key: "policies", label: "Policies", icon: CalendarClock },
  { key: "settings", label: "Booking settings", icon: SettingsIcon },
  { key: "danger", label: "Danger zone", icon: AlertTriangle },
];

export function Editor({
  listing,
  amenities,
  photos: initialPhotos,
  rooms: initialRooms,
  availableAddons,
  assignedAddons,
  availablePolicies,
  assignedPolicies,
  categoryLeaves,
  amenityGroups,
  initialTab,
  autoCreateRoom = false,
}: {
  listing: EditorListing;
  amenities: EditorAmenity[];
  photos: EditorPhoto[];
  rooms: EditorRoom[];
  availableAddons: AvailableAddon[];
  assignedAddons: AssignedAddon[];
  availablePolicies: AvailablePolicy[];
  assignedPolicies: AssignedPolicy[];
  categoryLeaves: CategoryPickerLeaf[];
  amenityGroups: AmenityGroupWithItems[];
  /** Deep-link the editor to a tab (e.g. ?tab=rooms). Falls back to Basic info. */
  initialTab?: string;
  /** ?add=1 on the rooms tab — auto-open a fresh room form. */
  autoCreateRoom?: boolean;
}) {
  const TABS = ACCOMMODATION_TABS;
  const [active, setActive] = useState<TabKey>(() =>
    TABS.some((t) => t.key === initialTab) ? (initialTab as TabKey) : "basic",
  );
  const [isPublished, setIsPublished] = useState(listing.is_published);
  const [publishPending, startPublish] = useTransition();
  // Local photo state so adds/removes show immediately without page reload.
  const [photos, setPhotos] = useState<EditorPhoto[]>(initialPhotos);
  const [rooms, setRooms] = useState<EditorRoom[]>(initialRooms);

  function togglePublish() {
    const next = !isPublished;
    startPublish(async () => {
      const result = await togglePublishAction(listing.id, next);
      if (result.ok) {
        setIsPublished(next);
        toast.success(next ? "Listing published" : "Listing unpublished");
      } else {
        toast.error(result.error);
      }
    });
  }

  const typeLabel = listing.accommodation_type
    ? listing.accommodation_type.charAt(0).toUpperCase() +
      listing.accommodation_type.slice(1)
    : "Accommodation";

  const locationLabel = [listing.city, listing.province]
    .filter(Boolean)
    .join(", ");

  const heroPhotos = photos.slice(0, 5);
  const remainingPhotoCount = Math.max(0, photos.length - 5);

  return (
    <div className="space-y-6 lg:space-y-7">
      {/* ============ DARK HERO ============ */}
      <section className="relative overflow-hidden rounded-card border border-brand-line shadow-card">
        <div className="grid gap-0 md:grid-cols-[1.45fr_1fr]">
          {/* Left: identity + actions */}
          <div className="relative bg-brand-gradient-dark p-7 text-white md:p-8">
            <div aria-hidden className="dotgrid absolute inset-0 opacity-30" />
            <div
              aria-hidden
              className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-primary/30 blur-3xl"
            />
            <div
              aria-hidden
              className="absolute -left-20 bottom-0 h-44 w-44 rounded-full bg-brand-secondary/40 blur-3xl"
            />

            <div className="relative">
              {/* Top row: eyebrow + status */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent backdrop-blur">
                  Listing editor
                </div>
                <div
                  className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider backdrop-blur ${
                    isPublished
                      ? "bg-brand-primary/15 text-brand-primary"
                      : "bg-white/10 text-brand-accent/80"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isPublished
                        ? "pulse-soft bg-brand-primary"
                        : "bg-brand-accent/60"
                    }`}
                  />
                  {isPublished ? "Published · live" : "Draft · not live"}
                </div>
              </div>

              {/* Title */}
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight md:text-[34px]">
                {listing.name}
              </h2>

              {/* Type + slug */}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-brand-accent/80">
                <span className="inline-flex items-center gap-1.5">
                  <Home className="h-3.5 w-3.5" />
                  {typeLabel}
                  {locationLabel ? ` · ${locationLabel}` : null}
                </span>
                {listing.slug ? (
                  <>
                    <span className="text-brand-accent/40">·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5" />
                      <span className="font-mono text-brand-accent/70">
                        viloplatform.com/listing/
                      </span>
                      <span className="font-mono font-semibold text-white">
                        {listing.slug}
                      </span>
                    </span>
                  </>
                ) : null}
              </div>

              {/* Performance ribbon */}
              <div className="mt-6 grid max-w-md grid-cols-4 gap-3">
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-wider text-brand-accent/60">
                    Lifetime
                  </div>
                  <div className="num mt-1 font-display text-xl font-bold text-white">
                    —
                  </div>
                  <div className="text-[10px] text-brand-accent/60">
                    bookings
                  </div>
                </div>
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-wider text-brand-accent/60">
                    Occupancy
                  </div>
                  <div className="num mt-1 font-display text-xl font-bold text-white">
                    —
                  </div>
                  <div className="text-[10px] text-brand-accent/60">
                    coming soon
                  </div>
                </div>
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-wider text-brand-accent/60">
                    Rating
                  </div>
                  <div className="num mt-1 flex items-baseline gap-0.5 font-display text-xl font-bold text-white">
                    —
                  </div>
                  <div className="text-[10px] text-brand-accent/60">
                    no reviews
                  </div>
                </div>
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-wider text-brand-accent/60">
                    Page views
                  </div>
                  <div className="num mt-1 font-display text-xl font-bold text-white">
                    —
                  </div>
                  <div className="text-[10px] text-brand-accent/60">
                    coming soon
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                {isPublished && listing.slug ? (
                  <Link
                    href={`/listing/${listing.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 rounded-[10px] bg-white px-4 py-2.5 text-sm font-semibold text-brand-secondary shadow-glow hover:bg-brand-accent"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View public page
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-white/10 px-4 py-2.5 text-sm font-medium text-white/60">
                    <ExternalLink className="h-4 w-4" />
                    View public page
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setActive("photos")}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/20 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
                >
                  <Play className="h-4 w-4" />
                  Preview booking flow
                </button>

                {/* Publish toggle pill */}
                <div className="ml-auto flex items-center gap-2 rounded-pill border border-white/15 bg-black/30 px-2.5 py-1.5 backdrop-blur">
                  <span className="text-[11.5px] font-medium text-white/90">
                    {publishPending
                      ? "Publishing…"
                      : isPublished
                        ? "Published"
                        : "Draft"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isPublished}
                    aria-label="Toggle published"
                    onClick={togglePublish}
                    disabled={publishPending}
                    className={`relative h-5 w-9 rounded-pill transition-colors disabled:opacity-50 ${
                      isPublished ? "bg-brand-primary" : "bg-white/20"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                        isPublished ? "left-4" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: photo grid */}
          <div className="relative bg-brand-dark">
            <div className="grid h-full min-h-[300px] grid-cols-3 grid-rows-3 gap-1 p-2">
              {heroPhotos.length === 0 ? (
                <>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className={`overflow-hidden rounded-[10px] bg-brand-accent/20 ${
                        i === 0 ? "col-span-2 row-span-2" : ""
                      }`}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setActive("photos")}
                    className="col-span-3 mt-1 rounded-[10px] bg-brand-accent/10 py-2 text-[11px] font-semibold text-brand-accent hover:bg-brand-accent/20"
                  >
                    Add photos →
                  </button>
                </>
              ) : (
                <>
                  {heroPhotos.map((p, i) => (
                    <div
                      key={p.id}
                      className={`overflow-hidden rounded-[10px] ${
                        i === 0 ? "col-span-2 row-span-2" : ""
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                  {/* 6th cell: "view all" overlay or fill placeholder */}
                  {photos.length > 5 ? (
                    <div className="relative overflow-hidden rounded-[10px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photos[5].url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setActive("photos")}
                        className="absolute inset-0 flex items-center justify-center bg-brand-dark/70 text-[11px] font-semibold text-white hover:bg-brand-dark/85"
                      >
                        +{remainingPhotoCount} more
                      </button>
                    </div>
                  ) : (
                    // Fewer than 6 photos — fill remaining cells then show "View all"
                    Array.from({
                      length: Math.max(0, 5 - heroPhotos.length),
                    }).map((_, i) => (
                      <button
                        key={`empty-${i}`}
                        type="button"
                        onClick={() => setActive("photos")}
                        className="overflow-hidden rounded-[10px] bg-brand-accent/10 text-[10px] font-semibold text-brand-accent hover:bg-brand-accent/20"
                      >
                        +
                      </button>
                    ))
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ STICKY TAB BAR ============ */}
      <section className="sticky top-16 z-10 rounded-card border border-brand-line bg-white shadow-card">
        <div className="hscroll flex items-center gap-0.5 overflow-x-auto px-2 py-1.5">
          {TABS.map(({ key, label, icon: Icon }) => {
            const isActive = active === key;
            const isDanger = key === "danger";
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActive(key)}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12.5px] transition-colors ${
                  isDanger ? "ml-auto" : ""
                } ${
                  isActive
                    ? isDanger
                      ? "bg-status-cancelled/10 font-semibold text-status-cancelled"
                      : "bg-brand-accent font-semibold text-brand-secondary"
                    : isDanger
                      ? "font-medium text-status-cancelled hover:bg-status-cancelled/5"
                      : "font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {key === "photos" && photos.length > 0 ? (
                  <span className="num rounded-pill bg-brand-line px-1.5 py-0.5 text-[9.5px] font-bold text-brand-mute">
                    {photos.length}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {/* ============ ACTIVE TAB CONTENT ============ */}
      <div>
        {active === "basic" ? (
          <BasicTab listing={listing} categoryLeaves={categoryLeaves} />
        ) : null}
        {active === "photos" ? (
          <PhotosTab
            listingId={listing.id}
            photos={photos}
            rooms={rooms}
            onChange={setPhotos}
          />
        ) : null}
        {active === "location" ? <LocationTab listing={listing} /> : null}
        {active === "rooms" ? (
          <RoomsTab
            listing={listing}
            rooms={rooms}
            onRoomsChange={setRooms}
            autoCreate={autoCreateRoom}
          />
        ) : null}
        {active === "amenities" ? (
          <AmenitiesTab
            listingId={listing.id}
            initial={amenities}
            rooms={rooms}
            groups={amenityGroups}
          />
        ) : null}
        {active === "addons" ? (
          <AddonsTab
            listingId={listing.id}
            available={availableAddons}
            rooms={rooms}
            initialAssigned={assignedAddons}
          />
        ) : null}
        {active === "pricing" ? <PricingTab listing={listing} /> : null}
        {active === "policies" ? (
          <PoliciesTab
            listingId={listing.id}
            rooms={rooms}
            available={availablePolicies}
            assigned={assignedPolicies}
          />
        ) : null}
        {active === "settings" ? <SettingsTab listing={listing} /> : null}
        {active === "danger" ? (
          <DangerTab listingId={listing.id} listingName={listing.name} />
        ) : null}
      </div>
    </div>
  );
}
