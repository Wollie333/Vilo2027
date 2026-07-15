"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CreditCard, Puzzle, TicketPercent, Coins } from "lucide-react";

export interface RevenueBreakdownData {
  currency: string;
  paymentMethods: { method: string; amount: number; count: number }[];
  addonsCollected: number;
  coupons: { count: number; discountGiven: number };
  credits: { balance: number; spent: number; granted: number };
  // Revenue by check-in weekday, Monday-first (index 0 = Mon).
  weekdayRevenue: number[];
  weekendShare: number; // % of revenue from Fri/Sat check-ins
}

interface RevenueBreakdownProps {
  data: RevenueBreakdownData;
}

const METHOD_LABELS: Record<string, string> = {
  paystack: "Paystack",
  card: "Card (Paystack)",
  paypal: "PayPal",
  eft: "Manual EFT",
  manual: "Manual EFT",
  cash: "Cash",
  credit: "Store credit",
  other: "Other",
};

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function RevenueBreakdown({ data }: RevenueBreakdownProps) {
  const hasMethods = data.paymentMethods.length > 0;
  const weekdayData = data.weekdayRevenue.map((rev, i) => ({
    day: DOW[i],
    revenue: rev,
    weekend: i === 4 || i === 5, // Fri, Sat
  }));
  const hasWeekday = data.weekdayRevenue.some((v) => v > 0);

  return (
    <section className="rounded-card border border-brand-line bg-white p-5 lg:p-6">
      <div className="mb-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
          Revenue breakdown
        </div>
        <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
          How you got paid
        </h3>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Payment methods */}
        <div className="rounded-lg border border-brand-line p-4">
          <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-brand-mute">
            <CreditCard className="h-3.5 w-3.5 text-brand-primary" />
            Payment methods · collected this period
          </div>
          {hasMethods ? (
            <div className="space-y-2">
              {data.paymentMethods.map((m) => (
                <div
                  key={m.method}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-brand-ink">
                    {METHOD_LABELS[m.method] ?? titleCase(m.method)}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-brand-mute">
                      {m.count} {m.count === 1 ? "payment" : "payments"}
                    </span>
                    <span className="font-semibold text-brand-ink">
                      R {fmt(m.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-brand-mute">
              No payments collected this period.
            </p>
          )}
        </div>

        {/* Add-ons / coupons / credits stat tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <StatTile
            icon={<Puzzle className="h-3.5 w-3.5 text-brand-secondary" />}
            label="Add-ons collected"
            value={`R ${fmt(data.addonsCollected)}`}
          />
          <StatTile
            icon={<TicketPercent className="h-3.5 w-3.5 text-amber-500" />}
            label="Coupons redeemed"
            value={String(data.coupons.count)}
            sub={`R ${fmt(data.coupons.discountGiven)} given`}
          />
          <StatTile
            icon={<Coins className="h-3.5 w-3.5 text-brand-primary" />}
            label="Wielo credits"
            value={String(data.credits.balance)}
            sub={`${data.credits.spent} spent · ${data.credits.granted} added`}
          />
          <StatTile
            icon={<CreditCard className="h-3.5 w-3.5 text-brand-secondary" />}
            label="Weekend share"
            value={`${data.weekendShare.toFixed(0)}%`}
            sub="Fri/Sat check-ins"
          />
        </div>
      </div>

      {/* Revenue by check-in weekday */}
      {hasWeekday && (
        <div className="mt-4 rounded-lg border border-brand-line p-4">
          <div className="mb-2 text-xs font-medium text-brand-mute">
            Revenue by check-in day
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={weekdayData}
              margin={{ top: 5, right: 5, left: -18, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="2 4"
                stroke="#DCEAE0"
                vertical={false}
              />
              <XAxis
                dataKey="day"
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
                tickFormatter={(v) => `R${fmt(Number(v))}`}
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
                formatter={(value: unknown) => [
                  `R ${fmt(typeof value === "number" ? value : 0)}`,
                  "Revenue",
                ]}
              />
              <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                {weekdayData.map((d, i) => (
                  <Cell key={i} fill={d.weekend ? "#F4A836" : "#10B981"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
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
      {sub ? (
        <div className="mt-0.5 text-[11px] text-brand-mute">{sub}</div>
      ) : null}
    </div>
  );
}

function fmt(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "0";
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + "M";
  if (value >= 1000) return (value / 1000).toFixed(1) + "k";
  return value.toFixed(0);
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
