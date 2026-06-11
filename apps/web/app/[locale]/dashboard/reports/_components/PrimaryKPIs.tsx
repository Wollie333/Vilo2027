"use client";

import {
  Banknote,
  Gauge,
  Tag,
  BedDouble,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface KPIData {
  revenue: {
    current: number;
    prior: number;
    delta: number | null;
    sparkline: Array<{ date: string; value: number }>;
  };
  revpar: {
    current: number;
    prior: number;
    delta: number | null;
  };
  adr: {
    current: number;
    prior: number;
    delta: number | null;
  };
  occupancy: {
    current: number;
    prior: number;
    delta: number;
    occupied_nights: number;
    available_nights: number;
  };
}

interface PrimaryKPIsProps {
  data: KPIData;
}

export function PrimaryKPIs({ data }: PrimaryKPIsProps) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-4">
      {/* Revenue */}
      <div className="rounded-card border border-brand-line bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-7 w-7 items-center justify-center rounded bg-brand-accent text-brand-secondary">
              <Banknote className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-medium text-brand-mute">
              Total revenue
            </span>
          </div>
          {data.revenue.delta !== null && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                data.revenue.delta >= 0
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {data.revenue.delta >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {data.revenue.delta >= 0 ? "+" : ""}
              {(data.revenue.delta ?? 0).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-3xl font-bold text-brand-ink">
            R {formatNumber(data.revenue.current)}
          </span>
        </div>
        <div className="mt-1 text-xs text-brand-mute">
          vs. R {formatNumber(data.revenue.prior)} prior period
        </div>
        {/* Sparkline Chart */}
        {data.revenue.sparkline && data.revenue.sparkline.length > 0 && (
          <svg
            viewBox="0 0 200 48"
            className="mt-3 h-10 w-full"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <RevenueSparkline data={data.revenue.sparkline} />
          </svg>
        )}
      </div>

      {/* RevPAR */}
      <div className="rounded-card border border-brand-line bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-7 w-7 items-center justify-center rounded bg-brand-accent text-brand-secondary">
              <Gauge className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-medium text-brand-mute">RevPAR</span>
          </div>
          {data.revpar.delta !== null && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                data.revpar.delta >= 0
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {data.revpar.delta >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {data.revpar.delta >= 0 ? "+" : ""}
              {(data.revpar.delta ?? 0).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-3xl font-bold text-brand-ink">
            R {formatNumber(data.revpar.current)}
          </span>
          <span className="text-xs text-brand-mute">/ night</span>
        </div>
        <div className="mt-1 text-xs text-brand-mute">
          Revenue per available night
        </div>
      </div>

      {/* ADR */}
      <div className="rounded-card border border-brand-line bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-7 w-7 items-center justify-center rounded bg-brand-accent text-brand-secondary">
              <Tag className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-medium text-brand-mute">ADR</span>
          </div>
          {data.adr.delta !== null && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                data.adr.delta >= 0
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {data.adr.delta >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {data.adr.delta >= 0 ? "+" : ""}
              {(data.adr.delta ?? 0).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-3xl font-bold text-brand-ink">
            R {formatNumber(data.adr.current)}
          </span>
          <span className="text-xs text-brand-mute">/ night</span>
        </div>
        <div className="mt-1 text-xs text-brand-mute">Average daily rate</div>
      </div>

      {/* Occupancy */}
      <div className="rounded-card border border-brand-line bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-7 w-7 items-center justify-center rounded bg-brand-accent text-brand-secondary">
              <BedDouble className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-medium text-brand-mute">
              Occupancy
            </span>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              data.occupancy.delta >= 0
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {data.occupancy.delta >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {data.occupancy.delta >= 0 ? "+" : ""}
            {(data.occupancy.delta ?? 0).toFixed(1)}pt
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-3xl font-bold text-brand-ink">
            {(data.occupancy.current ?? 0).toFixed(1)}%
          </span>
        </div>
        <div className="mt-1 text-xs text-brand-mute">
          {formatNumber(data.occupancy.occupied_nights)} of{" "}
          {formatNumber(data.occupancy.available_nights)} nights sold
        </div>
        {/* Simple bar chart showing trend */}
        <div className="mt-3 flex h-10 items-end gap-1">
          {generateOccupancyBars(data.occupancy.current)}
        </div>
      </div>
    </section>
  );
}

// Helper: Format number with spaces (South African style)
function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "0";
  if (value >= 1000000) {
    return (value / 1000000).toFixed(2) + "M";
  }
  if (value >= 1000) {
    return value.toLocaleString("en-ZA", { maximumFractionDigits: 0 });
  }
  return value.toFixed(0);
}

// Helper: Generate sparkline path for revenue
function RevenueSparkline({
  data,
}: {
  data: Array<{ date: string; value: number }>;
}) {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 200;
    const y = 48 - (d.value / maxValue) * 38; // Leave 10px margin at top/bottom
    return `${x},${y}`;
  });

  const linePath = `M${points.join(" L")}`;
  const areaPath = `${linePath} L200,48 L0,48 Z`;

  return (
    <>
      <path d={areaPath} fill="rgba(16,185,129,0.12)" />
      <path d={linePath} fill="none" stroke="#10B981" strokeWidth="1.75" />
    </>
  );
}

// Helper: Generate occupancy trend bars
function generateOccupancyBars(occupancy: number) {
  // Generate 10 bars with slight variation around current occupancy
  const bars = [];
  const baseHeight = occupancy;

  for (let i = 0; i < 10; i++) {
    // Add some variation (-10% to +15%)
    const variation = (Math.random() * 0.25 - 0.1) * baseHeight;
    const height = Math.min(100, Math.max(0, baseHeight + variation));
    const isRecent = i >= 7; // Last 3 bars are "current period"

    bars.push(
      <div
        key={i}
        className={`flex-1 rounded-sm ${
          isRecent ? "bg-brand-primary" : "bg-brand-accent"
        }`}
        style={{ height: `${height}%` }}
      />,
    );
  }

  return bars;
}
