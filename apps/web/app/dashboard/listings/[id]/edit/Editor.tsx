"use client";

import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Camera,
  ExternalLink,
  Globe,
  Home,
  Image as ImageIcon,
  ListChecks,
  MapPin,
  PackagePlus,
  Receipt,
  Settings as SettingsIcon,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

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
import { LogisticsTab } from "./tabs/LogisticsTab";
import { PhotosTab } from "./tabs/PhotosTab";
import { PoliciesTab } from "./tabs/PoliciesTab";
import { PricingTab } from "./tabs/PricingTab";
import { RoomsTab } from "./tabs/RoomsTab";
import { ScheduleTab } from "./tabs/ScheduleTab";
import { SettingsTab } from "./tabs/SettingsTab";

export type ScheduleRecurringDay = {
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  times: string[];
};
export type ScheduleSpecificEntry = { date: string; time: string };
export type ListingSchedule =
  | { kind: "recurring"; days: ScheduleRecurringDay[] }
  | { kind: "specific"; dates: ScheduleSpecificEntry[] };

export type EditorListing = {
  id: string;
  host_id: string;
  listing_type: "accommodation" | "experience";
  accommodation_type: string | null;
  experience_type: string | null;
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
  currency: string;
  cancellation_policy: "flexible" | "moderate" | "strict";
  house_rules: string | null;
  instant_booking: boolean;
  is_published: boolean;
  booking_mode: "whole_listing" | "rooms_only" | "flexible";
  // Experience-only fields (null for accommodation listings)
  duration_minutes: number | null;
  max_participants: number | null;
  min_participants: number | null;
  meeting_point: string | null;
  what_to_bring: string | null;
  private_group_price: number | null;
  schedule: ListingSchedule | null;
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
  base_price: number;
  weekend_price: number | null;
  cleaning_fee: number;
  sort_order: number;
  is_active: boolean;
  // Drill-in editor fields (migration 20260524000004).
  room_size_sqm: number | null;
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
  beds: { bed_kind: string; quantity: number }[];
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
  | "logistics"
  | "schedule"
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

const EXPERIENCE_TABS: TabDef[] = [
  { key: "basic", label: "Basic info", icon: Home },
  { key: "photos", label: "Photos", icon: ImageIcon },
  { key: "location", label: "Location", icon: MapPin },
  { key: "logistics", label: "Logistics", icon: Users },
  { key: "schedule", label: "Schedule", icon: CalendarDays },
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
}: {
  listing: EditorListing;
  amenities: EditorAmenity[];
  photos: EditorPhoto[];
  rooms: EditorRoom[];
  availableAddons: AvailableAddon[];
  assignedAddons: AssignedAddon[];
}) {
  const TABS =
    listing.listing_type === "experience"
      ? EXPERIENCE_TABS
      : ACCOMMODATION_TABS;
  const [active, setActive] = useState<TabKey>("basic");
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

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Listing editor
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            {listing.name}
          </h1>
          <div className="mt-1 text-xs text-brand-mute">
            {listing.listing_type === "accommodation"
              ? "Accommodation"
              : "Experience"}{" "}
            ·{" "}
            <span
              className={
                isPublished
                  ? "font-medium text-status-confirmed"
                  : "font-medium text-brand-mute"
              }
            >
              {isPublished ? "Published" : "Draft"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPublished && listing.slug ? (
            <Link
              href={`/listing/${listing.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent"
            >
              View public
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
          <Button
            type="button"
            onClick={togglePublish}
            disabled={publishPending}
            variant={isPublished ? "outline" : "default"}
            className="gap-1.5"
          >
            {isPublished ? (
              "Unpublish"
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Publish
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav
          aria-label="Editor sections"
          className="lg:sticky lg:top-6 lg:self-start"
        >
          <ul className="hscroll flex gap-1 overflow-x-auto lg:flex-col lg:overflow-x-visible">
            {TABS.map(({ key, label, icon: Icon }) => {
              const isActive = active === key;
              return (
                <li key={key} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => setActive(key)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex w-full items-center gap-2 rounded px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-brand-accent text-brand-primary"
                        : "text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="whitespace-nowrap">{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 hidden rounded border border-brand-line bg-white p-3 text-xs text-brand-mute lg:block">
            <div className="font-semibold text-brand-ink">Save per tab</div>
            <p className="mt-1 leading-relaxed">
              Each tab saves on its own. Publish only enables once name, base
              price and max guests are set.
            </p>
          </div>
        </nav>

        <div>
          {active === "basic" ? <BasicTab listing={listing} /> : null}
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
            />
          ) : null}
          {active === "amenities" ? (
            <AmenitiesTab
              listingId={listing.id}
              initial={amenities}
              rooms={rooms}
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
          {active === "logistics" ? <LogisticsTab listing={listing} /> : null}
          {active === "schedule" ? <ScheduleTab listing={listing} /> : null}
          {active === "pricing" ? <PricingTab listing={listing} /> : null}
          {active === "policies" ? <PoliciesTab listing={listing} /> : null}
          {active === "settings" ? <SettingsTab listing={listing} /> : null}
          {active === "danger" ? (
            <DangerTab listingId={listing.id} listingName={listing.name} />
          ) : null}
        </div>
      </div>

      <div className="mt-8 rounded border border-brand-line bg-white p-4 text-xs text-brand-mute">
        <Globe className="mr-1.5 inline-block h-3.5 w-3.5 align-text-bottom text-brand-mute" />
        Each tab saves on its own. The Mapbox picker on Location and the
        rich-text editor on Basic info activate when their env vars are set —
        without them the editor falls back to plain address + text fields.
      </div>
    </div>
  );
}
