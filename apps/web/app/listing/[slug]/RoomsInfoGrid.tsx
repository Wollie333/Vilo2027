import { BedDouble, Users } from "lucide-react";

import { bedSummary, roomFlagPills, type PublicRoom } from "./RoomsGrid";

// Display-only room cards for whole-listing mode. Same shape as RoomsGrid
// but without per-room pricing or the Add-to-cart button — rooms are
// descriptive here, not independently bookable.
export function RoomsInfoGrid({ rooms }: { rooms: PublicRoom[] }) {
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
          </div>
        </article>
      ))}
    </div>
  );
}
