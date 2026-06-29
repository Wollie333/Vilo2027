"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { label: string; revenue: number };

function compact(v: number): string {
  if (!v) return "0";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1000) return (v / 1000).toFixed(0) + "k";
  return v.toFixed(0);
}

export function RevenueAreaChart({
  data,
  total,
}: {
  data: Point[];
  total: number;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card lg:col-span-2 lg:p-6">
      <div className="mb-5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
          Wielo revenue collected
        </div>
        <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
          R {compact(total)} over 12 months
        </h3>
        <div className="mt-0.5 text-xs text-brand-mute">
          Completed user→Wielo charges (subscriptions + products), by month.
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart
          data={data}
          margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
        >
          <defs>
            <linearGradient id="wieloRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="2 4"
            stroke="#DCEAE0"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="#9CA3AF"
            tick={{ fill: "#6B7280", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fill: "#6B7280", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `R${compact(Number(v))}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "none",
              borderRadius: "6px",
              padding: "8px 12px",
            }}
            labelStyle={{ color: "#9DC1B0", fontSize: "10px", marginBottom: 4 }}
            itemStyle={{ color: "#fff", fontSize: "11px", fontWeight: 600 }}
            formatter={(value: unknown) => [
              `R ${compact(typeof value === "number" ? value : 0)}`,
              "Collected",
            ]}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#10B981"
            strokeWidth={2.5}
            fill="url(#wieloRev)"
            dot={false}
            activeDot={{
              r: 5,
              fill: "#fff",
              stroke: "#10B981",
              strokeWidth: 2.5,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
