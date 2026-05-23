"use client";

import {
  CalendarClock,
  Camera,
  Globe,
  Home,
  Image as ImageIcon,
  ListChecks,
  MapPin,
  Receipt,
  Settings as SettingsIcon,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { togglePublishAction } from "./actions";
import { AmenitiesTab } from "./tabs/AmenitiesTab";
import { BasicTab } from "./tabs/BasicTab";
import { LocationTab } from "./tabs/LocationTab";
import { PhotosTab } from "./tabs/PhotosTab";
import { PoliciesTab } from "./tabs/PoliciesTab";
import { PricingTab } from "./tabs/PricingTab";
import { RoomsTab } from "./tabs/RoomsTab";
import { SettingsTab } from "./tabs/SettingsTab";

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
};

export type EditorPhoto = { id: string; url: string };

type TabKey =
  | "basic"
  | "photos"
  | "location"
  | "rooms"
  | "amenities"
  | "pricing"
  | "policies"
  | "settings";

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "basic", label: "Basic info", icon: Home },
  { key: "photos", label: "Photos", icon: ImageIcon },
  { key: "location", label: "Location", icon: MapPin },
  { key: "rooms", label: "Rooms & capacity", icon: Camera },
  { key: "amenities", label: "Amenities", icon: ListChecks },
  { key: "pricing", label: "Pricing", icon: Receipt },
  { key: "policies", label: "Policies", icon: CalendarClock },
  { key: "settings", label: "Booking settings", icon: SettingsIcon },
];

export function Editor({
  listing,
  amenities,
  photos: initialPhotos,
}: {
  listing: EditorListing;
  amenities: string[];
  photos: EditorPhoto[];
}) {
  const [active, setActive] = useState<TabKey>("basic");
  const [isPublished, setIsPublished] = useState(listing.is_published);
  const [publishPending, startPublish] = useTransition();
  // Local photo state so adds/removes show immediately without page reload.
  const [photos, setPhotos] = useState<EditorPhoto[]>(initialPhotos);

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
    <div className="mx-auto max-w-5xl px-5 py-8 lg:px-8 lg:py-10">
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
              onChange={setPhotos}
            />
          ) : null}
          {active === "location" ? <LocationTab listing={listing} /> : null}
          {active === "rooms" ? <RoomsTab listing={listing} /> : null}
          {active === "amenities" ? (
            <AmenitiesTab listingId={listing.id} initial={amenities} />
          ) : null}
          {active === "pricing" ? <PricingTab listing={listing} /> : null}
          {active === "policies" ? <PoliciesTab listing={listing} /> : null}
          {active === "settings" ? <SettingsTab listing={listing} /> : null}
        </div>
      </div>

      <div className="mt-8 rounded border border-brand-line bg-white p-4 text-xs text-brand-mute">
        <Globe className="mr-1.5 inline-block h-3.5 w-3.5 align-text-bottom text-brand-mute" />
        Rich-text description (Tiptap) and a Mapbox location picker are deferred
        — the current editor uses plain text and address fields. Photos upload
        one at a time; drag-and-drop multi-upload lands next slice.
      </div>
    </div>
  );
}
