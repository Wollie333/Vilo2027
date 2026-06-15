"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Slice = { key: string; name: string; count: number; mrr: number };

const PALETTE = [
  "#064E3B",
  "#10B981",
  "#34D399",
  "#9DC1B0",
  "#F4A836",
  "#A7F3D0",
];

export function PlanDonutChart({ data }: { data: Slice[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map((d, i) => ({
    ...d,
    color: PALETTE[i % PALETTE.length],
  }));

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card lg:p-6">
      <div className="mb-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
          Plan distribution
        </div>
        <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
          {total.toLocaleString("en-ZA")} subscriptions
        </h3>
      </div>
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-brand-mute">
          No subscriptions yet.
        </p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={88}
                paddingAngle={2}
                dataKey="count"
              >
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F2937",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 12px",
                }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as Slice;
                  return (
                    <div style={{ fontSize: 11 }}>
                      <div style={{ fontWeight: 600, color: "#fff" }}>
                        {d.name}
                      </div>
                      <div style={{ color: "#fff" }}>
                        {d.count} subs · R{d.mrr.toLocaleString("en-ZA")} MRR
                      </div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2 border-t border-brand-line pt-4">
            {chartData.map((d) => (
              <div
                key={d.key}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="font-medium text-brand-ink">{d.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-brand-mute">{d.count} subs</span>
                  <span className="font-semibold text-brand-ink">
                    R{d.mrr.toLocaleString("en-ZA")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
