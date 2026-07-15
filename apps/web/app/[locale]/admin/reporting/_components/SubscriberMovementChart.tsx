"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { month: string; added: number; churned: number };

export function SubscriberMovementChart({ data }: { data: Point[] }) {
  const chartData = data.map((d) => ({
    month: d.month,
    Added: d.added,
    // Churned drawn as a negative bar so gains/losses read at a glance.
    Churned: -d.churned,
  }));

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card lg:col-span-2 lg:p-6">
      <div className="mb-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
          Subscriber movement
        </div>
        <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
          New vs churned subscriptions by month
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 5, left: -18, bottom: 5 }}
          stackOffset="sign"
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
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "none",
              borderRadius: "6px",
              padding: "8px 12px",
              fontSize: "11px",
            }}
            labelStyle={{ color: "#9DC1B0" }}
            itemStyle={{ color: "#fff" }}
            cursor={{ fill: "rgba(16,185,129,0.06)" }}
            formatter={(value: unknown, name: unknown) => [
              String(Math.abs(typeof value === "number" ? value : 0)),
              typeof name === "string" ? name : "",
            ]}
          />
          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
          <Bar
            dataKey="Added"
            fill="#10B981"
            radius={[3, 3, 0, 0]}
            maxBarSize={26}
          />
          <Bar
            dataKey="Churned"
            fill="#EF4444"
            radius={[3, 3, 0, 0]}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
