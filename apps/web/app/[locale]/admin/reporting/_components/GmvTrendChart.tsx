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

type Point = { label: string; gmv: number };

function compact(v: number): string {
  if (!v) return "0";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1000) return (v / 1000).toFixed(0) + "k";
  return v.toFixed(0);
}

export function GmvTrendChart({
  data,
  total,
  months,
}: {
  data: Point[];
  total: number;
  months: number;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card lg:col-span-2 lg:p-6">
      <div className="mb-5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
          GMV processed (host↔guest booking value)
        </div>
        <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
          R {compact(total)} over {months} {months === 1 ? "month" : "months"}
        </h3>
        <div className="mt-0.5 text-xs text-brand-mute">
          Booking value for stays checking in each month. Wielo never holds
          this.
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart
          data={data}
          margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
        >
          <defs>
            <linearGradient id="gmvArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
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
              "GMV",
            ]}
          />
          <Area
            type="monotone"
            dataKey="gmv"
            stroke="#0EA5E9"
            strokeWidth={2.5}
            fill="url(#gmvArea)"
            dot={false}
            activeDot={{
              r: 5,
              fill: "#fff",
              stroke: "#0EA5E9",
              strokeWidth: 2.5,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
