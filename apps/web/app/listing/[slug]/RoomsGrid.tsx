"use client";

import { BedDouble, Check, Plus, Users } from "lucide-react";

import { useRoomsCart } from "./RoomsCartProvider";
import { bedSummary, roomFlagPills, type PublicRoom } from "./roomDisplay";

// Re-export so existing `import { type PublicRoom } from "./RoomsGrid"` (page,
// RoomsCartSidebar) keep working. bedSummary/roomFlagPills now live in the
// non-client roomDisplay module so server components can call them.
export type { PublicRoom };

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

export function RoomsGrid({
  rooms,
  currency,
}: {
  rooms: PublicRoom[];
  currency: string;
}) {
  const { mode, flexibleTab, isSelected, toggle } = useRoomsCart();

  // In flexible mode, the rooms grid only matters on the "rooms" tab.
  if (mode === "flexible" && flexibleTab !== "rooms") return null;

  if (rooms.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white/50 p-6 text-center text-sm text-brand-mute">
        The host hasn&rsquo;t set up any bookable rooms yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rooms.map((room) => {
        const selected = isSelected(room.id);
        return (
          <article
            key={room.id}
            className={`overflow-hidden rounded-card border bg-white shadow-card transition-all ${
              selected
                ? "border-brand-primary ring-2 ring-brand-primary/30"
                : "border-brand-line"
            }`}
          >
            {room.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={room.photoUrl}
                alt={room.name}
                className="h-40 w-full object-cover"
              />
            ) : (
              <div className="flex h-40 w-full items-center justify-center bg-brand-accent/40 text-brand-primary">
                <BedDouble className="h-8 w-8" />
              </div>
            )}
            <div className="space-y-3 p-4">
              <div>
                <h3 className="font-display text-base font-semibold text-brand-ink">
                  {room.name}
                </h3>
                {room.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-brand-mute">
                    {room.description}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-mute">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> Sleeps {room.max_guests}
                </span>
                {room.bathrooms != null ? (
                  <span>
                    {room.bathrooms} bath{room.bathrooms === 1 ? "" : "s"}
                  </span>
                ) : null}
                {room.room_size_sqm != null ? (
                  <span>{room.room_size_sqm}m²</span>
                ) : null}
                {room.view_type ? <span>{room.view_type} view</span> : null}
              </div>
              {room.beds && room.beds.length > 0 ? (
                <div className="text-[11px] text-brand-dark">
                  {bedSummary(room.beds)}
                </div>
              ) : null}
              {roomFlagPills(room).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {roomFlagPills(room).map((p) => (
                    <span
                      key={p}
                      className="rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand-secondary"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 border-t border-brand-line pt-3">
                <div>
                  <span className="font-display text-lg font-bold text-brand-ink">
                    {fmtR(room.base_price, currency)}
                  </span>
                  <span className="ml-1 text-[11px] text-brand-mute">
                    / night
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(room.id)}
                  className={`inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selected
                      ? "bg-brand-primary text-white hover:bg-brand-secondary"
                      : "border border-brand-line bg-white text-brand-dark hover:bg-brand-light/60"
                  }`}
                >
                  {selected ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Added
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" /> Add
                    </>
                  )}
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
