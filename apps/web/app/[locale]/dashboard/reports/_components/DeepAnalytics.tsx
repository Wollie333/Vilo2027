"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Moon,
  Users2,
  CalendarClock,
  TrendingUp,
  UserCheck,
  XCircle,
} from "lucide-react";

import type { HostDeepAnalytics } from "@/lib/reports/hostDeepAnalytics";

interface DeepAnalyticsProps {
  data: HostDeepAnalytics;
}

export function DeepAnalytics({ data }: DeepAnalyticsProps) {
  if (!data.hasData) return null;

  return (
    <section className="space-y-3 lg:space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-brand-ink md:text-2xl">
          In-depth analytics
        </h2>
        <p className="mt-0.5 text-sm text-brand-mute">
          Booking behaviour, revenue trends, guests and cancellations — the
          deeper cuts behind your headline numbers.
        </p>
      </div>

      {/* Booking behaviour */}
      <div className="rounded-card border border-brand-line bg-white p-5 lg:p-6">
        <div className="mb-4 flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-brand-primary" />
          <h3 className="font-display text-lg font-bold text-brand-ink">
            Booking behaviour
          </h3>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Stat
            icon={<Moon className="h-3.5 w-3.5 text-brand-secondary" />}
            label="Avg length of stay"
            value={`${data.avgNights} ${data.avgNights === 1 ? "night" : "nights"}`}
          />
          <Stat
            icon={<CalendarClock className="h-3.5 w-3.5 text-brand-primary" />}
            label="Median lead time"
            value={`${data.medianLeadDays} ${data.medianLeadDays === 1 ? "day" : "days"}`}
          />
          <Stat
            icon={<Users2 className="h-3.5 w-3.5 text-brand-secondary" />}
            label="Avg party size"
            value={`${data.avgPartySize}`}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <MiniBars
            title="Length of stay"
            data={data.lengthOfStay}
            suffix=" nights"
          />
          <MiniBars title="Booking lead time" data={data.leadTime} />
          <MiniBars title="Party size" data={data.partySize} suffix=" guests" />
        </div>
      </div>

      {/* Revenue & ADR by month + booking pace */}
      <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
        {data.revenueByMonth.length > 0 && (
          <div className="rounded-card border border-brand-line bg-white p-5 lg:col-span-2 lg:p-6">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand-primary" />
              <h3 className="font-display text-lg font-bold text-brand-ink">
                Revenue & ADR by month
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart
                data={data.revenueByMonth}
                margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="2 4"
                  stroke="#DCEAE0"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  stroke="#9CA3AF"
                  tick={{ fill: "#6B7280", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="rev"
                  stroke="#9CA3AF"
                  tick={{ fill: "#6B7280", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `R${fmt(Number(v))}`}
                />
                <YAxis
                  yAxisId="adr"
                  orientation="right"
                  stroke="#9CA3AF"
                  tick={{ fill: "#6B7280", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `R${fmt(Number(v))}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "#9DC1B0", fontSize: "10px" }}
                  itemStyle={{ color: "#fff", fontSize: "11px" }}
                  formatter={(value: unknown, name: unknown) => [
                    `R ${fmt(typeof value === "number" ? value : 0)}`,
                    name === "revenue" ? "Revenue" : "ADR",
                  ]}
                />
                <Bar
                  yAxisId="rev"
                  dataKey="revenue"
                  fill="#10B981"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={38}
                />
                <Line
                  yAxisId="adr"
                  type="monotone"
                  dataKey="adr"
                  stroke="#F4A836"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#F4A836" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-2 flex items-center gap-4 text-[11px] text-brand-mute">
              <Legend color="#10B981" label="Revenue (left)" />
              <Legend color="#F4A836" label="ADR / night (right)" />
            </div>
          </div>
        )}

        {data.pace.length > 0 && (
          <div className="rounded-card border border-brand-line bg-white p-5 lg:p-6">
            <div className="mb-4 text-[11px] font-medium uppercase tracking-wide text-brand-mute">
              Booking pace · created / month
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={data.pace}
                margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="2 4"
                  stroke="#DCEAE0"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  stroke="#9CA3AF"
                  tick={{ fill: "#6B7280", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#9CA3AF"
                  tick={{ fill: "#6B7280", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: "#fff", fontSize: "11px" }}
                  cursor={{ fill: "rgba(16,185,129,0.06)" }}
                  formatter={(value: unknown) => [
                    `${typeof value === "number" ? value : 0}`,
                    "Bookings",
                  ]}
                />
                <Bar
                  dataKey="bookings"
                  fill="#0EA5E9"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Guests + cancellations */}
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        {/* Guest analysis */}
        <div className="rounded-card border border-brand-line bg-white p-5 lg:p-6">
          <div className="mb-4 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-brand-primary" />
            <h3 className="font-display text-lg font-bold text-brand-ink">
              Guests
            </h3>
            <span className="text-xs text-brand-mute">· all-time</span>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Stat label="New guests" value={String(data.guests.newGuests)} />
            <Stat label="Returning" value={String(data.guests.returning)} />
            <Stat label="Repeat rate" value={`${data.guests.repeatRate}%`} />
          </div>
          {data.guests.top.length > 0 && (
            <div className="rounded-lg border border-brand-line p-3">
              <div className="mb-2 text-xs font-medium text-brand-mute">
                Top guests by revenue
              </div>
              <div className="space-y-1.5">
                {data.guests.top.map((g, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate text-brand-ink">{g.name}</span>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-brand-mute">
                        {g.bookings} {g.bookings === 1 ? "stay" : "stays"}
                      </span>
                      <span className="font-semibold text-brand-ink">
                        R {fmt(g.revenue)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Cancellations */}
        <div className="rounded-card border border-brand-line bg-white p-5 lg:p-6">
          <div className="mb-4 flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            <h3 className="font-display text-lg font-bold text-brand-ink">
              Cancellations
            </h3>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Stat label="Cancelled" value={String(data.cancellations.total)} />
            <Stat
              label="Cancellation rate"
              value={`${data.cancellations.rate}%`}
            />
          </div>
          {data.cancellations.reasons.length > 0 ? (
            <div className="rounded-lg border border-brand-line p-3">
              <div className="mb-2 text-xs font-medium text-brand-mute">
                Reasons
              </div>
              <div className="space-y-1.5">
                {data.cancellations.reasons.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate capitalize text-brand-ink">
                      {r.label}
                    </span>
                    <span className="shrink-0 font-medium text-brand-mute">
                      {r.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-brand-mute">
              No cancellations in this period.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-brand-line bg-brand-light/50 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-mute">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 font-display text-lg font-bold text-brand-ink">
        {value}
      </div>
    </div>
  );
}

function MiniBars({
  title,
  data,
  suffix = "",
}: {
  title: string;
  data: { label: string; count: number }[];
  suffix?: string;
}) {
  const hasAny = data.some((d) => d.count > 0);
  return (
    <div className="rounded-lg border border-brand-line p-3">
      <div className="mb-2 text-xs font-medium text-brand-mute">{title}</div>
      {!hasAny ? (
        <p className="py-4 text-center text-xs text-brand-mute">No data</p>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="2 4"
              stroke="#DCEAE0"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              stroke="#9CA3AF"
              tick={{ fill: "#6B7280", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              width={28}
              stroke="#9CA3AF"
              tick={{ fill: "#6B7280", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={{ color: "#fff", fontSize: "11px" }}
              cursor={{ fill: "rgba(16,185,129,0.06)" }}
              formatter={(value: unknown) => [
                `${typeof value === "number" ? value : 0}`,
                "Bookings",
              ]}
              labelFormatter={(l) => `${l}${suffix}`}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={34}>
              {data.map((_, i) => (
                <Cell key={i} fill="#10B981" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

const tooltipStyle = {
  backgroundColor: "#1F2937",
  border: "none",
  borderRadius: "6px",
  padding: "8px 12px",
} as const;

function fmt(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "0";
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + "M";
  if (value >= 1000) return (value / 1000).toFixed(1) + "k";
  return value.toFixed(0);
}
