"use client";

import {
  BedDouble,
  Image as ImageIcon,
  Info,
  Minus,
  Plus,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

import {
  createListingPhotoUploadUrl,
  deleteListingPhotoAction,
  deleteRoomAction,
  registerListingPhotoAction,
  setRoomAmenityAction,
  setRoomBedsAction,
  setRoomFeaturedPhotoAction,
  updateRoomAction,
} from "../actions";
import type { EditorRoom } from "../Editor";
import { VIEW_TYPES, EXPERIENCES } from "../roomEnums";
import {
  AMENITY_OPTIONS,
  BED_KINDS,
  type BedKind,
  type BedInput,
} from "../schemas";

function toInt(v: string): number | null {
  if (v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
function toNum(v: string): number | null {
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function numToStr(n: number | null | undefined, fallback = ""): string {
  return n == null ? fallback : String(n);
}

type PhotoCard = { id: string; url: string };

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
  const [tab, setTab] = useState<"details" | "beds" | "amenities" | "photos">(
    "details",
  );

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
            <Settings2 className="h-3.5 w-3.5" /> Details
          </TabsTrigger>
          <TabsTrigger
            value="beds"
            className="gap-1.5 rounded px-3 py-1.5 text-xs font-medium"
          >
            <BedDouble className="h-3.5 w-3.5" /> Beds &amp; view
          </TabsTrigger>
          <TabsTrigger
            value="amenities"
            className="gap-1.5 rounded px-3 py-1.5 text-xs font-medium"
          >
            <Sparkles className="h-3.5 w-3.5" /> Amenities &amp; policies
          </TabsTrigger>
          <TabsTrigger
            value="photos"
            className="gap-1.5 rounded px-3 py-1.5 text-xs font-medium"
          >
            <ImageIcon className="h-3.5 w-3.5" /> Photos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="p-4">
          <DetailsTab
            listingId={listingId}
            room={room}
            onUpdated={onUpdated}
            onDeleted={onDeleted}
          />
        </TabsContent>

        <TabsContent value="beds" className="p-4">
          <BedsViewTab
            listingId={listingId}
            room={room}
            onUpdated={onUpdated}
          />
        </TabsContent>

        <TabsContent value="amenities" className="p-4">
          <AmenitiesPoliciesTab
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

// ─── Details tab ──────────────────────────────────────────────────

function DetailsTab({
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
  const [savePending, startSave] = useTransition();
  const [deletePending, startDelete] = useTransition();

  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description ?? "");
  const [bedrooms, setBedrooms] = useState(numToStr(room.bedrooms, "1"));
  const [bathrooms, setBathrooms] = useState(numToStr(room.bathrooms, "0"));
  const [maxGuests, setMaxGuests] = useState(numToStr(room.max_guests, "2"));
  const [roomSize, setRoomSize] = useState(numToStr(room.room_size_sqm));
  const [floorNumber, setFloorNumber] = useState(numToStr(room.floor_number));
  const [inventoryCount, setInventoryCount] = useState(
    numToStr(room.inventory_count, "1"),
  );
  const [basePrice, setBasePrice] = useState(numToStr(room.base_price, "0"));
  const [weekendPrice, setWeekendPrice] = useState(
    numToStr(room.weekend_price),
  );
  const [cleaningFee, setCleaningFee] = useState(
    numToStr(room.cleaning_fee, "0"),
  );
  const [isActive, setIsActive] = useState(room.is_active);

  function save() {
    startSave(async () => {
      const result = await updateRoomAction(listingId, room.id, {
        name: name.trim(),
        description: description.trim().length > 0 ? description.trim() : null,
        bedrooms: toInt(bedrooms),
        bathrooms: toInt(bathrooms),
        max_guests: toInt(maxGuests) ?? room.max_guests,
        base_price: toNum(basePrice) ?? room.base_price,
        weekend_price: toNum(weekendPrice),
        cleaning_fee: toNum(cleaningFee) ?? 0,
        is_active: isActive,
        room_size_sqm: toNum(roomSize),
        floor_number: toInt(floorNumber),
        inventory_count: toInt(inventoryCount) ?? 1,
      });
      if (result.ok) {
        onUpdated({
          ...room,
          name: name.trim(),
          description: description.trim().length > 0 ? description : null,
          bedrooms: toInt(bedrooms),
          bathrooms: toInt(bathrooms),
          max_guests: toInt(maxGuests) ?? room.max_guests,
          base_price: toNum(basePrice) ?? room.base_price,
          weekend_price: toNum(weekendPrice),
          cleaning_fee: toNum(cleaningFee) ?? 0,
          is_active: isActive,
          room_size_sqm: toNum(roomSize),
          floor_number: toInt(floorNumber),
          inventory_count: toInt(inventoryCount) ?? 1,
        });
        toast.success("Room saved");
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove() {
    if (
      !window.confirm(
        `Delete room "${room.name}"? It can't have any active bookings.`,
      )
    ) {
      return;
    }
    startDelete(async () => {
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
    <div className="space-y-4">
      <Field label="Room name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={savePending}
        />
      </Field>

      <Field label="Description (optional)">
        <Textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={savePending}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Bedrooms">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={bedrooms}
            onChange={(e) => setBedrooms(e.target.value)}
            disabled={savePending}
          />
        </Field>
        <Field label="Bathrooms">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={bathrooms}
            onChange={(e) => setBathrooms(e.target.value)}
            disabled={savePending}
          />
        </Field>
        <Field label="Max guests">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={maxGuests}
            onChange={(e) => setMaxGuests(e.target.value)}
            disabled={savePending}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Room size (m²)">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            value={roomSize}
            onChange={(e) => setRoomSize(e.target.value)}
            disabled={savePending}
            placeholder="24"
          />
        </Field>
        <Field label="Floor (optional)">
          <Input
            type="number"
            inputMode="numeric"
            value={floorNumber}
            onChange={(e) => setFloorNumber(e.target.value)}
            disabled={savePending}
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
            disabled={savePending}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Base price / night">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            disabled={savePending}
          />
        </Field>
        <Field label="Weekend price (optional)">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={weekendPrice}
            onChange={(e) => setWeekendPrice(e.target.value)}
            disabled={savePending}
          />
        </Field>
        <Field label="Cleaning fee">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={cleaningFee}
            onChange={(e) => setCleaningFee(e.target.value)}
            disabled={savePending}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-brand-dark">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          disabled={savePending}
          className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
        />
        Bookable
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={remove}
          disabled={deletePending || savePending}
          className="gap-1.5 text-status-cancelled hover:bg-red-50 hover:text-status-cancelled"
        >
          <Trash2 className="h-4 w-4" />
          {deletePending ? "Deleting…" : "Delete room"}
        </Button>
        <Button
          type="button"
          onClick={save}
          disabled={savePending}
          className="gap-1.5"
        >
          <Save className="h-4 w-4" />
          {savePending ? "Saving…" : "Save details"}
        </Button>
      </div>
    </div>
  );
}

// ─── Beds & view tab ──────────────────────────────────────────────

function BedsViewTab({
  listingId,
  room,
  onUpdated,
}: {
  listingId: string;
  room: EditorRoom;
  onUpdated: (room: EditorRoom) => void;
}) {
  const [pending, start] = useTransition();
  const [beds, setBeds] = useState<BedInput[]>(
    () =>
      room.beds.map((b) => ({
        bed_kind: b.bed_kind as BedKind,
        quantity: b.quantity,
      })) ?? [],
  );
  const [viewType, setViewType] = useState<string>(room.view_type ?? "");
  const [experiences, setExperiences] = useState<string[]>(
    room.experiences ?? [],
  );

  function addBed() {
    setBeds([...beds, { bed_kind: "queen", quantity: 1 }]);
  }
  function removeBed(idx: number) {
    setBeds(beds.filter((_, i) => i !== idx));
  }
  function updateBed(idx: number, patch: Partial<BedInput>) {
    setBeds(beds.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }
  function toggleExperience(label: string) {
    setExperiences((prev) =>
      prev.includes(label) ? prev.filter((p) => p !== label) : [...prev, label],
    );
  }

  function save() {
    start(async () => {
      const [bedsResult, detailsResult] = await Promise.all([
        setRoomBedsAction(listingId, room.id, beds),
        updateRoomAction(listingId, room.id, {
          view_type: viewType.length > 0 ? viewType : null,
          experiences,
        }),
      ]);
      if (bedsResult.ok && detailsResult.ok) {
        onUpdated({
          ...room,
          beds: beds.map((b) => ({
            bed_kind: b.bed_kind,
            quantity: b.quantity,
          })),
          view_type: viewType.length > 0 ? viewType : null,
          experiences,
        });
        toast.success("Beds & view saved");
      } else {
        toast.error(
          (!bedsResult.ok && bedsResult.error) ||
            (!detailsResult.ok && detailsResult.error) ||
            "Couldn't save.",
        );
      }
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Beds in this room
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addBed}
            disabled={pending}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add a bed
          </Button>
        </div>
        <div className="mt-2 space-y-2">
          {beds.length === 0 ? (
            <div className="rounded border border-dashed border-brand-line bg-brand-light/40 px-3 py-4 text-center text-xs text-brand-mute">
              No beds yet. Add what&rsquo;s in this room — e.g. 1 King + 2
              Singles + 1 Sofa bed.
            </div>
          ) : (
            beds.map((b, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded border border-brand-line bg-white px-3 py-2"
              >
                <select
                  value={b.bed_kind}
                  onChange={(e) =>
                    updateBed(i, { bed_kind: e.target.value as BedKind })
                  }
                  disabled={pending}
                  className="h-8 rounded border border-brand-line bg-white px-2 text-sm"
                >
                  {BED_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      updateBed(i, { quantity: Math.max(1, b.quantity - 1) })
                    }
                    disabled={pending || b.quantity <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded border border-brand-line text-brand-ink hover:bg-brand-accent disabled:opacity-40"
                    aria-label="Decrease"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <div className="w-8 text-center font-display font-semibold text-brand-ink">
                    {b.quantity}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateBed(i, { quantity: Math.min(20, b.quantity + 1) })
                    }
                    disabled={pending || b.quantity >= 20}
                    className="flex h-8 w-8 items-center justify-center rounded border border-brand-line text-brand-ink hover:bg-brand-accent disabled:opacity-40"
                    aria-label="Increase"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeBed(i)}
                  disabled={pending}
                  className="ml-2 flex h-8 w-8 items-center justify-center rounded text-brand-mute hover:bg-red-50 hover:text-status-cancelled"
                  aria-label="Remove bed"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
          View
        </label>
        <select
          value={viewType}
          onChange={(e) => setViewType(e.target.value)}
          disabled={pending}
          className="mt-1 h-10 w-full rounded border border-brand-line bg-white px-3 text-sm text-brand-dark"
        >
          <option value="">—</option>
          {VIEW_TYPES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
          Experiences{" "}
          <span className="font-normal normal-case">(pick all that apply)</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {EXPERIENCES.map((label) => {
            const active = experiences.includes(label);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleExperience(label)}
                disabled={pending}
                className={`rounded-pill border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-brand-line bg-white text-brand-dark hover:bg-brand-light/60"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          type="button"
          onClick={save}
          disabled={pending}
          className="gap-1.5"
        >
          <Save className="h-4 w-4" />
          {pending ? "Saving…" : "Save beds & view"}
        </Button>
      </div>
    </div>
  );
}

// ─── Amenities & policies tab ─────────────────────────────────────

function AmenitiesPoliciesTab({
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
  const [flagsPending, startFlags] = useTransition();
  const [amenityPending, startAmenity] = useTransition();

  function saveFlags() {
    startFlags(async () => {
      const result = await updateRoomAction(listingId, room.id, {
        has_ensuite_bathroom: hasEnsuite,
        smoking_allowed: smokingAllowed,
        pets_allowed: petsAllowed,
        wheelchair_accessible: wheelchairAccessible,
        private_entrance: privateEntrance,
      });
      if (result.ok) {
        onUpdated({
          ...room,
          has_ensuite_bathroom: hasEnsuite,
          smoking_allowed: smokingAllowed,
          pets_allowed: petsAllowed,
          wheelchair_accessible: wheelchairAccessible,
          private_entrance: privateEntrance,
        });
        toast.success("Policies saved");
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

  const flagsDirty =
    hasEnsuite !== room.has_ensuite_bathroom ||
    smokingAllowed !== room.smoking_allowed ||
    petsAllowed !== room.pets_allowed ||
    wheelchairAccessible !== room.wheelchair_accessible ||
    privateEntrance !== room.private_entrance;

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
        {flagsDirty ? (
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              onClick={saveFlags}
              disabled={flagsPending}
              size="sm"
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {flagsPending ? "Saving…" : "Save policies"}
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

  function remove(photoId: string) {
    if (!window.confirm("Delete this photo?")) return;
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
