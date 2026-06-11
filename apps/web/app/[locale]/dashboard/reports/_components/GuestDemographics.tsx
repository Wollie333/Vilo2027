"use client";

import { Users, Globe } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface CountryData {
  country: string;
  bookings: number;
  percentage: number;
}

interface GuestDemographicsData {
  returning_guests: number;
  new_guests: number;
  country_breakdown: CountryData[];
}

interface GuestDemographicsProps {
  data: GuestDemographicsData;
}

const GUEST_TYPE_COLORS = {
  returning: "#10B981", // green
  new: "#3B82F6", // blue
};

const COUNTRY_COLORS: Record<string, string> = {
  ZA: "#10B981", // South Africa - green
  GB: "#3B82F6", // UK - blue
  US: "#F59E0B", // USA - amber
  DE: "#8B5CF6", // Germany - purple
  AU: "#EF4444", // Australia - red
  Unknown: "#9CA3AF", // gray
};

export function GuestDemographics({ data }: GuestDemographicsProps) {
  const totalGuests = data.returning_guests + data.new_guests;

  if (totalGuests === 0) {
    return (
      <div className="rounded-card border border-brand-line bg-white p-8 text-center">
        <p className="text-sm text-brand-mute">
          No guest data available for this period.
        </p>
      </div>
    );
  }

  // Prepare donut chart data
  const guestTypeData = [
    {
      name: "Returning",
      value: data.returning_guests,
      color: GUEST_TYPE_COLORS.returning,
    },
    { name: "New", value: data.new_guests, color: GUEST_TYPE_COLORS.new },
  ];

  const returningPercentage = (
    (data.returning_guests / totalGuests) *
    100
  ).toFixed(1);

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 lg:p-6">
      {/* Header */}
      <div className="mb-5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
          Guest demographics
        </div>
        <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
          {totalGuests} {totalGuests === 1 ? "guest" : "guests"}
        </h3>
        <div className="mt-0.5 text-xs text-brand-mute">
          {returningPercentage}% returning · Track loyalty and origins
        </div>
      </div>

      {/* Returning vs New Guests Donut */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-brand-ink">
          <Users className="h-3.5 w-3.5" />
          Guest type breakdown
        </div>

        <div className="flex items-center gap-4">
          {/* Donut Chart */}
          <div className="h-32 w-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={guestTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {guestTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0)
                      return null;
                    const data = payload[0].payload;
                    return (
                      <div className="rounded border border-brand-line bg-white px-3 py-2 shadow-lg">
                        <div className="text-xs font-semibold text-brand-ink">
                          {data.name}
                        </div>
                        <div className="text-xs text-brand-mute">
                          {data.value} guests (
                          {((data.value / totalGuests) * 100).toFixed(1)}%)
                        </div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded"
                  style={{ backgroundColor: GUEST_TYPE_COLORS.returning }}
                ></div>
                <span className="text-xs text-brand-mute">Returning</span>
              </div>
              <div className="text-sm font-semibold text-brand-ink">
                {data.returning_guests} ({returningPercentage}%)
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded"
                  style={{ backgroundColor: GUEST_TYPE_COLORS.new }}
                ></div>
                <span className="text-xs text-brand-mute">New</span>
              </div>
              <div className="text-sm font-semibold text-brand-ink">
                {data.new_guests} (
                {((data.new_guests / totalGuests) * 100).toFixed(1)}%)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Country Origins */}
      {data.country_breakdown.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-brand-ink">
            <Globe className="h-3.5 w-3.5" />
            Country origins
          </div>

          <div className="space-y-2">
            {data.country_breakdown.map((country) => {
              const color =
                COUNTRY_COLORS[country.country] || COUNTRY_COLORS["Unknown"];
              const percentage = country.percentage;

              return (
                <div key={country.country}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-brand-ink">{country.country}</span>
                    <span className="font-semibold text-brand-ink">
                      {country.bookings} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-brand-light">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: color,
                        minWidth: country.bookings > 0 ? "4px" : "0",
                      }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Insight */}
      <div className="mt-5 rounded border border-brand-accent bg-brand-accent/10 p-3">
        <div className="text-xs text-brand-ink">
          <strong className="font-semibold">Loyalty insight:</strong>{" "}
          {data.returning_guests > data.new_guests
            ? `Strong repeat business! ${returningPercentage}% of guests are returning.`
            : data.returning_guests === 0
              ? "All guests are first-time visitors. Focus on building loyalty programs."
              : `Growing customer base with ${((data.new_guests / totalGuests) * 100).toFixed(1)}% new guests.`}
        </div>
      </div>
    </div>
  );
}
