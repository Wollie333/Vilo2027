"use client";

import {
  Bath,
  BedDouble,
  DoorOpen,
  ImageIcon,
  Mountain,
  Pencil,
  Plus,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import type { Room } from "../types";
import { RoomEditorSheet } from "./RoomEditorSheet";

function rand(n: number): string {
  return `R ${Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}

function plainText(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Rooms card — its own setup section and the single control for accommodation
// pricing & capacity. Each room renders as a full card: featured photo,
// description, capacity, beds/baths, and price.
export function StepRooms({
  listingId,
  rooms,
  onChanged,
  onContinue,
}: {
  listingId: string;
  rooms: Room[];
  onChanged: () => void;
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

      {rooms.length > 0 ? (
        <ul className="space-y-3">
          {rooms.map((r) => {
            const blurb = plainText(r.description);
            return (
              <li
                key={r.id}
                className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card"
              >
                <div className="flex flex-col sm:flex-row">
                  {/* Featured photo thumbnail */}
                  <div className="relative h-40 w-full shrink-0 bg-brand-light sm:h-auto sm:w-48">
                    {r.featured_image ? (
                      <Image
                        src={r.featured_image}
                        alt={r.name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full min-h-[120px] w-full flex-col items-center justify-center gap-1 text-brand-mute">
                        <ImageIcon className="h-6 w-6" />
                        <span className="text-[10px]">No photo</span>
                      </div>
                    )}
                    {r.photo_count > 0 ? (
                      <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-pill bg-brand-dark/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                        <ImageIcon className="h-3 w-3" /> {r.photo_count}
                      </span>
                    ) : null}
                  </div>

                  {/* Details */}
                  <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-display text-base font-bold text-brand-ink">
                            {r.name}
                          </h4>
                          {!r.is_active ? (
                            <span className="rounded-pill bg-status-draft/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-brand-mute">
                              Hidden
                            </span>
                          ) : null}
                        </div>
                        {r.bed_type || r.view_type ? (
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-brand-mute">
                            {r.bed_type ? (
                              <span className="inline-flex items-center gap-1">
                                <BedDouble className="h-3 w-3" /> {r.bed_type}
                              </span>
                            ) : null}
                            {r.view_type ? (
                              <span className="inline-flex items-center gap-1">
                                <Mountain className="h-3 w-3" /> {r.view_type}{" "}
                                view
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="num font-display text-base font-bold text-brand-ink">
                          {rand(r.base_price ?? 0)}
                        </div>
                        <div className="text-[10px] text-brand-mute">
                          / night
                          {r.weekend_price
                            ? ` · ${rand(r.weekend_price)} wknd`
                            : ""}
                        </div>
                      </div>
                    </div>

                    {blurb ? (
                      <p className="line-clamp-2 text-[12.5px] leading-relaxed text-brand-mute">
                        {blurb}
                      </p>
                    ) : (
                      <p className="text-[12px] italic text-brand-mute">
                        No description yet.
                      </p>
                    )}

                    <div className="mt-auto flex items-center justify-between gap-3 pt-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-brand-mute">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" /> Sleeps{" "}
                          {r.max_guests ?? "—"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <BedDouble className="h-3.5 w-3.5" />{" "}
                          {r.bedrooms ?? 0} bed{r.bedrooms === 1 ? "" : "s"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Bath className="h-3.5 w-3.5" /> {r.bathrooms ?? 0}{" "}
                          bath{r.bathrooms === 1 ? "" : "s"}
                        </span>
                        {r.cleaning_fee ? (
                          <span>· {rand(r.cleaning_fee)} cleaning</span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => openEdit(r.id)}
                        className="inline-flex shrink-0 items-center gap-1 rounded border border-brand-line bg-white px-2.5 py-1.5 text-xs font-medium text-brand-ink transition hover:bg-brand-accent"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
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
        onChanged={onChanged}
      />
    </div>
  );
}
