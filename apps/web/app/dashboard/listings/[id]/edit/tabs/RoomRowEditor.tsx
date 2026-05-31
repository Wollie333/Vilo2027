"use client";

import {
  Image as ImageIcon,
  Info,
  Save,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { modal } from "@/components/ui/modal-host";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";

import {
  createListingPhotoUploadUrl,
  deleteListingPhotoAction,
  deleteRoomAction,
  registerListingPhotoAction,
  setRoomAmenityAction,
  setRoomFeaturedPhotoAction,
  updateRoomAction,
} from "../actions";
import type { EditorRoom } from "../Editor";
import { RoomDetailsForm } from "../rooms/[roomId]/sections/RoomDetailsForm";
import type { RoomEditorRoom } from "../rooms/[roomId]/RoomEditor";
import { AMENITY_OPTIONS } from "../schemas";

function toInt(v: string): number | null {
  if (v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
function numToStr(n: number | null | undefined, fallback = ""): string {
  return n == null ? fallback : String(n);
}

type PhotoCard = { id: string; url: string };

/** Map the listing-editor room shape to the canonical form's shape. */
function toRoomEditorRoom(room: EditorRoom): RoomEditorRoom {
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    bedrooms: room.bedrooms,
    bathrooms: room.bathrooms,
    max_guests: room.max_guests,
    min_guests: room.min_guests ?? 1,
    min_nights: room.min_nights ?? 1,
    base_price: room.base_price,
    weekend_price: room.weekend_price,
    cleaning_fee: room.cleaning_fee,
    is_active: room.is_active,
    room_size_sqm: room.room_size_sqm,
    bed_type: room.bed_type,
    view_type: room.view_type,
    experiences: room.experiences,
    featured_photo_id: room.featured_photo_id,
    beds: room.beds,
    pricing_mode: room.pricing_mode,
    price_per_person: room.price_per_person,
    base_occupancy: room.base_occupancy,
    extra_guest_price: room.extra_guest_price,
  };
}

export function RoomRowEditor({
  listingId,
  room,
  onUpdated,
  onDeleted,
}: {
  listingId: string;
  room: EditorRoom;
  onUpdated: (room: EditorRoom) => void;
  onDeleted: () => void;
}) {
  const [tab, setTab] = useState<"details" | "amenities" | "photos">("details");

  return (
    <div className="border-t border-brand-line bg-brand-light/30">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
        className="w-full"
      >
        <TabsList className="mx-4 mt-4 inline-flex h-auto flex-wrap items-center gap-1 rounded bg-white p-1">
          <TabsTrigger
            value="details"
            className="gap-1.5 rounded px-3 py-1.5 text-xs font-medium"
          >
            <Settings2 className="h-3.5 w-3.5" /> Details, beds &amp; pricing
          </TabsTrigger>
          <TabsTrigger
            value="amenities"
            className="gap-1.5 rounded px-3 py-1.5 text-xs font-medium"
          >
            <Sparkles className="h-3.5 w-3.5" /> Amenities &amp; setup
          </TabsTrigger>
          <TabsTrigger
            value="photos"
            className="gap-1.5 rounded px-3 py-1.5 text-xs font-medium"
          >
            <ImageIcon className="h-3.5 w-3.5" /> Photos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 p-4">
          {/* The single canonical room form — same one the setup wizard and the
              standalone room page use. No duplicate details/beds logic here. */}
          <RoomDetailsForm
            listingId={listingId}
            room={toRoomEditorRoom(room)}
            onSaved={(patch) => onUpdated({ ...room, ...patch })}
          />
          <DeleteRow listingId={listingId} room={room} onDeleted={onDeleted} />
        </TabsContent>

        <TabsContent value="amenities" className="p-4">
          <AmenitiesSetupTab
            listingId={listingId}
            room={room}
            onUpdated={onUpdated}
          />
        </TabsContent>

        <TabsContent value="photos" className="p-4">
          <PhotosTab listingId={listingId} room={room} onUpdated={onUpdated} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Delete control (lives under the details form) ────────────────

function DeleteRow({
  listingId,
  room,
  onDeleted,
}: {
  listingId: string;
  room: EditorRoom;
  onDeleted: () => void;
}) {
  const [pending, start] = useTransition();

  async function remove() {
    const ok = await modal.destructive({
      title: `Delete room "${room.name}"?`,
      description: "It can't have any active bookings.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    start(async () => {
      const result = await deleteRoomAction(listingId, room.id);
      if (result.ok) {
        onDeleted();
        toast.success("Room deleted");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex justify-end">
      <Button
        type="button"
        variant="outline"
        onClick={remove}
        disabled={pending}
        className="gap-1.5 text-status-cancelled hover:bg-red-50 hover:text-status-cancelled"
      >
        <Trash2 className="h-4 w-4" />
        {pending ? "Deleting…" : "Delete room"}
      </Button>
    </div>
  );
}

// ─── Amenities, room policies & setup tab ─────────────────────────

function AmenitiesSetupTab({
  listingId,
  room,
  onUpdated,
}: {
  listingId: string;
  room: EditorRoom;
  onUpdated: (room: EditorRoom) => void;
}) {
  const [amenityKeys, setAmenityKeys] = useState<string[]>(
    room.amenityKeys ?? [],
  );
  const [hasEnsuite, setHasEnsuite] = useState(room.has_ensuite_bathroom);
  const [smokingAllowed, setSmokingAllowed] = useState(room.smoking_allowed);
  const [petsAllowed, setPetsAllowed] = useState(room.pets_allowed);
  const [wheelchairAccessible, setWheelchairAccessible] = useState(
    room.wheelchair_accessible,
  );
  const [privateEntrance, setPrivateEntrance] = useState(room.private_entrance);
  const [floorNumber, setFloorNumber] = useState(numToStr(room.floor_number));
  const [inventoryCount, setInventoryCount] = useState(
    numToStr(room.inventory_count, "1"),
  );
  const [flagsPending, startFlags] = useTransition();
  const [amenityPending, startAmenity] = useTransition();

  function saveSetup() {
    const floor = toInt(floorNumber);
    const inventory = toInt(inventoryCount) ?? 1;
    startFlags(async () => {
      const result = await updateRoomAction(listingId, room.id, {
        has_ensuite_bathroom: hasEnsuite,
        smoking_allowed: smokingAllowed,
        pets_allowed: petsAllowed,
        wheelchair_accessible: wheelchairAccessible,
        private_entrance: privateEntrance,
        floor_number: floor,
        inventory_count: inventory,
      });
      if (result.ok) {
        onUpdated({
          ...room,
          has_ensuite_bathroom: hasEnsuite,
          smoking_allowed: smokingAllowed,
          pets_allowed: petsAllowed,
          wheelchair_accessible: wheelchairAccessible,
          private_entrance: privateEntrance,
          floor_number: floor,
          inventory_count: inventory,
        });
        toast.success("Saved");
      } else {
        toast.error(result.error);
      }
    });
  }

  function toggleAmenity(key: string, on: boolean) {
    // Optimistic — flip locally, server reconciles. Revert on failure.
    const next = on
      ? Array.from(new Set([...amenityKeys, key]))
      : amenityKeys.filter((k) => k !== key);
    setAmenityKeys(next);
    onUpdated({ ...room, amenityKeys: next });
    startAmenity(async () => {
      const result = await setRoomAmenityAction(listingId, room.id, key, on);
      if (!result.ok) {
        setAmenityKeys(amenityKeys);
        onUpdated({ ...room, amenityKeys });
        toast.error(result.error);
      }
    });
  }

  const setupDirty =
    hasEnsuite !== room.has_ensuite_bathroom ||
    smokingAllowed !== room.smoking_allowed ||
    petsAllowed !== room.pets_allowed ||
    wheelchairAccessible !== room.wheelchair_accessible ||
    privateEntrance !== room.private_entrance ||
    (toInt(floorNumber) ?? null) !== (room.floor_number ?? null) ||
    (toInt(inventoryCount) ?? 1) !== room.inventory_count;

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
          <Info className="h-3 w-3" /> Policies for this room
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <PolicyToggle
            label="Ensuite bathroom"
            checked={hasEnsuite}
            onChange={setHasEnsuite}
            disabled={flagsPending}
          />
          <PolicyToggle
            label="Pets allowed"
            checked={petsAllowed}
            onChange={setPetsAllowed}
            disabled={flagsPending}
          />
          <PolicyToggle
            label="Wheelchair accessible"
            checked={wheelchairAccessible}
            onChange={setWheelchairAccessible}
            disabled={flagsPending}
          />
          <PolicyToggle
            label="Private entrance"
            checked={privateEntrance}
            onChange={setPrivateEntrance}
            disabled={flagsPending}
          />
          <PolicyToggle
            label="Smoking allowed"
            checked={smokingAllowed}
            onChange={setSmokingAllowed}
            disabled={flagsPending}
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Floor (optional)">
            <Input
              type="number"
              inputMode="numeric"
              value={floorNumber}
              onChange={(e) => setFloorNumber(e.target.value)}
              disabled={flagsPending}
              placeholder="1"
            />
          </Field>
          <Field
            label="Inventory"
            hint="How many identical units exist (hotel-style)."
          >
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={inventoryCount}
              onChange={(e) => setInventoryCount(e.target.value)}
              disabled={flagsPending}
            />
          </Field>
        </div>

        {setupDirty ? (
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              onClick={saveSetup}
              disabled={flagsPending}
              size="sm"
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {flagsPending ? "Saving…" : "Save setup"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="h-px bg-brand-line" />

      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
          Amenities in this room
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {AMENITY_OPTIONS.map((a) => {
            const checked = amenityKeys.includes(a.key);
            return (
              <label
                key={a.key}
                className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${
                  checked
                    ? "border-brand-primary bg-brand-accent/50 text-brand-dark"
                    : "border-brand-line bg-white text-brand-ink hover:bg-brand-light/60"
                }`}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => toggleAmenity(a.key, v === true)}
                  disabled={amenityPending}
                />
                {a.label}
              </label>
            );
          })}
        </div>
        <div className="mt-2 text-[11px] text-brand-mute">
          {amenityKeys.length} amenit
          {amenityKeys.length === 1 ? "y" : "ies"} selected · changes save
          automatically.
        </div>
      </div>
    </div>
  );
}

function PolicyToggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${
        checked
          ? "border-brand-primary bg-brand-accent/50 text-brand-dark"
          : "border-brand-line bg-white text-brand-ink hover:bg-brand-light/60"
      }`}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        disabled={disabled}
      />
      {label}
    </label>
  );
}

// ─── Photos tab ───────────────────────────────────────────────────

function PhotosTab({
  listingId,
  room,
  onUpdated,
}: {
  listingId: string;
  room: EditorRoom;
  onUpdated: (room: EditorRoom) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoCard[]>(room.photos ?? []);
  const [featuredId, setFeaturedId] = useState<string | null>(
    room.featuredPhotoId ?? null,
  );
  const [uploadPending, startUpload] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const supabase = useMemo(() => createClient(), []);

  function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    startUpload(async () => {
      try {
        const ticket = await createListingPhotoUploadUrl(
          listingId,
          ext,
          room.id,
        );
        if (!ticket.ok || !ticket.data) {
          toast.error(ticket.ok ? "Could not start upload" : ticket.error);
          return;
        }
        const { error: upErr } = await supabase.storage
          .from("listing-photos")
          .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
            contentType: file.type || "image/jpeg",
          });
        if (upErr) {
          toast.error(upErr.message || "Upload failed");
          return;
        }
        const result = await registerListingPhotoAction(
          listingId,
          ticket.data.path,
          room.id,
        );
        if (result.ok && result.data) {
          const next = [
            ...photos,
            { id: result.data.id, url: result.data.url },
          ];
          setPhotos(next);
          onUpdated({ ...room, photos: next });
          toast.success("Photo uploaded");
        } else if (!result.ok) {
          toast.error(result.error);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload error");
      }
    });
  }

  async function remove(photoId: string) {
    const ok = await modal.destructive({
      title: "Delete this photo?",
      description: "This permanently removes the photo.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    startDelete(async () => {
      const result = await deleteListingPhotoAction(listingId, photoId);
      if (result.ok) {
        const next = photos.filter((p) => p.id !== photoId);
        setPhotos(next);
        const nextFeatured = featuredId === photoId ? null : featuredId;
        setFeaturedId(nextFeatured);
        onUpdated({
          ...room,
          photos: next,
          featuredPhotoId: nextFeatured,
          featuredPhotoUrl:
            nextFeatured == null
              ? null
              : (next.find((p) => p.id === nextFeatured)?.url ?? null),
        });
        toast.success("Photo deleted");
      } else {
        toast.error(result.error);
      }
    });
  }

  function setFeatured(photoId: string | null) {
    setRoomFeaturedPhotoAction(listingId, room.id, photoId).then((result) => {
      if (result.ok) {
        setFeaturedId(photoId);
        onUpdated({
          ...room,
          featuredPhotoId: photoId,
          featuredPhotoUrl:
            photoId == null
              ? null
              : (photos.find((p) => p.id === photoId)?.url ?? null),
        });
        toast.success(photoId ? "Cover photo updated" : "Cover cleared");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p) => {
          const isFeatured = p.id === featuredId;
          return (
            <div
              key={p.id}
              className={`group relative overflow-hidden rounded-card border bg-brand-accent ${
                isFeatured
                  ? "border-brand-primary ring-2 ring-brand-primary/40"
                  : "border-brand-line"
              }`}
            >
              <div className="aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              {isFeatured ? (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-pill bg-brand-primary px-2 py-0.5 text-[10px] font-bold text-white">
                  <Star className="h-3 w-3 fill-white" /> Cover
                </span>
              ) : null}
              <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setFeatured(isFeatured ? null : p.id)}
                  className="inline-flex items-center gap-1 rounded-pill bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-brand-dark backdrop-blur hover:bg-white"
                >
                  <Star className="h-3 w-3" />
                  {isFeatured ? "Unset cover" : "Set cover"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  disabled={deletePending}
                  className="inline-flex items-center justify-center rounded-pill bg-white/90 p-1 text-status-cancelled backdrop-blur hover:bg-white"
                  aria-label="Delete photo"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploadPending}
          className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed border-brand-line bg-brand-light/40 text-xs font-medium text-brand-mute transition-colors hover:border-brand-primary hover:bg-brand-accent/40 hover:text-brand-primary disabled:opacity-50"
        >
          <Upload className="h-5 w-5" />
          {uploadPending ? "Uploading…" : "Add photo"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            upload(e.target.files);
            if (e.target) e.target.value = "";
          }}
        />
      </div>

      {photos.length === 0 ? (
        <p className="text-xs text-brand-mute">
          No photos yet. Upload one and click <strong>Set cover</strong> to use
          it as the room thumbnail.
        </p>
      ) : null}
    </div>
  );
}

// ─── Form helpers ─────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint ? (
        <div className="mt-1 text-[11px] text-brand-mute">{hint}</div>
      ) : null}
    </div>
  );
}
