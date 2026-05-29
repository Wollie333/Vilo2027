"use client";

import { Camera, FileText, MapPin, Sparkles } from "lucide-react";

import { AmenitiesPicker } from "@/components/listing/AmenitiesPicker";
import { ListingBasicsForm } from "@/components/listing/ListingBasicsForm";
import { ListingLocationForm } from "@/components/listing/ListingLocationForm";
import { PhotosManager } from "@/components/listing/PhotosManager";
import type { CategoryPickerLeaf } from "@/lib/taxonomy/CategoryPicker";
import type { AmenityGroupWithItems } from "@/lib/taxonomy/types";

import type { Listing, Photo } from "../types";

type Props = {
  listing: Listing;
  photos: Photo[];
  categoryLeaves: CategoryPickerLeaf[];
  amenityGroups: AmenityGroupWithItems[];
  amenities: { id: string; key: string; roomId: string | null }[];
  onListingChanged: (patch: Partial<Listing>) => void;
  onPhotosChanged: (photos: Photo[]) => void;
  onContinue: () => void;
};

// Listing details card — basics (name · category · about), location, photos and
// amenities. Pricing and capacity are NOT here: rooms own those (Rooms card).
export function StepListing({
  listing,
  photos,
  categoryLeaves,
  amenityGroups,
  amenities,
  onListingChanged,
  onPhotosChanged,
  onContinue,
}: Props) {
  return (
    <div className="space-y-8">
      {/* Basics — name · category · about (shared with the listing editor) */}
      <section>
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-brand-ink">
              The basics
            </h3>
            <p className="text-xs text-brand-mute">
              Name, category and the description guests read first. The category
              powers search and discovery.
            </p>
          </div>
        </div>
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
          onSaved={(patch) =>
            onListingChanged({
              name: patch.name,
              category_id: patch.category_id,
              description: patch.description,
            })
          }
        />
      </section>

      {/* Location — address + pin (shared with the editor's Location tab) */}
      <section>
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-brand-ink">
              Location
            </h3>
            <p className="text-xs text-brand-mute">
              Where guests will find you. Used for maps, search and local SEO.
            </p>
          </div>
        </div>
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
          onSaved={(patch) => onListingChanged(patch)}
        />
      </section>

      {/* Photos — shared PhotosManager (same as the listing editor) */}
      <section>
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
            <Camera className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-brand-ink">
              Photos
            </h3>
            <p className="text-xs text-brand-mute">
              Add at least 3 — listings with 5+ get 2× more bookings.
            </p>
          </div>
        </div>
        <PhotosManager
          listingId={listing.id}
          photos={photos}
          onChange={(next) =>
            onPhotosChanged(next.map((p) => ({ id: p.id, url: p.url })))
          }
        />
      </section>

      {/* Amenities — listing-wide (shared with the editor's Amenities tab) */}
      <section>
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-brand-ink">
              Amenities
            </h3>
            <p className="text-xs text-brand-mute">
              What the whole place offers. Per-room extras are set inside each
              room.
            </p>
          </div>
        </div>
        <AmenitiesPicker
          listingId={listing.id}
          groups={amenityGroups}
          initial={amenities}
        />
      </section>

      {/* Continue */}
      <div className="flex justify-end border-t border-brand-line pt-5">
        <button
          type="button"
          onClick={onContinue}
          disabled={photos.length === 0}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
