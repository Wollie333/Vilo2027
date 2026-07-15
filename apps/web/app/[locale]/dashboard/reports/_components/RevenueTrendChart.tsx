"use client";

import { useTransition } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

interface TrendDataPoint {
  date: string;
  revenue: number;
}

interface RevenueTrendData {
  current: TrendDataPoint[];
  prior: TrendDataPoint[];
  grouping: string;
}

type Grouping = "day" | "week" | "month";

interface RevenueTrendChartProps {
  data: RevenueTrendData;
  totalRevenue: number;
  revenueGrowth: number;
  grouping: Grouping;
}

const GROUPINGS: { key: Grouping; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

export function RevenueTrendChart({
  data,
  totalRevenue,
  revenueGrowth,
  grouping,
}: RevenueTrendChartProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setGrouping = (g: Grouping) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (g === "day") params.delete("grouping");
    else params.set("grouping", g);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  // Merge current and prior data for the chart
  // Recharts needs a single data array with both series
  const chartData = data.current.map((item, index) => ({
    date: formatDateLabel(item.date, data.grouping),
    current: item.revenue,
    prior: data.prior[index]?.revenue || 0,
  }));

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 lg:col-span-2 lg:p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
            Revenue trend
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
            R {formatCurrency(totalRevenue)} across the period
          </h3>
          <div className="mt-0.5 text-xs text-brand-mute">
            <span
              className={`font-medium ${
                revenueGrowth >= 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              {revenueGrowth >= 0 ? "+" : ""}
              {revenueGrowth.toFixed(1)}%
            </span>{" "}
            vs. prior period · gross of refunds
          </div>
        </div>

        {/* Grouping Selector — re-buckets the trend (day / week / month) */}
        <div className="inline-flex items-center gap-2">
          {isPending && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-primary" />
          )}
          <div className="inline-flex rounded-full border border-brand-line bg-brand-light p-1 text-[11px] font-medium">
            {GROUPINGS.map((g) => (
              <button
                key={g.key}
                onClick={() => setGrouping(g.key)}
                className={`rounded-full px-3 py-1 transition-colors ${
                  grouping === g.key
                    ? "bg-white text-brand-ink shadow-sm"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={230}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
        >
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
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
          />

          <YAxis
            stroke="#9CA3AF"
            tick={{ fill: "#6B7280", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `R${formatCurrency(value)}`}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "none",
              borderRadius: "6px",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              padding: "8px 12px",
            }}
            labelStyle={{
              color: "#9DC1B0",
              fontSize: "10px",
              marginBottom: "4px",
            }}
            itemStyle={{
              color: "#fff",
              fontSize: "11px",
              fontWeight: 600,
            }}
            formatter={(value: unknown, name: unknown) => {
              const numValue = typeof value === "number" ? value : 0;
              const strName = typeof name === "string" ? name : "";
              return [
                `R ${formatCurrency(numValue)}`,
                strName === "current" ? "Current" : "Prior",
              ];
            }}
          />

          <Legend
            wrapperStyle={{
              paddingTop: "20px",
              fontSize: "11px",
            }}
            formatter={(value) =>
              value === "current" ? "Current period" : "Prior period"
            }
          />

          {/* Prior period line (dashed) */}
          <Line
            type="monotone"
            dataKey="prior"
            stroke="#9DC1B0"
            strokeWidth={1.75}
            strokeDasharray="4 4"
            dot={false}
            activeDot={{ r: 4 }}
          />

          {/* Current period line (solid with gradient fill) */}
          <Line
            type="monotone"
            dataKey="current"
            stroke="#10B981"
            strokeWidth={2.5}
            fill="url(#colorRevenue)"
            dot={false}
            activeDot={{
              r: 5,
              fill: "#fff",
              stroke: "#10B981",
              strokeWidth: 2.5,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Helper: Format currency for display
function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "0";
  if (value >= 1000000) {
    return (value / 1000000).toFixed(2) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(0) + "k";
  }
  return value.toFixed(0);
}

// Helper: Format date label based on grouping
function formatDateLabel(dateStr: string, grouping: string): string {
  const date = new Date(dateStr);

  if (grouping === "month") {
    return date.toLocaleDateString("en-ZA", { month: "short" });
  }

  if (grouping === "week") {
    return date.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  }

  // Day grouping
  return date.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}
