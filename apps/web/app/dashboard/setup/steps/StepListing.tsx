"use client";

import { Camera, FileText, MapPin, Sparkles } from "lucide-react";
import { useState } from "react";

import { AmenitiesPicker } from "@/components/listing/AmenitiesPicker";
import { ListingBasicsForm } from "@/components/listing/ListingBasicsForm";
import { ListingLocationForm } from "@/components/listing/ListingLocationForm";
import { PhotosManager } from "@/components/listing/PhotosManager";
import type { CategoryPickerLeaf } from "@/lib/taxonomy/CategoryPicker";
import type { AmenityGroupWithItems } from "@/lib/taxonomy/types";

import { SavedCard } from "../_atoms";
import type { Listing, Photo } from "../types";

type Props = {
  listing: Listing;
  photos: Photo[];
  categoryLeaves: CategoryPickerLeaf[];
  amenityGroups: AmenityGroupWithItems[];
  amenities: { id: string; key: string; roomId: string | null }[];
  onListingChanged: (patch: Partial<Listing>) => void;
  onPhotosChanged: (photos: Photo[]) => void;
  onAmenitiesChanged: (
    amenities: { id: string; key: string; roomId: string | null }[],
  ) => void;
  onContinue: () => void;
};

function plainText(html: string | null): string {
  return (html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function SectionHead({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
        {icon}
      </div>
      <div>
        <h3 className="font-display text-base font-semibold text-brand-ink">
          {title}
        </h3>
        <p className="text-xs text-brand-mute">{desc}</p>
      </div>
    </div>
  );
}

// Listing details card — basics (name · category · about), location, photos and
// amenities. Each form sub-section collapses to a summary card with Edit once
// saved; pricing/capacity live in the Rooms card.
export function StepListing({
  listing,
  photos,
  categoryLeaves,
  amenityGroups,
  amenities,
  onListingChanged,
  onPhotosChanged,
  onAmenitiesChanged,
  onContinue,
}: Props) {
  // Sub-sections start collapsed when they already hold saved data.
  const [editBasics, setEditBasics] = useState(!listing.name);
  const [editLocation, setEditLocation] = useState(!listing.address_line1);
  const [editAmenities, setEditAmenities] = useState(amenities.length === 0);
  const amenityCount = amenities.length;

  const categoryLabel =
    categoryLeaves.find((l) => l.id === listing.category_id)?.label ?? null;
  const aboutPlain = plainText(listing.description);

  return (
    <div className="space-y-8">
      {/* Basics — name · category · about */}
      {editBasics ? (
        <section>
          <SectionHead
            icon={<FileText className="h-4 w-4" />}
            title="The basics"
            desc="Name, category and the description guests read first. The category powers search and discovery."
          />
          <ListingBasicsForm
            listing={{
              id: listing.id,
              listing_type: listing.listing_type,
              name: listing.name,
              category_id: listing.category_id,
              accommodation_type: listing.accommodation_type,
              experience_type: listing.experience_type,
              description: listing.description ?? "",
            }}
            categoryLeaves={categoryLeaves}
            submitLabel="Save basics"
            onSaved={(patch) => {
              onListingChanged({
                name: patch.name,
                category_id: patch.category_id,
                description: patch.description,
              });
              setEditBasics(false);
            }}
          />
        </section>
      ) : (
        <SavedCard
          icon={<FileText className="h-4 w-4" />}
          title="The basics"
          rows={[
            { label: "Name", value: listing.name },
            { label: "Category", value: categoryLabel },
            {
              label: "About",
              value: aboutPlain
                ? aboutPlain.length > 70
                  ? `${aboutPlain.slice(0, 70)}…`
                  : aboutPlain
                : null,
            },
          ]}
          onEdit={() => setEditBasics(true)}
        />
      )}

      {/* Location — address + pin */}
      {editLocation ? (
        <section>
          <SectionHead
            icon={<MapPin className="h-4 w-4" />}
            title="Location"
            desc="Where guests will find you. Used for maps, search and local SEO."
          />
          <ListingLocationForm
            listing={{
              id: listing.id,
              address_line1: listing.address_line1,
              address_line2: listing.address_line2,
              city: listing.city,
              province: listing.province,
              postal_code: listing.postal_code,
              latitude: listing.latitude,
              longitude: listing.longitude,
            }}
            submitLabel="Save location"
            onSaved={(patch) => {
              onListingChanged(patch);
              setEditLocation(false);
            }}
          />
        </section>
      ) : (
        <SavedCard
          icon={<MapPin className="h-4 w-4" />}
          title="Location"
          rows={[
            { label: "Address", value: listing.address_line1 },
            { label: "City", value: listing.city },
            { label: "Province", value: listing.province },
          ]}
          onEdit={() => setEditLocation(true)}
        />
      )}

      {/* Photos — always the grid (uploads/reorder save immediately) */}
      <section>
        <SectionHead
          icon={<Camera className="h-4 w-4" />}
          title="Photos"
          desc="Add at least 3 — listings with 5+ get 2× more bookings."
        />
        <PhotosManager
          listingId={listing.id}
          photos={photos}
          onChange={(next) =>
            onPhotosChanged(next.map((p) => ({ id: p.id, url: p.url })))
          }
        />
      </section>

      {/* Amenities */}
      {editAmenities ? (
        <section>
          <SectionHead
            icon={<Sparkles className="h-4 w-4" />}
            title="Amenities"
            desc="What the whole place offers. Per-room extras are set inside each room."
          />
          <AmenitiesPicker
            listingId={listing.id}
            groups={amenityGroups}
            initial={amenities}
            onSaved={(saved) => {
              onAmenitiesChanged(saved);
              setEditAmenities(false);
            }}
          />
        </section>
      ) : (
        <SavedCard
          icon={<Sparkles className="h-4 w-4" />}
          title="Amenities"
          rows={[
            {
              label: "Selected",
              value: `${amenityCount} amenit${amenityCount === 1 ? "y" : "ies"}`,
            },
          ]}
          onEdit={() => setEditAmenities(true)}
        />
      )}

      {/* Save & continue */}
      <div className="flex items-center justify-between border-t border-brand-line pt-5">
        <span className="text-xs text-brand-mute">
          {photos.length === 0
            ? "Add at least one photo to continue."
            : "Looking good — next up, your rooms."}
        </span>
        <button
          type="button"
          onClick={onContinue}
          disabled={photos.length === 0}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary disabled:opacity-50"
        >
          Save &amp; continue
        </button>
      </div>
    </div>
  );
}
