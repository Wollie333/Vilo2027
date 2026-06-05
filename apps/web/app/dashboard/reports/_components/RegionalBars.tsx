"use client";

import { MapPin } from "lucide-react";

interface RegionalData {
  province: string;
  revenue: number;
  bookings: number;
  percentage: number;
}

interface RegionalBarsProps {
  data: RegionalData[];
}

// Color palette for provinces (consistent with brand colors)
const PROVINCE_COLORS: Record<string, string> = {
  "Western Cape": "#10B981", // green
  "Gauteng": "#3B82F6", // blue
  "KwaZulu-Natal": "#F59E0B", // amber
  "Eastern Cape": "#8B5CF6", // purple
  "Free State": "#EF4444", // red
  "Limpopo": "#14B8A6", // teal
  "Mpumalanga": "#F97316", // orange
  "Northern Cape": "#A855F7", // violet
  "North West": "#EC4899", // pink
  "Unknown": "#9CA3AF", // gray
};

export function RegionalBars({ data }: RegionalBarsProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-card border border-brand-line bg-white p-8 text-center">
        <p className="text-sm text-brand-mute">
          No regional data available for this period.
        </p>
      </div>
    );
  }

  const totalRevenue = data.reduce((sum, region) => sum + region.revenue, 0);
  const maxRevenue = Math.max(...data.map((r) => r.revenue));

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 lg:p-6">
      {/* Header */}
      <div className="mb-5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
          Regional breakdown
        </div>
        <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
          R {formatCurrency(totalRevenue)} across {data.length}{" "}
          {data.length === 1 ? "region" : "regions"}
        </h3>
        <div className="mt-0.5 text-xs text-brand-mute">
          Revenue by province · South Africa
        </div>
      </div>

      {/* Regional Bars */}
      <div className="space-y-3">
        {data.map((region) => {
          const percentage = (region.revenue / maxRevenue) * 100;
          const color = PROVINCE_COLORS[region.province] || PROVINCE_COLORS["Unknown"];

          return (
            <div key={region.province}>
              {/* Province Name + Stats */}
              <div className="mb-1 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-brand-mute" />
                  <span className="font-medium text-brand-ink">{region.province}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-brand-mute">
                    {region.bookings} {region.bookings === 1 ? "booking" : "bookings"}
                  </span>
                  <span className="font-semibold text-brand-ink">
                    R {formatCurrency(region.revenue)}
                  </span>
                </div>
              </div>

              {/* Bar */}
              <div className="h-7 overflow-hidden rounded bg-brand-light">
                <div
                  className="flex h-full items-center justify-between rounded px-3 text-xs font-semibold text-white transition-all"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: color,
                    minWidth: region.revenue > 0 ? "32px" : "0",
                  }}
                >
                  {percentage >= 20 && (
                    <>
                      <span>{region.percentage.toFixed(1)}%</span>
                      <span>R {formatCurrency(region.revenue)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-5 rounded border border-brand-accent bg-brand-accent/10 p-3">
        <div className="text-xs text-brand-ink">
          <strong className="font-semibold">Top region:</strong>{" "}
          {data[0]?.province} accounts for {data[0]?.percentage.toFixed(1)}% of total
          revenue (R {formatCurrency(data[0]?.revenue)})
        </div>
      </div>
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
