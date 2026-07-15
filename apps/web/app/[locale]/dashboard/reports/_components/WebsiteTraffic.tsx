"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Globe,
  Users,
  Eye,
  MousePointerClick,
  TrendingUp,
  TrendingDown,
  Monitor,
  Smartphone,
} from "lucide-react";

import type { WebsiteAnalytics } from "@/lib/website/analytics";

interface WebsiteTrafficProps {
  data: WebsiteAnalytics;
  /** Number of published/owned sites the figures cover. */
  siteCount: number;
}

export function WebsiteTraffic({ data, siteCount }: WebsiteTrafficProps) {
  const rangeLabel =
    data.range === "7d"
      ? "last 7 days"
      : data.range === "90d"
        ? "last 90 days"
        : "last 30 days";

  const trend = data.trend.map((t) => ({
    date: new Date(t.date).toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
    }),
    Visitors: t.visitors,
    Pageviews: t.pageviews,
  }));

  const totalDevices = data.devices.desktop + data.devices.mobile;
  const desktopPct =
    totalDevices > 0
      ? Math.round((data.devices.desktop / totalDevices) * 100)
      : 0;

  return (
    <section className="rounded-card border border-brand-line bg-white p-5 lg:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Globe className="h-5 w-5 text-brand-primary" />
        <div>
          <h3 className="font-display text-lg font-bold text-brand-ink">
            Website traffic
          </h3>
          <div className="text-xs text-brand-mute">
            {rangeLabel} · {siteCount} {siteCount === 1 ? "site" : "sites"} ·
            first-party, cookieless
          </div>
        </div>
      </div>

      {!data.hasData ? (
        <div className="py-8 text-center text-brand-mute">
          <Globe className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">No website visits recorded yet</p>
          <p className="mt-1 text-xs">
            Traffic appears here once your published site starts getting
            visitors.
          </p>
        </div>
      ) : (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              icon={<Users className="h-3.5 w-3.5 text-brand-secondary" />}
              label="Visitors"
              value={fmt(data.visitors)}
              delta={data.deltas.visitors}
            />
            <Kpi
              icon={<Eye className="h-3.5 w-3.5 text-brand-secondary" />}
              label="Pageviews"
              value={fmt(data.pageviews)}
              delta={data.deltas.pageviews}
            />
            <Kpi
              icon={
                <MousePointerClick className="h-3.5 w-3.5 text-brand-primary" />
              }
              label="Booking clicks"
              value={fmt(data.bookingClicks)}
              delta={data.deltas.bookingClicks}
            />
            <Kpi
              icon={<TrendingUp className="h-3.5 w-3.5 text-brand-primary" />}
              label="Click-through"
              value={`${(data.conversion * 100).toFixed(1)}%`}
              sub={`${data.pagesPerVisit.toFixed(1)} pages/visit`}
            />
          </div>

          {/* Trend */}
          <div className="mt-4 rounded-lg border border-brand-line p-4">
            <div className="mb-2 text-xs font-medium text-brand-mute">
              Visitors & pageviews
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart
                data={trend}
                margin={{ top: 5, right: 5, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="wtVisitors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="2 4"
                  stroke="#DCEAE0"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="#9CA3AF"
                  tick={{ fill: "#6B7280", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#9CA3AF"
                  tick={{ fill: "#6B7280", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1F2937",
                    border: "none",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "11px",
                  }}
                  labelStyle={{ color: "#9DC1B0" }}
                  itemStyle={{ color: "#fff" }}
                  cursor={{ stroke: "#DCEAE0" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                />
                <Area
                  type="monotone"
                  dataKey="Visitors"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fill="url(#wtVisitors)"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Pageviews"
                  stroke="#0EA5E9"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Top pages / sources / devices */}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <ListCard
              title="Top pages"
              rows={data.topPages.map((p) => ({
                key: p.path,
                label: p.path,
                value: `${fmt(p.views)}`,
              }))}
              empty="No pageviews yet"
            />
            <ListCard
              title="Traffic sources"
              rows={data.sources.map((s) => ({
                key: s.label,
                label: s.label,
                value: `${fmt(s.visits)}`,
              }))}
              empty="No sources yet"
            />
            <div className="rounded-lg border border-brand-line p-3">
              <div className="mb-2 text-xs font-medium text-brand-mute">
                Devices
              </div>
              {totalDevices === 0 ? (
                <p className="py-4 text-center text-sm text-brand-mute">
                  No device data
                </p>
              ) : (
                <div className="space-y-2.5">
                  <DeviceRow
                    icon={
                      <Monitor className="h-3.5 w-3.5 text-brand-secondary" />
                    }
                    label="Desktop"
                    pct={desktopPct}
                    count={data.devices.desktop}
                  />
                  <DeviceRow
                    icon={
                      <Smartphone className="h-3.5 w-3.5 text-brand-primary" />
                    }
                    label="Mobile"
                    pct={100 - desktopPct}
                    count={data.devices.mobile}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Kpi({
  icon,
  label,
  value,
  delta,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: number | null;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-brand-line bg-brand-light/50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-mute">
          {icon}
          {label}
        </div>
        {delta !== undefined && delta !== null && (
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
              delta >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {delta >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {delta >= 0 ? "+" : ""}
            {delta}%
          </span>
        )}
      </div>
      <div className="mt-1.5 font-display text-lg font-bold text-brand-ink">
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 text-[11px] text-brand-mute">{sub}</div>
      ) : null}
    </div>
  );
}

function ListCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { key: string; label: string; value: string }[];
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-brand-line p-3">
      <div className="mb-2 text-xs font-medium text-brand-mute">{title}</div>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-brand-mute">{empty}</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div
              key={r.key}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate text-brand-ink" title={r.label}>
                {r.label}
              </span>
              <span className="shrink-0 font-medium text-brand-mute">
                {r.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeviceRow({
  icon,
  label,
  pct,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  pct: number;
  count: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-brand-ink">
          {icon}
          {label}
        </span>
        <span className="text-brand-mute">
          {pct}% · {fmt(count)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-accent/40">
        <div
          className="h-full rounded-full bg-brand-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function fmt(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "0";
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + "M";
  if (value >= 1000) return (value / 1000).toFixed(1) + "k";
  return value.toFixed(0);
}
