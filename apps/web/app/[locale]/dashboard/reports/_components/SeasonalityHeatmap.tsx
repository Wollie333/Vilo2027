"use client";

import { TrendingUp } from "lucide-react";

interface MonthData {
  month: string;
  month_num: number;
  [province: string]: string | number;
}

interface SeasonalityData {
  months: string[];
  provinces: string[];
  data: MonthData[];
}

interface SeasonalityHeatmapProps {
  data: SeasonalityData;
  year: number;
}

export function SeasonalityHeatmap({ data, year }: SeasonalityHeatmapProps) {
  if (
    !data ||
    !data.data ||
    data.data.length === 0 ||
    data.provinces.length === 0
  ) {
    return (
      <div className="rounded-card border border-brand-line bg-white p-8 text-center">
        <p className="text-sm text-brand-mute">
          No seasonality data available for {year}.
        </p>
      </div>
    );
  }

  // Calculate min and max values for color scale
  const allValues: number[] = [];
  data.data.forEach((month) => {
    data.provinces.forEach((province) => {
      const value = month[province];
      if (typeof value === "number") {
        allValues.push(value);
      }
    });
  });

  const minValue = Math.min(...allValues, 0);
  const maxValue = Math.max(...allValues, 1);

  // Get color intensity based on value (0-100)
  const getColorIntensity = (value: number): string => {
    if (value === 0 || maxValue === 0) return "bg-gray-100 text-gray-400";

    const intensity = ((value - minValue) / (maxValue - minValue)) * 100;

    if (intensity >= 80) return "bg-green-600 text-white";
    if (intensity >= 60) return "bg-green-500 text-white";
    if (intensity >= 40) return "bg-green-400 text-green-900";
    if (intensity >= 20) return "bg-green-300 text-green-900";
    return "bg-green-200 text-green-800";
  };

  // Find peak month
  const revenueByMonth = data.data.map((month) => {
    const total = data.provinces.reduce((sum, province) => {
      const value = month[province];
      return sum + (typeof value === "number" ? value : 0);
    }, 0);
    return { month: month.month, total };
  });

  const peakMonth = revenueByMonth.reduce((max, current) =>
    current.total > max.total ? current : max,
  );

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 lg:p-6">
      {/* Header */}
      <div className="mb-5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
          Seasonality heatmap
        </div>
        <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
          {year} revenue patterns
        </h3>
        <div className="mt-0.5 text-xs text-brand-mute">
          Monthly revenue by region · darker = higher revenue
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          {/* Province Headers */}
          <div
            className="mb-2 grid gap-1"
            style={{
              gridTemplateColumns: `80px repeat(${data.provinces.length}, 1fr)`,
            }}
          >
            <div></div>
            {data.provinces.map((province) => (
              <div
                key={province}
                className="text-center text-[10px] font-medium text-brand-mute"
              >
                {province}
              </div>
            ))}
          </div>

          {/* Month Rows */}
          <div className="space-y-1">
            {data.data.map((monthData) => (
              <div
                key={monthData.month}
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `80px repeat(${data.provinces.length}, 1fr)`,
                }}
              >
                {/* Month Label */}
                <div className="flex items-center text-xs font-medium text-brand-ink">
                  {monthData.month}
                </div>

                {/* Province Cells */}
                {data.provinces.map((province) => {
                  const value = monthData[province];
                  const numValue = typeof value === "number" ? value : 0;
                  const colorClass = getColorIntensity(numValue);

                  return (
                    <div
                      key={`${monthData.month}-${province}`}
                      className={`flex h-12 items-center justify-center rounded text-[10px] font-semibold ${colorClass}`}
                      title={`${province} · ${monthData.month}: R ${formatCurrency(numValue)}`}
                    >
                      {numValue > 0 ? formatCompact(numValue) : "-"}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-5 flex items-center justify-between border-t border-brand-line pt-4">
        <div className="flex items-center gap-2 text-xs text-brand-mute">
          <span>Low</span>
          <div className="flex gap-0.5">
            <div className="h-4 w-6 rounded bg-green-200"></div>
            <div className="h-4 w-6 rounded bg-green-300"></div>
            <div className="h-4 w-6 rounded bg-green-400"></div>
            <div className="h-4 w-6 rounded bg-green-500"></div>
            <div className="h-4 w-6 rounded bg-green-600"></div>
          </div>
          <span>High</span>
        </div>
      </div>

      {/* Insight */}
      <div className="mt-3 flex items-start gap-2 rounded border border-brand-accent bg-brand-accent/10 p-3">
        <TrendingUp className="h-4 w-4 shrink-0 text-green-600" />
        <div className="text-xs text-brand-ink">
          <strong className="font-semibold">Peak season:</strong>{" "}
          {peakMonth.month} generated R {formatCurrency(peakMonth.total)} across
          all regions
        </div>
      </div>
    </div>
  );
}

// Helper: Format currency with spaces for thousands
function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "0";
  return value
    .toLocaleString("en-ZA", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    .replace(/,/g, " ");
}

// Helper: Format compact with K/M suffix
function formatCompact(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "0";
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(0) + "k";
  }
  return value.toString();
}
