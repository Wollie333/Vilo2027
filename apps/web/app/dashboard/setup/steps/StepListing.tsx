"use client";

import {
  Camera,
  DoorOpen,
  FileText,
  Pencil,
  Plus,
  Wallet,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { ListingBasicsForm } from "@/components/listing/ListingBasicsForm";

import {
  deleteListingPhotoAction,
  saveListingPatchAction,
  uploadListingPhotoAction,
} from "../../listings/[id]/edit/actions";
import type { Listing, Photo, Room } from "../types";
import { RoomEditorSheet } from "./RoomEditorSheet";

type Props = {
  listing: Listing;
  photos: Photo[];
  rooms: Room[];
  onListingChanged: (patch: Partial<Listing>) => void;
  onPhotoAdded: (photo: Photo) => void;
  onPhotoRemoved: (id: string) => void;
  onRoomSaved: (room: Room) => void;
  onContinue: () => void;
};

export function StepListing({
  listing,
  photos,
  rooms,
  onListingChanged,
  onPhotoAdded,
  onPhotoRemoved,
  onRoomSaved,
  onContinue,
}: Props) {
  const photoFileRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Pricing
  const [basePrice, setBasePrice] = useState(
    listing.base_price?.toString() ?? "",
  );
  const [weekendPrice, setWeekendPrice] = useState(
    listing.weekend_price?.toString() ?? "",
  );
  const [cleaningFee, setCleaningFee] = useState(
    listing.cleaning_fee?.toString() ?? "0",
  );
  const [maxGuests, setMaxGuests] = useState(
    listing.max_guests?.toString() ?? "2",
  );
  const [bedrooms, setBedrooms] = useState(listing.bedrooms?.toString() ?? "1");
  const [bathrooms, setBathrooms] = useState(
    listing.bathrooms?.toString() ?? "1",
  );

  // Room editor sheet — null roomId = add new, otherwise edit existing.
  const [roomSheetOpen, setRoomSheetOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);

  const [savePricing, startPricing] = useTransition();

  function openAddRoom() {
    setEditingRoomId(null);
    setRoomSheetOpen(true);
  }
  function openEditRoom(id: string) {
    setEditingRoomId(id);
    setRoomSheetOpen(true);
  }
  // Upsert the saved room into the wizard's list.
  function handleRoomSaved(room: Room) {
    onRoomSaved(room);
  }

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

  function onSavePricing() {
    const base = Number(basePrice);
    const weekend = weekendPrice ? Number(weekendPrice) : null;
    const cleaning = cleaningFee ? Number(cleaningFee) : 0;
    const guests = Number(maxGuests);
    const beds = Number(bedrooms);
    const baths = Number(bathrooms);

    if (!Number.isFinite(base) || base <= 0) {
      toast.error("Enter a valid base price.");
      return;
    }
    if (!Number.isInteger(guests) || guests < 1) {
      toast.error("Max guests must be at least 1.");
      return;
    }
    startPricing(async () => {
      const result = await saveListingPatchAction(listing.id, {
        base_price: base,
        weekend_price: weekend,
        cleaning_fee: cleaning,
        max_guests: guests,
        bedrooms: beds,
        bathrooms: baths,
        currency: "ZAR",
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onListingChanged({
        base_price: base,
        weekend_price: weekend,
        cleaning_fee: cleaning,
        max_guests: guests,
        bedrooms: beds,
        bathrooms: baths,
      });
      toast.success("Pricing saved.");
    });
  }

  const isExperience = listing.listing_type === "experience";

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

      {/* Pricing + capacity */}
      <section>
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-brand-ink">
              Pricing &amp; capacity
            </h3>
            <p className="text-xs text-brand-mute">
              Set your nightly rate, weekend uplift and cleaning fee. You can
              tweak these any time from the listing editor.
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded border border-brand-line bg-white p-4 sm:grid-cols-3">
          <Field label="Base price · per night" hint="In ZAR.">
            <CurrencyInput value={basePrice} onChange={setBasePrice} />
          </Field>
          <Field label="Weekend price" hint="Optional. Fri/Sat uplift.">
            <CurrencyInput value={weekendPrice} onChange={setWeekendPrice} />
          </Field>
          <Field label="Cleaning fee" hint="One-time, per booking.">
            <CurrencyInput value={cleaningFee} onChange={setCleaningFee} />
          </Field>
          {!isExperience ? (
            <>
              <Field label="Max guests">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxGuests}
                  onChange={(e) => setMaxGuests(e.target.value)}
                  className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
                />
              </Field>
              <Field label="Bedrooms">
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
                />
              </Field>
              <Field label="Bathrooms">
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-primary"
                />
              </Field>
            </>
          ) : null}
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onSavePricing}
            disabled={savePricing}
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent disabled:opacity-60"
          >
            {savePricing ? "Saving…" : "Save pricing"}
          </button>
        </div>
      </section>

      {/* Rooms — only for accommodation */}
      {!isExperience ? (
        <section>
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
              <DoorOpen className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-brand-ink">
                Rooms{" "}
                <span className="text-xs font-medium text-brand-mute">
                  (optional)
                </span>
              </h3>
              <p className="text-xs text-brand-mute">
                Skip this if you rent the whole place. Add rooms only if guests
                book a single room at a time (guesthouse / B&amp;B).
              </p>
            </div>
          </div>

          {rooms.length > 0 ? (
            <ul className="mb-3 space-y-2">
              {rooms.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-card border border-brand-line bg-white px-4 py-3 shadow-card"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
                    <DoorOpen className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-brand-ink">
                        {r.name}
                      </span>
                      {!r.is_active ? (
                        <span className="rounded-pill bg-status-draft/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-brand-mute">
                          Hidden
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-brand-mute">
                      {r.max_guests ?? "—"} guests · {r.bedrooms ?? 1} bed ·{" "}
                      {r.bathrooms ?? 0} bath
                    </div>
                  </div>
                  <div className="num text-right font-display text-sm font-bold text-brand-ink">
                    R{" "}
                    {(r.base_price ?? 0)
                      .toLocaleString("en-ZA")
                      .replace(/,/g, " ")}
                    <span className="text-[10px] font-normal text-brand-mute">
                      /night
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditRoom(r.id)}
                    className="inline-flex items-center gap-1 rounded border border-brand-line bg-white px-2.5 py-1.5 text-xs font-medium text-brand-ink transition hover:bg-brand-accent"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <button
            type="button"
            onClick={openAddRoom}
            className="inline-flex items-center gap-1.5 rounded border border-dashed border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Add a room
          </button>

          <RoomEditorSheet
            listingId={listing.id}
            open={roomSheetOpen}
            onOpenChange={setRoomSheetOpen}
            roomId={editingRoomId}
            onSaved={handleRoomSaved}
          />
        </section>
      ) : null}

      {/* Continue */}
      <div className="flex justify-end border-t border-brand-line pt-5">
        <button
          type="button"
          onClick={onContinue}
          disabled={photos.length === 0 || !listing.base_price}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function CurrencyInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-stretch overflow-hidden rounded border border-brand-line bg-white focus-within:border-brand-primary">
      <span className="flex items-center bg-brand-light px-3 font-mono text-sm text-brand-mute">
        R
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder="0"
        className="num flex-1 bg-white px-3 py-2 text-sm outline-none"
      />
    </div>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <div className="mb-1 font-display text-[12.5px] font-semibold text-brand-ink">
        {label}
      </div>
      {hint ? (
        <div className="mb-1.5 text-[10.5px] text-brand-mute">{hint}</div>
      ) : null}
      {children}
    </label>
  );
}
