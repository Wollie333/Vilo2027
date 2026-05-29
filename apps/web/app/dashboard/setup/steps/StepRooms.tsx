"use client";

import { DoorOpen, Pencil, Plus } from "lucide-react";
import { useState } from "react";

import type { Room } from "../types";
import { RoomEditorSheet } from "./RoomEditorSheet";

function rand(n: number): string {
  return `R ${Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}

// Rooms card — its own setup section. For accommodation, rooms are the single
// source of pricing & capacity: the listing's "from" price = the cheapest
// active room, and total guests/beds/baths = the sum across rooms (computed
// server-side after every room change).
export function StepRooms({
  listingId,
  rooms,
  onRoomSaved,
  onContinue,
}: {
  listingId: string;
  rooms: Room[];
  onRoomSaved: (room: Room) => void;
  onContinue: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);

  const activeRooms = rooms.filter((r) => r.is_active);

  function openAdd() {
    setEditingRoomId(null);
    setSheetOpen(true);
  }
  function openEdit(id: string) {
    setEditingRoomId(id);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-4">
      <p className="-mt-1 text-sm text-brand-mute">
        Add each room or unit guests can book. Pricing and capacity for the
        whole listing are calculated from your rooms — the lowest room price is
        your &ldquo;from&rdquo; rate, and guests/beds/baths add up across rooms.
        Renting the whole place as one unit? Add a single room for it.
      </p>

      {activeRooms.length > 0 ? (
        <ul className="space-y-2">
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
                {rand(r.base_price ?? 0)}
                <span className="text-[10px] font-normal text-brand-mute">
                  /night
                </span>
              </div>
              <button
                type="button"
                onClick={() => openEdit(r.id)}
                className="inline-flex items-center gap-1 rounded border border-brand-line bg-white px-2.5 py-1.5 text-xs font-medium text-brand-ink transition hover:bg-brand-accent"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-card border-2 border-dashed border-brand-line bg-brand-light/40 p-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
            <DoorOpen className="h-5 w-5" />
          </div>
          <div className="font-display text-sm font-semibold text-brand-ink">
            No rooms yet
          </div>
          <div className="max-w-sm text-xs text-brand-mute">
            Add your first room to set pricing and capacity for this listing.
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 rounded border border-dashed border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Add a room
        </button>
        {activeRooms.length > 0 ? (
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
          >
            Continue
          </button>
        ) : null}
      </div>

      <RoomEditorSheet
        listingId={listingId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        roomId={editingRoomId}
        onSaved={onRoomSaved}
      />
    </div>
  );
}
