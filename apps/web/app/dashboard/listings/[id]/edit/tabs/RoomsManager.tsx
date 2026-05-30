"use client";

import { BedDouble, ChevronDown, Plus } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { createRoomAction } from "../actions";
import type { EditorRoom } from "../Editor";
import { bedKindLabel, type BedKind } from "../schemas";
import { RoomRowEditor } from "./RoomRowEditor";

function roomBedTotal(room: EditorRoom): number {
  return room.beds.reduce((acc, b) => acc + b.quantity, 0);
}

function roomBedSummary(room: EditorRoom): string {
  if (room.beds.length === 0) return "";
  return room.beds
    .map(
      (b) => `${b.quantity} ${bedKindLabel(b.bed_kind as BedKind, b.quantity)}`,
    )
    .join(" · ");
}

export function RoomsManager({
  listingId,
  rooms,
  onChange,
  embedded = false,
  autoCreate = false,
}: {
  listingId: string;
  rooms: EditorRoom[];
  onChange: (rooms: EditorRoom[]) => void;
  embedded?: boolean;
  /** When true (deep-linked with ?add=1), create + open a fresh room on mount. */
  autoCreate?: boolean;
}) {
  const [createPending, startCreate] = useTransition();
  // Which freshly-added room row should auto-expand to its form.
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);

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
      // Auto-expand the new room so the host lands straight on its form.
      setOpenRoomId(result.data!.id);
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
          room_size_sqm: null,
          bed_type: null,
          view_type: null,
          experiences: [],
          has_ensuite_bathroom: false,
          smoking_allowed: false,
          pets_allowed: false,
          wheelchair_accessible: false,
          private_entrance: false,
          floor_number: null,
          inventory_count: 1,
          pricing_mode: "per_room",
          price_per_person: null,
          base_occupancy: null,
          extra_guest_price: null,
          featured_photo_id: null,
          beds: [],
          featuredPhotoUrl: null,
        },
      ]);
      toast.success("Room added — fill in the details below");
    });
  }

  // Deep-linked from /dashboard/rooms "Add room" (?tab=rooms&add=1): create one
  // fresh room and open its form straight away. Guard so it fires only once.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoCreate && !autoRan.current) {
      autoRan.current = true;
      addRoom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreate]);

  const body = (
    <>
      {rooms.length === 0 ? (
        <div className="rounded border border-dashed border-brand-line bg-brand-light/40 px-4 py-8 text-center text-sm text-brand-mute">
          No rooms yet. Add the first one — for whole-place listings, rooms
          describe what&rsquo;s inside; for per-room listings, each one is
          independently bookable.
        </div>
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => (
            <RoomRow
              key={room.id}
              listingId={listingId}
              room={room}
              defaultOpen={room.id === openRoomId}
              onUpdated={(updated) =>
                onChange(rooms.map((r) => (r.id === room.id ? updated : r)))
              }
              onDeleted={() => onChange(rooms.filter((r) => r.id !== room.id))}
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
    </>
  );

  if (embedded) {
    return <div className="p-5">{body}</div>;
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Rooms
        </CardTitle>
        <CardDescription className="text-brand-mute">
          One row per room. Click a row to edit name, capacity, pricing. Photos
          &amp; amenities live in the per-room editor (link in each expanded
          row).
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}

function RoomRow({
  listingId,
  room,
  onUpdated,
  onDeleted,
  defaultOpen = false,
}: {
  listingId: string;
  room: EditorRoom;
  onUpdated: (room: EditorRoom) => void;
  onDeleted: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const bedTotal = roomBedTotal(room);
  const amenityCount = room.amenityKeys?.length ?? 0;
  const beds = roomBedSummary(room);

  // Collapsed-row summary line: capacity + price + status + a few enrichments
  // so the host sees richness at a glance ("Sleeps 4 · R 1 200/night · 4 beds
  // · 6 amenities · 32m²"). All bits gracefully omit when missing.
  const summaryBits: string[] = [];
  summaryBits.push(`Sleeps ${room.max_guests}`);
  summaryBits.push(
    `R ${Math.round(room.base_price).toLocaleString("en-ZA").replace(/,/g, " ")}/night`,
  );
  if (bedTotal > 0) {
    summaryBits.push(`${bedTotal} bed${bedTotal === 1 ? "" : "s"}`);
  }
  if (amenityCount > 0) {
    summaryBits.push(
      `${amenityCount} amenit${amenityCount === 1 ? "y" : "ies"}`,
    );
  }
  if (room.room_size_sqm != null) {
    summaryBits.push(`${room.room_size_sqm}m²`);
  }
  if (room.inventory_count > 1) {
    summaryBits.push(`× ${room.inventory_count} units`);
  }
  if (!room.is_active) summaryBits.push("Hidden");

  return (
    <div className="overflow-hidden rounded-card border border-brand-line">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 bg-white px-4 py-3 text-left hover:bg-brand-light/60"
        aria-expanded={open}
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-brand-line bg-brand-accent/40 text-brand-primary">
          {room.featuredPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={room.featuredPhotoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <BedDouble className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-brand-ink">{room.name}</div>
          <div className="text-xs text-brand-mute">
            {summaryBits.join(" · ")}
            {!room.featuredPhotoUrl ? (
              <span className="ml-1.5 text-brand-primary">
                · No cover photo
              </span>
            ) : null}
          </div>
          {beds.length > 0 ? (
            <div className="mt-0.5 truncate text-[11px] text-brand-mute">
              {beds}
            </div>
          ) : null}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-brand-mute transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <RoomRowEditor
          listingId={listingId}
          room={room}
          onUpdated={onUpdated}
          onDeleted={onDeleted}
        />
      ) : null}
    </div>
  );
}
