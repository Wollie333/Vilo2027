"use client";

import { ChevronDown, Plus, Save, Trash2 } from "lucide-react";
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

import {
  createRoomAction,
  deleteRoomAction,
  updateRoomAction,
} from "../actions";
import type { EditorRoom } from "../Editor";

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

export function RoomsManager({
  listingId,
  rooms,
  onChange,
}: {
  listingId: string;
  rooms: EditorRoom[];
  onChange: (rooms: EditorRoom[]) => void;
}) {
  const [createPending, startCreate] = useTransition();

  function addRoom() {
    startCreate(async () => {
      const defaultName = `Room ${rooms.length + 1}`;
      const result = await createRoomAction(listingId, {
        name: defaultName,
        bedrooms: 1,
        bathrooms: 0,
        max_guests: 2,
        base_price: 0,
        cleaning_fee: 0,
        is_active: true,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Optimistic-ish: shove a stub into local state. Real values come from
      // the next page navigation; for editing immediately use the returned id.
      onChange([
        ...rooms,
        {
          id: result.data!.id,
          name: defaultName,
          description: null,
          bedrooms: 1,
          bathrooms: 0,
          max_guests: 2,
          base_price: 0,
          weekend_price: null,
          cleaning_fee: 0,
          sort_order: rooms.length,
          is_active: true,
        },
      ]);
      toast.success("Room added");
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Rooms
        </CardTitle>
        <CardDescription className="text-brand-mute">
          One row per independently bookable room. Each room has its own price +
          capacity. Guests on per-room listings pick rooms here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rooms.length === 0 ? (
          <div className="rounded border border-dashed border-brand-line bg-brand-light/40 px-4 py-8 text-center text-sm text-brand-mute">
            No rooms yet. Add the first one to enable per-room booking.
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <RoomRow
                key={room.id}
                listingId={listingId}
                room={room}
                onUpdated={(updated) =>
                  onChange(rooms.map((r) => (r.id === room.id ? updated : r)))
                }
                onDeleted={() =>
                  onChange(rooms.filter((r) => r.id !== room.id))
                }
              />
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            onClick={addRoom}
            disabled={createPending}
            variant="outline"
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {createPending ? "Adding…" : "Add room"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RoomRow({
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
  const [open, setOpen] = useState(false);
  const [savePending, startSave] = useTransition();
  const [deletePending, startDelete] = useTransition();

  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description ?? "");
  const [bedrooms, setBedrooms] = useState(numToStr(room.bedrooms, "1"));
  const [bathrooms, setBathrooms] = useState(numToStr(room.bathrooms, "0"));
  const [maxGuests, setMaxGuests] = useState(numToStr(room.max_guests, "2"));
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
    <div className="overflow-hidden rounded-card border border-brand-line">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 bg-white px-4 py-3 text-left hover:bg-brand-light/60"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-brand-ink">{room.name}</div>
          <div className="text-xs text-brand-mute">
            Sleeps {room.max_guests} · R{" "}
            {Math.round(room.base_price)
              .toLocaleString("en-ZA")
              .replace(/,/g, " ")}
            /night
            {!room.is_active ? " · Hidden" : ""}
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-brand-mute transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-brand-line bg-brand-light/30 p-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
              Room name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
              disabled={savePending}
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
              Description{" "}
              <span className="font-normal normal-case text-brand-mute">
                (optional)
              </span>
            </label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
              disabled={savePending}
            />
          </div>

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

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={remove}
              disabled={deletePending || savePending}
              className="gap-1.5 text-status-cancelled hover:bg-red-50 hover:text-status-cancelled"
            >
              <Trash2 className="h-4 w-4" />
              {deletePending ? "Deleting…" : "Delete"}
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={savePending}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" />
              {savePending ? "Saving…" : "Save room"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
