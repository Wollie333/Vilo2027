"use client";

import {
  AlertTriangle,
  CalendarClock,
  Camera,
  ChevronRight,
  Eye,
  Home,
  Image as ImageIcon,
  KeyRound,
  ListChecks,
  MapPin,
  PackagePlus,
  Receipt,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
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
import { GuestAccessTab, type AccessInitial } from "./tabs/GuestAccessTab";
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
import type { LocalPickInput } from "./schemas";

export type EditorListing = {
  id: string;
  host_id: string;
  business_id: string | null;
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
  vat_number: string | null;
  vat_rate: number | null;
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
  | "access"
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
  { key: "access", label: "Guest access", icon: KeyRound },
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
  businesses,
  access,
  localPicks,
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
  businesses: { id: string; name: string }[];
  access: AccessInitial | null;
  localPicks: LocalPickInput[];
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

  const cover = photos[0]?.url ?? null;

  // Short context line under each section title in the rail.
  function railSub(key: TabKey): string | null {
    switch (key) {
      case "basic":
        return typeLabel;
      case "photos":
        return `${photos.length} photo${photos.length === 1 ? "" : "s"}`;
      case "location":
        return locationLabel || "Set the pin";
      case "rooms":
        return `${rooms.length} room${rooms.length === 1 ? "" : "s"}`;
      case "danger":
        return "Unpublish · archive";
      default:
        return null;
    }
  }

  return (
    <div className="space-y-5">
      {/* ============ IDENTITY BAR ============ */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-brand-line bg-white px-4 py-3 shadow-card">
        <div className="h-12 w-16 shrink-0 overflow-hidden rounded-[11px] border border-brand-line bg-brand-light">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-brand-mute">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <nav className="flex items-center gap-1.5 text-[11px] text-brand-mute">
            <Link href="/dashboard/listings" className="hover:text-brand-ink">
              Listings
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-ink">Editing</span>
          </nav>
          <div className="mt-0.5 flex items-center gap-2.5">
            <h1 className="truncate font-display text-[19px] font-extrabold leading-none text-brand-ink">
              {listing.name}
            </h1>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-2 py-0.5 text-[11px] font-semibold ${
                isPublished
                  ? "border-brand-primary/30 bg-brand-accent text-brand-secondary"
                  : "border-brand-line bg-brand-light text-brand-mute"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isPublished ? "bg-brand-primary" : "bg-brand-mute"
                }`}
              />
              {isPublished ? "Published" : "Draft"}
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-pill border border-brand-line bg-brand-light/60 px-3 py-1.5 lg:flex">
            <span className="text-[12px] font-semibold text-brand-ink">
              {publishPending ? "Saving…" : isPublished ? "Published" : "Draft"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isPublished}
              aria-label="Toggle published"
              onClick={togglePublish}
              disabled={publishPending}
              className={`relative h-5 w-9 rounded-pill transition-colors disabled:opacity-50 ${
                isPublished ? "bg-brand-primary" : "bg-brand-line"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                  isPublished ? "left-4" : "left-0.5"
                }`}
              />
            </button>
          </div>
          {isPublished && listing.slug ? (
            <Link
              href={`/listing/${listing.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
            >
              <Eye className="h-4 w-4 text-brand-mute" /> Preview
            </Link>
          ) : null}
          <Link
            href="/dashboard/listings"
            className="inline-flex items-center rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
          >
            Done
          </Link>
        </div>
      </div>

      {/* ============ SPLIT: section rail + panel ============ */}
      <div className="grid gap-6 lg:grid-cols-[262px_1fr]">
        {/* section navigator */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Sections
          </div>
          <div className="space-y-1">
            {TABS.map(({ key, label, icon: Icon }) => {
              const isActive = active === key;
              const isDanger = key === "danger";
              const sub = railSub(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActive(key)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-[13px] border px-3 py-2.5 text-left transition ${
                    isActive
                      ? isDanger
                        ? "border-status-cancelled/30 bg-status-cancelled/5"
                        : "border-brand-line bg-white shadow-card"
                      : "border-transparent hover:bg-white"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition ${
                      isActive
                        ? isDanger
                          ? "bg-status-cancelled text-white"
                          : "bg-brand-primary text-white"
                        : isDanger
                          ? "bg-status-cancelled/10 text-status-cancelled"
                          : "bg-brand-accent/70 text-brand-secondary"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[13.5px] font-semibold leading-tight ${
                        isDanger
                          ? "text-status-cancelled"
                          : isActive
                            ? "text-brand-ink"
                            : "text-brand-ink/80"
                      }`}
                    >
                      {label}
                    </span>
                    {sub ? (
                      <span className="mt-0.5 block truncate text-[11px] text-brand-mute">
                        {sub}
                      </span>
                    ) : null}
                  </span>
                  {key === "photos" && photos.length > 0 ? (
                    <span className="num shrink-0 rounded-pill bg-brand-line px-1.5 py-0.5 text-[9.5px] font-bold text-brand-mute">
                      {photos.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        {/* ============ ACTIVE PANEL ============ */}
        <div className="min-w-0">
          {active === "basic" ? (
            <BasicTab
              listing={listing}
              categoryLeaves={categoryLeaves}
              businesses={businesses}
            />
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
          {active === "access" ? (
            <GuestAccessTab
              listingId={listing.id}
              access={access}
              picks={localPicks}
            />
          ) : null}
          {active === "settings" ? <SettingsTab listing={listing} /> : null}
          {active === "danger" ? (
            <DangerTab listingId={listing.id} listingName={listing.name} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
