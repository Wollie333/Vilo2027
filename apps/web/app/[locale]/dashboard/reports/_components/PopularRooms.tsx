"use client";

import { Trophy, TrendingUp } from "lucide-react";

interface RoomData {
  property_id: string;
  listing_name: string;
  listing_slug: string;
  cover_image_url: string | null;
  occupancy_rate: number;
  nights_booked: number;
  revenue: number;
  bookings_count: number;
}

interface PopularRoomsProps {
  data: RoomData[];
}

export function PopularRooms({ data }: PopularRoomsProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-card border border-brand-line bg-white p-8 text-center">
        <p className="text-sm text-brand-mute">
          No room performance data available for this period.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 lg:p-6">
      {/* Header */}
      <div className="mb-5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
          Popular rooms
        </div>
        <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
          Top {data.length} performers
        </h3>
        <div className="mt-0.5 text-xs text-brand-mute">
          Sorted by occupancy rate · Maximize high-performers
        </div>
      </div>

      {/* Room List */}
      <div className="space-y-3">
        {data.map((room, index) => (
          <div
            key={room.property_id}
            className="flex items-center gap-3 rounded border border-brand-line p-3 transition-colors hover:bg-brand-light/50"
          >
            {/* Rank Badge */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center">
              {index === 0 ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                  <Trophy className="h-4 w-4 text-amber-600" />
                </div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-light">
                  <span className="text-sm font-bold text-brand-mute">
                    {index + 1}
                  </span>
                </div>
              )}
            </div>

            {/* Thumbnail */}
            {room.cover_image_url ? (
              <img
                src={room.cover_image_url}
                alt={room.listing_name}
                className="h-14 w-14 rounded object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded bg-brand-light text-xs font-medium text-brand-mute">
                {room.listing_name.charAt(0)}
              </div>
            )}

            {/* Room Info */}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-brand-ink">
                {room.listing_name}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-brand-mute">
                <span>{room.bookings_count} bookings</span>
                <span>·</span>
                <span>{room.nights_booked} nights</span>
              </div>
            </div>

            {/* Metrics */}
            <div className="text-right">
              {/* Occupancy Rate */}
              <div className="flex items-center justify-end gap-1">
                <TrendingUp className="h-3 w-3 text-green-600" />
                <span className="text-sm font-bold text-brand-ink">
                  {room.occupancy_rate.toFixed(1)}%
                </span>
              </div>
              {/* Revenue */}
              <div className="mt-0.5 text-xs text-brand-mute">
                R {formatCurrency(room.revenue)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Insight */}
      {data.length > 0 && (
        <div className="mt-5 rounded border border-brand-accent bg-brand-accent/10 p-3">
          <div className="text-xs text-brand-ink">
            <strong className="font-semibold">Top performer:</strong>{" "}
            {data[0].listing_name} achieved {data[0].occupancy_rate.toFixed(1)}%
            occupancy with R {formatCurrency(data[0].revenue)} revenue
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: Format currency with spaces for thousands
function formatCurrency(value: number): string {
  return value
    .toLocaleString("en-ZA", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    .replace(/,/g, " ");
}
