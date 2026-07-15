"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { PlanSlice } from "@/lib/billing/platform-report";

const PALETTE = [
  "#064E3B",
  "#10B981",
  "#34D399",
  "#9DC1B0",
  "#F4A836",
  "#A7F3D0",
];

export function PlanDonutChart({ data }: { data: PlanSlice[] }) {
  // Count "subscriptions" honestly: one-off product rows are NOT subscriptions,
  // so the headline counts only subscription slices (was summing units of every
  // row, mislabelling one-off products as subscriptions).
  const subCount = data
    .filter((d) => d.type === "subscription")
    .reduce((s, d) => s + d.count, 0);
  const subMrr = data
    .filter((d) => d.type === "subscription")
    .reduce((s, d) => s + d.mrr, 0);

  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map((d, i) => ({
    ...d,
    color: PALETTE[i % PALETTE.length],
    // MRR share among subscriptions (one-offs excluded from the %).
    share:
      d.type === "subscription" && subMrr > 0
        ? Math.round((d.mrr / subMrr) * 1000) / 10
        : null,
  }));

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card lg:p-6">
      <div className="mb-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
          Plan distribution
        </div>
        <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
          {subCount.toLocaleString("en-ZA")}{" "}
          {subCount === 1 ? "subscription" : "subscriptions"}
        </h3>
      </div>
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-brand-mute">
          No plans or product sales yet.
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
                  const d = payload[0].payload as (typeof chartData)[number];
                  const unit = d.type === "one_off" ? "sold" : "subs";
                  const money = d.type === "one_off" ? "collected" : "MRR";
                  return (
                    <div style={{ fontSize: 11 }}>
                      <div style={{ fontWeight: 600, color: "#fff" }}>
                        {d.name}
                        {d.testOnly ? " (test)" : ""}
                      </div>
                      <div style={{ color: "#fff" }}>
                        {d.count} {unit} · R{d.mrr.toLocaleString("en-ZA")}{" "}
                        {money}
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
                  {d.type === "one_off" && (
                    <span className="rounded-full bg-brand-light px-1.5 py-0.5 text-[9px] font-semibold uppercase text-brand-mute">
                      One-off
                    </span>
                  )}
                  {d.testOnly && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700">
                      Test
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-brand-mute">
                    {d.count} {d.type === "one_off" ? "sold" : "subs"}
                    {d.share !== null ? ` · ${d.share}%` : ""}
                  </span>
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
