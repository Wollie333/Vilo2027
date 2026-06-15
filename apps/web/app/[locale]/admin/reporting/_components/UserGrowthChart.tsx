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

type Point = { label: string; hosts: number; guests: number };

export function UserGrowthChart({
  data,
  totalNew,
}: {
  data: Point[];
  totalNew: number;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card lg:p-6">
      <div className="mb-5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
          User growth
        </div>
        <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
          {totalNew.toLocaleString("en-ZA")} new sign-ups
        </h3>
        <div className="mt-0.5 text-xs text-brand-mute">
          Hosts vs guests joining per month.
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
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
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "none",
              borderRadius: "6px",
              padding: "8px 12px",
            }}
            labelStyle={{ color: "#9DC1B0", fontSize: "10px", marginBottom: 4 }}
            itemStyle={{ fontSize: "11px", fontWeight: 600 }}
            cursor={{ fill: "rgba(16,185,129,0.06)" }}
          />
          <Legend
            wrapperStyle={{ paddingTop: 12, fontSize: 11 }}
            iconType="circle"
          />
          <Bar
            dataKey="hosts"
            name="Hosts"
            stackId="u"
            fill="#10B981"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="guests"
            name="Guests"
            stackId="u"
            fill="#9DC1B0"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
