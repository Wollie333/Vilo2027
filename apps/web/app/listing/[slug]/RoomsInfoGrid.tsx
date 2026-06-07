import { BedDouble, Users } from "lucide-react";

import { formatMoney } from "@/lib/format";

import { bedSummary, roomFlagPills, type PublicRoom } from "./roomDisplay";

// Display-only room cards. Rooms are descriptive on the listing now — guests
// pick rooms inside the booking flow, not here. Shows a "from / night" price
// for context when a currency is provided.
export function RoomsInfoGrid({
  rooms,
  currency,
}: {
  rooms: PublicRoom[];
  currency?: string;
}) {
  if (rooms.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rooms.map((room) => (
        <article
          key={room.id}
          className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card"
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
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold text-brand-ink">
                  {room.name}
                </h3>
                {room.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-brand-mute">
                    {room.description}
                  </p>
                ) : null}
              </div>
              {currency && room.base_price > 0 ? (
                <div className="shrink-0 text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                    from
                  </div>
                  <div className="num font-display text-sm font-bold text-brand-ink">
                    {formatMoney(room.base_price, currency)}
                  </div>
                  <div className="text-[10px] text-brand-mute">/ night</div>
                </div>
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
          </div>
        </article>
      ))}
    </div>
  );
}
