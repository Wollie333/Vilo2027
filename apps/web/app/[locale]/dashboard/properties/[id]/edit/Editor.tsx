"use client";

import {
  AlertTriangle,
  CalendarClock,
  Camera,
  Check,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Home,
  Image as ImageIcon,
  KeyRound,
  ListChecks,
  MapPin,
  PackagePlus,
  Pencil,
  Radio,
  Receipt,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";
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
import { ChannelsTab } from "./tabs/ChannelsTab";
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
import type { ListingEditorData } from "./editorData";
import type { LocalPickInput } from "./schemas";

export type EditorListing = {
  id: string;
  host_id: string;
  business_id: string | null;
  property_type: "accommodation";
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
  whole_property_discount_pct: number | null;
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

export type EditorSeasonalRule = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  adjustmentType: "absolute" | "percent";
  adjustmentValue: number;
  currency: string;
  minNights: number | null;
  priority: number;
  isActive: boolean;
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
  | "channels"
  | "review"
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
  { key: "channels", label: "Channels", icon: Radio },
  { key: "review", label: "Review & publish", icon: ClipboardCheck },
  { key: "danger", label: "Danger zone", icon: AlertTriangle },
];

// v3 panel headers — the big section title + one-line intro shown above each
// panel's content.
const PANEL_META: Record<TabKey, { title: string; desc: string }> = {
  basic: {
    title: "Listing basics",
    desc: "Name, category, the owning business and the description guests read first.",
  },
  photos: {
    title: "Photos",
    desc: "Your first photo is the cover. Drag to reorder.",
  },
  location: {
    title: "Location",
    desc: "Where guests will find you — keep the map pin accurate.",
  },
  rooms: {
    title: "Rooms & capacity",
    desc: "The rooms guests can book and their nightly pricing.",
  },
  amenities: {
    title: "Amenities",
    desc: "The features and perks guests filter by.",
  },
  addons: {
    title: "Add-ons",
    desc: "Optional extras guests can add to their booking.",
  },
  pricing: {
    title: "Pricing",
    desc: "Your nightly rate, fees and length-of-stay discounts.",
  },
  policies: {
    title: "Policies",
    desc: "Cancellation terms, check-in times and house rules.",
  },
  access: {
    title: "Guest access",
    desc: "Arrival details and local tips shared after a booking.",
  },
  settings: {
    title: "Booking settings",
    desc: "How guests can reserve this place.",
  },
  channels: {
    title: "Channels",
    desc: "Where this property is published — the Wielo directory and your website.",
  },
  review: {
    title: "Review & publish",
    desc: "Everything at a glance before your listing goes live.",
  },
  danger: {
    title: "Danger zone",
    desc: "Unpublish or archive this listing.",
  },
};

export function Editor({
  listing,
  amenities,
  photos: initialPhotos,
  rooms: initialRooms,
  seasonalRules,
  availableAddons,
  assignedAddons,
  availablePolicies,
  assignedPolicies,
  categoryLeaves,
  amenityGroups,
  businesses,
  access,
  localPicks,
  channels,
  initialTab,
  autoCreateRoom = false,
}: {
  listing: EditorListing;
  amenities: EditorAmenity[];
  photos: EditorPhoto[];
  rooms: EditorRoom[];
  seasonalRules: EditorSeasonalRule[];
  availableAddons: AvailableAddon[];
  assignedAddons: AssignedAddon[];
  availablePolicies: AvailablePolicy[];
  assignedPolicies: AssignedPolicy[];
  categoryLeaves: CategoryPickerLeaf[];
  amenityGroups: AmenityGroupWithItems[];
  businesses: { id: string; name: string }[];
  access: AccessInitial | null;
  localPicks: LocalPickInput[];
  channels: ListingEditorData["channels"];
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

  // ---- Readiness (drives the health ring + the Review step) ----
  // Photos/rooms are live client state; listing fields + policies come from the
  // server props (they refresh after a tab saves via revalidatePath).
  const readiness = useMemo(() => {
    const items: { label: string; done: boolean; tab: TabKey }[] = [
      {
        label: "Name & description",
        done: !!listing.name?.trim() && !!listing.description?.trim(),
        tab: "basic",
      },
      { label: "At least 3 photos", done: photos.length >= 3, tab: "photos" },
      { label: "Location set", done: !!listing.city, tab: "location" },
      {
        label: "Capacity or rooms",
        done: rooms.length > 0 || (listing.max_guests ?? 0) > 0,
        tab: "rooms",
      },
      {
        label: "Pricing set",
        done:
          (listing.base_price ?? 0) > 0 || rooms.some((r) => r.base_price > 0),
        tab: "pricing",
      },
      {
        label: "A cancellation policy",
        done: assignedPolicies.length > 0,
        tab: "policies",
      },
    ];
    const done = items.filter((i) => i.done).length;
    return {
      items,
      done,
      total: items.length,
      pct: Math.round((done / items.length) * 100),
      allDone: done === items.length,
    };
  }, [listing, photos, rooms, assignedPolicies]);

  // "From" nightly price for the Review summary — the listing base, else the
  // cheapest priced room.
  const fromPrice =
    (listing.base_price ?? 0) > 0
      ? listing.base_price
      : (() => {
          const priced = rooms.map((r) => r.base_price).filter((p) => p > 0);
          return priced.length ? Math.min(...priced) : null;
        })();

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
      case "review":
        return readiness.allDone
          ? "Ready to publish"
          : `${readiness.done}/${readiness.total} ready`;
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
            <Link href="/dashboard/properties" className="hover:text-brand-ink">
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
              href={`/property/${listing.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
            >
              <Eye className="h-4 w-4 text-brand-mute" /> Preview
            </Link>
          ) : null}
          <Link
            href="/dashboard/properties"
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
          <button
            type="button"
            onClick={() => setActive("review")}
            className="mb-3 flex w-full items-center gap-3 rounded-card border border-brand-line bg-white p-3.5 text-left shadow-card transition hover:border-brand-primary/40"
          >
            <ProgressRing pct={readiness.pct} />
            <div className="min-w-0">
              <div className="font-display text-[14px] font-bold text-brand-ink">
                {readiness.allDone ? "Ready to publish" : "Almost ready"}
              </div>
              <div className="text-[11px] text-brand-mute">
                {readiness.done}/{readiness.total} essentials done
              </div>
            </div>
          </button>
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
          {(() => {
            const meta = PANEL_META[active];
            const ActiveIcon = TABS.find((t) => t.key === active)?.icon ?? Home;
            const danger = active === "danger";
            return (
              <div className="mb-5 flex items-start gap-3.5">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] ${
                    danger
                      ? "bg-status-cancelled/10 text-status-cancelled"
                      : "bg-brand-accent text-brand-secondary"
                  }`}
                >
                  <ActiveIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2
                    className={`font-display text-[22px] font-extrabold leading-tight ${
                      danger ? "text-status-cancelled" : "text-brand-ink"
                    }`}
                  >
                    {meta.title}
                  </h2>
                  <p className="mt-0.5 text-[13.5px] text-brand-mute">
                    {meta.desc}
                  </p>
                </div>
              </div>
            );
          })()}
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
          {active === "pricing" ? (
            <PricingTab listing={listing} seasonalRules={seasonalRules} />
          ) : null}
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
          {active === "channels" ? (
            <ChannelsTab
              listingId={listing.id}
              slug={listing.slug}
              isPublished={isPublished}
              publishPending={publishPending}
              onToggleDirectory={togglePublish}
              channels={channels}
            />
          ) : null}
          {active === "review" ? (
            <div className="space-y-4">
              {/* readiness */}
              <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
                <div className="flex items-center gap-3 border-b border-brand-line px-5 py-4">
                  <ProgressRing pct={readiness.pct} />
                  <div className="min-w-0">
                    <div className="font-display text-[15px] font-bold text-brand-ink">
                      {readiness.allDone ? "Ready to publish" : "Almost there"}
                    </div>
                    <div className="text-[12px] text-brand-mute">
                      {readiness.allDone
                        ? "Everything guests need is set."
                        : "Finish the flagged items to be guest-ready."}
                    </div>
                  </div>
                </div>
                <div className="grid gap-1 p-4 sm:grid-cols-2">
                  {readiness.items.map((it) => (
                    <button
                      key={it.label}
                      type="button"
                      onClick={() => setActive(it.tab)}
                      className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[12.5px] transition hover:bg-brand-light"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          it.done
                            ? "bg-brand-primary text-white"
                            : "bg-brand-light text-brand-mute"
                        }`}
                      >
                        {it.done ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-brand-mute" />
                        )}
                      </span>
                      <span
                        className={`flex-1 ${it.done ? "text-brand-ink" : "text-brand-mute"}`}
                      >
                        {it.label}
                      </span>
                      {!it.done ? (
                        <Pencil className="h-3 w-3 text-brand-mute" />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>

              {/* summary */}
              <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
                <SummaryRow
                  label="Name"
                  value={listing.name || "Not set"}
                  muted={!listing.name}
                  onEdit={() => setActive("basic")}
                />
                <SummaryRow
                  label="Type"
                  value={typeLabel}
                  onEdit={() => setActive("basic")}
                />
                <SummaryRow
                  label="Location"
                  value={locationLabel || "Not set"}
                  muted={!locationLabel}
                  onEdit={() => setActive("location")}
                />
                <SummaryRow
                  label="Photos"
                  value={`${photos.length} photo${photos.length === 1 ? "" : "s"}`}
                  muted={photos.length === 0}
                  onEdit={() => setActive("photos")}
                />
                <SummaryRow
                  label="Rooms"
                  value={
                    rooms.length > 0
                      ? `${rooms.length} room${rooms.length === 1 ? "" : "s"}`
                      : listing.max_guests
                        ? `Whole place · sleeps ${listing.max_guests}`
                        : "Not set"
                  }
                  muted={rooms.length === 0 && !listing.max_guests}
                  onEdit={() => setActive("rooms")}
                />
                <SummaryRow
                  label="From price"
                  value={
                    fromPrice != null
                      ? `${formatMoney(fromPrice, listing.currency)} / night`
                      : "Not set"
                  }
                  muted={fromPrice == null}
                  onEdit={() => setActive("pricing")}
                />
                <SummaryRow
                  label="Policies"
                  value={
                    assignedPolicies.length > 0
                      ? `${assignedPolicies.length} assigned`
                      : "None yet"
                  }
                  muted={assignedPolicies.length === 0}
                  onEdit={() => setActive("policies")}
                  last
                />
              </div>

              {/* publish CTA */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-line bg-brand-light/40 px-5 py-4">
                <div className="min-w-0">
                  <div className="font-display text-[14px] font-bold text-brand-ink">
                    {isPublished
                      ? "This listing is live"
                      : readiness.allDone
                        ? "Ready to go live"
                        : "Not published yet"}
                  </div>
                  <div className="text-[12px] text-brand-mute">
                    {isPublished
                      ? "Guests can find and book it."
                      : readiness.allDone
                        ? "Publish it to the Wielo directory and your website."
                        : "Finish the checklist above, then publish."}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isPublished && listing.slug ? (
                    <Link
                      href={`/property/${listing.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
                    >
                      <Eye className="h-4 w-4 text-brand-mute" /> Preview
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={togglePublish}
                    disabled={publishPending}
                    className={`inline-flex items-center gap-1.5 rounded-pill px-5 py-2.5 text-[13px] font-semibold transition disabled:opacity-60 ${
                      isPublished
                        ? "border border-status-pending/30 bg-status-pending/10 text-status-pending hover:bg-status-pending/20"
                        : "bg-brand-primary text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] hover:bg-brand-secondary"
                    }`}
                  >
                    {publishPending
                      ? "Saving…"
                      : isPublished
                        ? "Unpublish"
                        : "Publish listing"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {active === "danger" ? (
            <DangerTab listingId={listing.id} listingName={listing.name} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const circumference = 2 * Math.PI * 15.5;
  const dash = (pct / 100) * circumference;
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="#E4EFE8"
          strokeWidth="3.4"
        />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="#10B981"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-[11.5px] font-bold tabular-nums text-brand-ink">
        {pct}%
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted,
  last,
  onEdit,
}: {
  label: string;
  value: string;
  muted?: boolean;
  last?: boolean;
  onEdit: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-5 py-3 ${
        last ? "" : "border-b border-[#EEF4F0]"
      }`}
    >
      <div className="w-24 shrink-0 text-[11.5px] font-semibold uppercase tracking-wide text-brand-mute">
        {label}
      </div>
      <div
        className={`min-w-0 flex-1 truncate text-[13px] ${
          muted ? "italic text-brand-mute" : "font-medium text-brand-ink"
        }`}
      >
        {value}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-brand-line bg-white px-2.5 py-1 text-[11px] font-medium text-brand-mute transition hover:border-brand-primary/40 hover:text-brand-ink"
      >
        <Pencil className="h-3 w-3" /> Edit
      </button>
    </div>
  );
}
