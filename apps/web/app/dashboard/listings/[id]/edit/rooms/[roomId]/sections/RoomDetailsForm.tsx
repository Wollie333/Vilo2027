"use client";

import { Minus, Plus, Save, Trash2, Users } from "lucide-react";
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  createRoomAction,
  setRoomBedsAction,
  updateRoomAction,
} from "../../../actions";
import {
  BED_KINDS,
  bedKindLabel,
  defaultSleepsForKind,
  roomCapacityFromBeds,
  type BedInput,
  type BedKind,
} from "../../../roomBeds";
import { BED_TYPES, EXPERIENCES, VIEW_TYPES } from "../../../roomEnums";
import type { RoomEditorRoom, RoomPricingMode } from "../RoomEditor";

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

const PRICING_MODES: {
  value: RoomPricingMode;
  label: string;
  body: string;
}[] = [
  {
    value: "per_room",
    label: "Per room",
    body: "One flat nightly price, whoever stays.",
  },
  {
    value: "per_person",
    label: "Per person",
    body: "Charge a rate for each guest, per night.",
  },
  {
    value: "per_room_plus_extra",
    label: "Base + extra guest",
    body: "Flat base covers a few guests; charge extra beyond that.",
  },
];

/** Derive the "1 King + 2 Singles" summary string the legacy bed_type column holds. */
function bedSummaryString(beds: BedInput[]): string | null {
  if (beds.length === 0) return null;
  return beds
    .map((b) => `${b.quantity} ${bedKindLabel(b.bed_kind, b.quantity)}`)
    .join(" + ")
    .slice(0, 40);
}

export type RoomDetailsFormHandle = {
  /** Validate + persist the room; resolves true on success. */
  save: () => Promise<boolean>;
};

export const RoomDetailsForm = forwardRef<
  RoomDetailsFormHandle,
  {
    listingId: string;
    room: RoomEditorRoom;
    mode?: "create" | "edit";
    onSaved?: (patch: Partial<RoomEditorRoom>) => void;
    onCreated?: (id: string) => void;
  }
>(function RoomDetailsForm(
  { listingId, room, mode = "edit", onSaved, onCreated },
  ref,
) {
  const [pending, start] = useTransition();

  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description ?? "");
  const [bedrooms, setBedrooms] = useState(numToStr(room.bedrooms, "1"));
  const [bathrooms, setBathrooms] = useState(numToStr(room.bathrooms, "0"));
  const [roomSize, setRoomSize] = useState(numToStr(room.room_size_sqm));
  const [bedType, setBedType] = useState<string>(room.bed_type ?? "");
  const [viewType, setViewType] = useState<string>(room.view_type ?? "");
  const [experiences, setExperiences] = useState<string[]>(
    room.experiences ?? [],
  );
  // ── Per-room minimums ──
  const [minGuests, setMinGuests] = useState(numToStr(room.min_guests, "1"));
  const [minNights, setMinNights] = useState(numToStr(room.min_nights, "1"));

  // ── Beds — capacity is derived from each bed's KIND × quantity. The host
  // only sets the quantity; "sleeps per bed" comes from the bed kind. ──
  const [beds, setBeds] = useState<BedInput[]>(() =>
    (room.beds ?? []).map((b) => ({
      bed_kind: b.bed_kind as BedKind,
      quantity: b.quantity,
      sleeps: defaultSleepsForKind(b.bed_kind),
    })),
  );
  const capacity = useMemo(() => roomCapacityFromBeds(beds), [beds]);

  // ── Pricing ──
  const [pricingMode, setPricingMode] = useState<RoomPricingMode>(
    room.pricing_mode ?? "per_room",
  );
  const [basePrice, setBasePrice] = useState(numToStr(room.base_price, "0"));
  const [weekendPrice, setWeekendPrice] = useState(
    numToStr(room.weekend_price),
  );
  const [pricePerPerson, setPricePerPerson] = useState(
    numToStr(room.price_per_person),
  );
  const [baseOccupancy, setBaseOccupancy] = useState(
    numToStr(room.base_occupancy, "2"),
  );
  const [extraGuestPrice, setExtraGuestPrice] = useState(
    numToStr(room.extra_guest_price),
  );
  const [cleaningFee, setCleaningFee] = useState(
    numToStr(room.cleaning_fee, "0"),
  );
  const [isActive, setIsActive] = useState(room.is_active);

  function toggleExperience(label: string) {
    setExperiences((prev) =>
      prev.includes(label) ? prev.filter((p) => p !== label) : [...prev, label],
    );
  }
  function addBed() {
    setBeds((prev) => [
      ...prev,
      { bed_kind: "queen", quantity: 1, sleeps: defaultSleepsForKind("queen") },
    ]);
  }
  function removeBed(idx: number) {
    setBeds((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateBed(idx: number, patch: Partial<BedInput>) {
    setBeds((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }

  // Awaitable save used by both the in-card button and the page's top
  // Save / Save & publish buttons (via the imperative handle below).
  async function doSave(): Promise<boolean> {
    if (!name.trim()) {
      toast.error("Give the room a name.");
      return false;
    }
    if (beds.length === 0 || capacity < 1) {
      toast.error("Add at least one bed — capacity comes from the beds.");
      return false;
    }

    // Per-mode price validation.
    if (pricingMode === "per_person" && (toNum(pricePerPerson) ?? 0) <= 0) {
      toast.error("Set a per-person price.");
      return false;
    }
    if (pricingMode === "per_room" && (toNum(basePrice) ?? 0) <= 0) {
      toast.error("Set a base price per night.");
      return false;
    }
    if (pricingMode === "per_room_plus_extra") {
      if ((toNum(basePrice) ?? 0) <= 0) {
        toast.error("Set a base price per night.");
        return false;
      }
      if ((toInt(baseOccupancy) ?? 0) < 1) {
        toast.error("Set how many guests the base price covers.");
        return false;
      }
      if ((toNum(extraGuestPrice) ?? 0) <= 0) {
        toast.error("Set the price per extra guest.");
        return false;
      }
    }

    const patch = {
      name: name.trim(),
      description: description.trim().length > 0 ? description.trim() : null,
      bedrooms: toInt(bedrooms),
      bathrooms: toInt(bathrooms),
      // Capacity is derived from beds — sent so the row is consistent even
      // before setRoomBedsAction re-derives it server-side.
      max_guests: capacity,
      // Per-room minimums. min_guests can't exceed what the room sleeps.
      min_guests: Math.min(
        Math.max(1, toInt(minGuests) ?? 1),
        Math.max(1, capacity),
      ),
      min_nights: Math.max(1, toInt(minNights) ?? 1),
      pricing_mode: pricingMode,
      base_price: pricingMode === "per_person" ? 0 : (toNum(basePrice) ?? 0),
      weekend_price: pricingMode === "per_room" ? toNum(weekendPrice) : null,
      price_per_person:
        pricingMode === "per_person" ? toNum(pricePerPerson) : null,
      base_occupancy:
        pricingMode === "per_room_plus_extra" ? toInt(baseOccupancy) : null,
      extra_guest_price:
        pricingMode === "per_room_plus_extra" ? toNum(extraGuestPrice) : null,
      cleaning_fee: toNum(cleaningFee) ?? 0,
      is_active: isActive,
      room_size_sqm: toNum(roomSize),
      bed_type: bedType.length > 0 ? bedType : bedSummaryString(beds),
      view_type: viewType.length > 0 ? viewType : null,
      experiences,
    };

    // The local-state patch the parent applies on success.
    const localPatch: Partial<RoomEditorRoom> = {
      ...patch,
      beds: beds.map((b) => ({
        bed_kind: b.bed_kind,
        quantity: b.quantity,
        sleeps: b.sleeps,
      })),
    };

    if (mode === "create") {
      const result = await createRoomAction(listingId, patch);
      if (!result.ok || !result.data) {
        toast.error(result.ok ? "Could not create room." : result.error);
        return false;
      }
      const bedsResult = await setRoomBedsAction(
        listingId,
        result.data.id,
        beds,
      );
      if (!bedsResult.ok) {
        toast.error(bedsResult.error);
        return false;
      }
      toast.success("Room created");
      onCreated?.(result.data.id);
      return true;
    }

    const [detailsResult, bedsResult] = await Promise.all([
      updateRoomAction(listingId, room.id, patch),
      setRoomBedsAction(listingId, room.id, beds),
    ]);
    if (detailsResult.ok && bedsResult.ok) {
      onSaved?.(localPatch);
      toast.success("Room saved");
      return true;
    }
    toast.error(
      (!detailsResult.ok && detailsResult.error) ||
        (!bedsResult.ok && bedsResult.error) ||
        "Could not save room.",
    );
    return false;
  }

  // Keep a stable handle pointing at the latest doSave so the imperative
  // handle (and its deps) never need to change.
  const doSaveRef = useRef(doSave);
  doSaveRef.current = doSave;

  function save() {
    start(() => {
      void doSave();
    });
  }

  useImperativeHandle(ref, () => ({ save: () => doSaveRef.current() }), []);

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Room details
        </CardTitle>
        <CardDescription className="text-brand-mute">
          What makes this room itself. Beds set the capacity; pricing, vibe and
          the rest set it once here — guests see it in the listing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Field label="Room name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            maxLength={120}
          />
        </Field>

        <Field label="Description" hint="What the guest will see first.">
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={pending}
            maxLength={2000}
          />
        </Field>

        {/* ── Beds + derived capacity ─────────────────────────── */}
        <div className="rounded-card border border-brand-line bg-brand-light/40 p-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
              Beds in this room
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary/10 px-2.5 py-1 text-xs font-semibold text-brand-primary">
              <Users className="h-3.5 w-3.5" />
              Sleeps {capacity}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {beds.length === 0 ? (
              <div className="rounded border border-dashed border-brand-line bg-white px-3 py-4 text-center text-xs text-brand-mute">
                No beds yet. Add what&rsquo;s in the room — e.g. 1 King + 2
                Singles + 1 Futon. Capacity is worked out from these.
              </div>
            ) : (
              beds.map((b, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded border border-brand-line bg-white px-3 py-2.5"
                >
                  <select
                    value={b.bed_kind}
                    onChange={(e) => {
                      const kind = e.target.value as BedKind;
                      // Capacity follows the bed kind (e.g. King/Twin sleep 2,
                      // Single sleeps 1).
                      updateBed(i, {
                        bed_kind: kind,
                        sleeps: defaultSleepsForKind(kind),
                      });
                    }}
                    disabled={pending}
                    className="h-8 rounded border border-brand-line bg-white px-2 text-sm text-brand-dark outline-none focus:border-brand-primary"
                  >
                    {BED_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>

                  {/* The only number the host sets — how many of this bed. Each
                      bed's capacity comes from its kind. */}
                  <Stepper
                    label="Qty"
                    value={b.quantity}
                    min={1}
                    max={20}
                    disabled={pending}
                    onChange={(n) => updateBed(i, { quantity: n })}
                  />

                  <span className="text-[11px] text-brand-mute">
                    {defaultSleepsForKind(b.bed_kind)} per bed ·{" "}
                    <span className="font-medium text-brand-ink">
                      {defaultSleepsForKind(b.bed_kind) * b.quantity} guest
                      {defaultSleepsForKind(b.bed_kind) * b.quantity === 1
                        ? ""
                        : "s"}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => removeBed(i)}
                    disabled={pending}
                    className="ml-auto flex h-8 w-8 items-center justify-center rounded text-brand-mute hover:bg-red-50 hover:text-status-cancelled"
                    aria-label="Remove bed"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addBed}
            disabled={pending}
            className="mt-3 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add a bed
          </Button>
        </div>

        {/* ── Minimum booking ───────────────────────────────────── */}
        <div className="rounded-card border border-brand-line bg-brand-light/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
            <Users className="h-4 w-4 text-brand-primary" />
            Minimum booking
          </div>
          <p className="mt-0.5 text-xs text-brand-mute">
            Require a floor on guests and length-of-stay for this room. Leave at
            1 for no minimum. The booking takes the longer of the
            listing&rsquo;s and the selected rooms&rsquo; minimum nights.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label={`Min guests (room sleeps ${capacity || 1})`}>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={Math.max(1, capacity)}
                value={minGuests}
                onChange={(e) => setMinGuests(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field label="Min nights">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={minNights}
                onChange={(e) => setMinNights(e.target.value)}
                disabled={pending}
              />
            </Field>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Bedrooms">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              disabled={pending}
            />
          </Field>
          <Field label="Bathrooms">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={bathrooms}
              onChange={(e) => setBathrooms(e.target.value)}
              disabled={pending}
            />
          </Field>
          <Field label="Room size (m²)">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              value={roomSize}
              onChange={(e) => setRoomSize(e.target.value)}
              disabled={pending}
              placeholder="24"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Headline bed type"
            hint="Shown on cards. Auto-filled from beds."
          >
            <select
              value={bedType}
              onChange={(e) => setBedType(e.target.value)}
              disabled={pending}
              className="h-10 w-full rounded border border-brand-line bg-white px-3 text-sm text-brand-dark outline-none focus:border-brand-primary"
            >
              <option value="">Auto ({bedSummaryString(beds) ?? "—"})</option>
              {BED_TYPES.map((bt) => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </select>
          </Field>
          <Field label="View">
            <select
              value={viewType}
              onChange={(e) => setViewType(e.target.value)}
              disabled={pending}
              className="h-10 w-full rounded border border-brand-line bg-white px-3 text-sm text-brand-dark outline-none focus:border-brand-primary"
            >
              <option value="">—</option>
              {VIEW_TYPES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Experiences{" "}
            <span className="font-normal normal-case text-brand-mute">
              (pick all that apply)
            </span>
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

        {/* ── Pricing model ───────────────────────────────────── */}
        <div className="rounded-card border border-brand-line bg-brand-light/40 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            How this room is priced
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {PRICING_MODES.map((m) => {
              const active = pricingMode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setPricingMode(m.value)}
                  disabled={pending}
                  className={`rounded-card border p-3 text-left transition-colors ${
                    active
                      ? "border-brand-primary bg-white ring-1 ring-brand-primary/40"
                      : "border-brand-line bg-white hover:bg-brand-light/60"
                  }`}
                >
                  <div className="text-sm font-semibold text-brand-dark">
                    {m.label}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-brand-mute">
                    {m.body}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {pricingMode === "per_person" ? (
              <Field label="Price / person / night">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={pricePerPerson}
                  onChange={(e) => setPricePerPerson(e.target.value)}
                  disabled={pending}
                />
              </Field>
            ) : (
              <Field label="Base price / night">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  disabled={pending}
                />
              </Field>
            )}

            {pricingMode === "per_room" ? (
              <Field label="Weekend price (optional)">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={weekendPrice}
                  onChange={(e) => setWeekendPrice(e.target.value)}
                  disabled={pending}
                />
              </Field>
            ) : null}

            {pricingMode === "per_room_plus_extra" ? (
              <>
                <Field
                  label="Base covers"
                  hint="Guests included in the base price."
                >
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={capacity || 50}
                    value={baseOccupancy}
                    onChange={(e) => setBaseOccupancy(e.target.value)}
                    disabled={pending}
                  />
                </Field>
                <Field label="Each extra guest / night">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={extraGuestPrice}
                    onChange={(e) => setExtraGuestPrice(e.target.value)}
                    disabled={pending}
                  />
                </Field>
              </>
            ) : null}

            <Field label="Cleaning fee">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={cleaningFee}
                onChange={(e) => setCleaningFee(e.target.value)}
                disabled={pending}
              />
            </Field>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-brand-dark">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={pending}
            className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
          />
          Bookable
        </label>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={save}
            disabled={pending}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            {pending
              ? "Saving…"
              : mode === "create"
                ? "Create room"
                : "Save room"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

/** A small labelled −/+ number stepper used for per-bed Sleeps and Qty. */
function Stepper({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={disabled || value <= min}
          className="flex h-8 w-8 items-center justify-center rounded border border-brand-line text-brand-ink hover:bg-brand-accent disabled:opacity-40"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="w-7 text-center font-display font-semibold text-brand-ink">
          {value}
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={disabled || value >= max}
          className="flex h-8 w-8 items-center justify-center rounded border border-brand-line text-brand-ink hover:bg-brand-accent disabled:opacity-40"
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

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
        {hint ? (
          <span className="ml-1 font-normal normal-case text-brand-mute">
            — {hint}
          </span>
        ) : null}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
