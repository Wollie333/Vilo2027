"use client";

import { BedDouble, Check, Plus, Users } from "lucide-react";

import { useRoomsCart } from "./RoomsCartProvider";

export type PublicRoom = {
  id: string;
  name: string;
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  max_guests: number;
  base_price: number;
  cleaning_fee: number;
  photoUrl: string | null;
};

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
                {room.bedrooms != null ? (
                  <span>
                    {room.bedrooms} bed{room.bedrooms === 1 ? "" : "s"}
                  </span>
                ) : null}
                {room.bathrooms != null ? (
                  <span>
                    {room.bathrooms} bath{room.bathrooms === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
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
