"use client";

import { Save } from "lucide-react";
import { useState, useTransition } from "react";
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

import { createRoomAction, updateRoomAction } from "../../../actions";
import { BED_TYPES, EXPERIENCES, VIEW_TYPES } from "../../../roomEnums";
import type { RoomEditorRoom } from "../RoomEditor";

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

export function RoomDetailsForm({
  listingId,
  room,
  mode = "edit",
  onSaved,
  onCreated,
}: {
  listingId: string;
  room: RoomEditorRoom;
  mode?: "create" | "edit";
  onSaved?: (patch: Partial<RoomEditorRoom>) => void;
  onCreated?: (id: string) => void;
}) {
  const [pending, start] = useTransition();

  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description ?? "");
  const [bedrooms, setBedrooms] = useState(numToStr(room.bedrooms, "1"));
  const [bathrooms, setBathrooms] = useState(numToStr(room.bathrooms, "0"));
  const [maxGuests, setMaxGuests] = useState(numToStr(room.max_guests, "2"));
  const [roomSize, setRoomSize] = useState(numToStr(room.room_size_sqm));
  const [bedType, setBedType] = useState<string>(room.bed_type ?? "");
  const [viewType, setViewType] = useState<string>(room.view_type ?? "");
  const [experiences, setExperiences] = useState<string[]>(
    room.experiences ?? [],
  );
  const [basePrice, setBasePrice] = useState(numToStr(room.base_price, "0"));
  const [weekendPrice, setWeekendPrice] = useState(
    numToStr(room.weekend_price),
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

  function save() {
    if (!name.trim()) {
      toast.error("Give the room a name.");
      return;
    }
    const patch = {
      name: name.trim(),
      description: description.trim().length > 0 ? description.trim() : null,
      bedrooms: toInt(bedrooms),
      bathrooms: toInt(bathrooms),
      max_guests: toInt(maxGuests) ?? room.max_guests ?? 2,
      base_price: toNum(basePrice) ?? room.base_price ?? 0,
      weekend_price: toNum(weekendPrice),
      cleaning_fee: toNum(cleaningFee) ?? 0,
      is_active: isActive,
      room_size_sqm: toNum(roomSize),
      bed_type: bedType.length > 0 ? bedType : null,
      view_type: viewType.length > 0 ? viewType : null,
      experiences,
    };
    start(async () => {
      if (mode === "create") {
        const result = await createRoomAction(listingId, patch);
        if (result.ok && result.data) {
          toast.success("Room created");
          onCreated?.(result.data.id);
        } else {
          toast.error(result.ok ? "Could not create room." : result.error);
        }
        return;
      }
      const result = await updateRoomAction(listingId, room.id, patch);
      if (result.ok) {
        onSaved?.(patch);
        toast.success("Room saved");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Room details
        </CardTitle>
        <CardDescription className="text-brand-mute">
          What makes this room itself. Pricing, capacity, vibe — set it once
          here, guests see it in the listing.
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
          <Field label="Max guests">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={maxGuests}
              onChange={(e) => setMaxGuests(e.target.value)}
              disabled={pending}
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
              disabled={pending}
              placeholder="24"
            />
          </Field>
          <Field label="Bed type">
            <select
              value={bedType}
              onChange={(e) => setBedType(e.target.value)}
              disabled={pending}
              className="h-10 w-full rounded border border-brand-line bg-white px-3 text-sm text-brand-dark outline-none focus:border-brand-primary"
            >
              <option value="">—</option>
              {BED_TYPES.map((b) => (
                <option key={b} value={b}>
                  {b}
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

        <div className="grid gap-3 sm:grid-cols-3">
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
