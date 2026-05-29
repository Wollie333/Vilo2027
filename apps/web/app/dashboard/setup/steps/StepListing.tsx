"use client";

import { Camera, FileText, Plus, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AmenitiesPicker } from "@/components/listing/AmenitiesPicker";
import { ListingBasicsForm } from "@/components/listing/ListingBasicsForm";
import type { AmenityGroupWithItems } from "@/lib/taxonomy/types";

import {
  deleteListingPhotoAction,
  uploadListingPhotoAction,
} from "../../listings/[id]/edit/actions";
import type { Listing, Photo } from "../types";

type Props = {
  listing: Listing;
  photos: Photo[];
  amenityGroups: AmenityGroupWithItems[];
  amenities: { id: string; key: string; roomId: string | null }[];
  onListingChanged: (patch: Partial<Listing>) => void;
  onPhotoAdded: (photo: Photo) => void;
  onPhotoRemoved: (id: string) => void;
  onContinue: () => void;
};

// Listing details card — the basics (name + about) and photos. Pricing and
// capacity are NOT here: rooms own those (see the Rooms card).
export function StepListing({
  listing,
  photos,
  amenityGroups,
  amenities,
  onListingChanged,
  onPhotoAdded,
  onPhotoRemoved,
  onContinue,
}: Props) {
  const photoFileRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  async function onPhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadListingPhotoAction(listing.id, fd);
    setUploadingPhoto(false);
    if (e.target) e.target.value = "";
    if (!result.ok || !result.data) {
      toast.error(result.ok ? "Upload failed." : result.error);
      return;
    }
    onPhotoAdded({ id: result.data.id, url: result.data.url });
    toast.success("Photo added.");
  }

  async function onRemovePhoto(photoId: string) {
    const result = await deleteListingPhotoAction(listing.id, photoId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onPhotoRemoved(photoId);
  }

  return (
    <div className="space-y-8">
      {/* Basics — name + about (shared with the listing editor) */}
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
              Your listing name and the description guests read first.
            </p>
          </div>
        </div>
        <ListingBasicsForm
          listing={{
            id: listing.id,
            listing_type: listing.listing_type,
            name: listing.name,
            category_id: null,
            accommodation_type: listing.accommodation_type,
            experience_type: listing.experience_type,
            description: listing.description ?? "",
          }}
          submitLabel="Save basics"
          onSaved={(patch) =>
            onListingChanged({
              name: patch.name,
              description: patch.description,
            })
          }
        />
      </section>

      {/* Photos */}
      <section>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
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
          <button
            type="button"
            onClick={() => photoFileRef.current?.click()}
            disabled={uploadingPhoto}
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            {uploadingPhoto ? "Uploading…" : "Add photo"}
          </button>
          <input
            ref={photoFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onPhotoPick}
          />
        </div>

        {photos.length === 0 ? (
          <button
            type="button"
            onClick={() => photoFileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-brand-line bg-brand-light/40 p-10 transition hover:border-brand-primary/60 hover:bg-brand-accent/40"
          >
            <Camera className="h-8 w-8 text-brand-mute" />
            <div className="font-display text-sm font-semibold text-brand-ink">
              Upload your first photo
            </div>
            <div className="text-xs text-brand-mute">
              JPEG, PNG, or WebP · max 8 MB each
            </div>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((p, i) => (
              <div
                key={p.id}
                className="group relative aspect-[4/3] overflow-hidden rounded border border-brand-line bg-brand-light"
              >
                <Image
                  src={p.url}
                  alt={`Photo ${i + 1}`}
                  fill
                  unoptimized
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemovePhoto(p.id)}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-pill bg-white/95 text-brand-ink opacity-0 shadow-card transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                  aria-label="Remove photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {i === 0 ? (
                  <span className="absolute left-2 top-2 rounded-pill bg-brand-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Cover
                  </span>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              onClick={() => photoFileRef.current?.click()}
              className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-brand-line bg-brand-light/40 text-xs font-medium text-brand-mute transition hover:border-brand-primary/60 hover:text-brand-ink"
            >
              <Plus className="h-5 w-5" strokeWidth={2} />
              Add more
            </button>
          </div>
        )}
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
