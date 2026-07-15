"use client";

import { Search, Send, Eye, CheckCircle, Clock, Banknote } from "lucide-react";
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

interface LookingForStatsData {
  posts_viewed: number;
  quotes_sent: number;
  quotes_viewed: number;
  quotes_accepted: number;
  acceptance_rate: number;
  view_rate: number;
  avg_response_hours: number;
  revenue_from_looking_for: number;
  regional_breakdown: Array<{ region: string; count: number }>;
  category_breakdown: Array<{ category: string; count: number }>;
  trend: Array<{ month: string; quotes_sent: number; accepted: number }>;
}

interface LookingForStatsProps {
  data: LookingForStatsData;
}

export function LookingForStats({ data }: LookingForStatsProps) {
  const hasActivity = data.quotes_sent > 0 || data.posts_viewed > 0;

  if (!hasActivity) {
    return (
      <section className="rounded-card border border-brand-line bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-5 w-5 text-brand-primary" />
          <h3 className="font-display font-semibold text-brand-ink">
            Looking For Performance
          </h3>
        </div>
        <div className="py-6 text-center text-brand-mute">
          <Search className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">No Looking For activity yet</p>
          <p className="mt-1 text-xs">
            Browse guest requests and send quotes to see metrics here
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-brand-line bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <Search className="h-5 w-5 text-brand-primary" />
        <h3 className="font-display font-semibold text-brand-ink">
          Looking For Performance
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Posts Viewed */}
        <div className="rounded-lg border border-brand-line bg-brand-light/50 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-mute">
            <Eye className="h-3.5 w-3.5 text-brand-secondary" />
            Posts viewed
          </div>
          <div className="mt-1.5 font-display text-lg font-bold text-brand-ink">
            {data.posts_viewed}
          </div>
        </div>

        {/* Quotes Sent */}
        <div className="rounded-lg border border-brand-line bg-brand-light/50 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-mute">
            <Send className="h-3.5 w-3.5 text-brand-secondary" />
            Quotes sent
          </div>
          <div className="mt-1.5 font-display text-lg font-bold text-brand-ink">
            {data.quotes_sent}
          </div>
        </div>

        {/* Quotes Viewed */}
        <div className="rounded-lg border border-brand-line bg-brand-light/50 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-mute">
            <Eye className="h-3.5 w-3.5 text-brand-primary" />
            Viewed by guest
          </div>
          <div className="mt-1.5 font-display text-lg font-bold text-brand-ink">
            {data.quotes_viewed}
            <span className="ml-1 text-xs font-normal text-brand-mute">
              ({data.view_rate.toFixed(0)}%)
            </span>
          </div>
        </div>

        {/* Quotes Accepted */}
        <div className="rounded-lg border border-brand-line bg-brand-light/50 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-mute">
            <CheckCircle className="h-3.5 w-3.5 text-status-confirmed" />
            Accepted
          </div>
          <div className="mt-1.5 font-display text-lg font-bold text-brand-ink">
            {data.quotes_accepted}
            <span className="ml-1 text-xs font-normal text-brand-mute">
              ({data.acceptance_rate.toFixed(0)}%)
            </span>
          </div>
        </div>

        {/* Avg Response Time */}
        <div className="rounded-lg border border-brand-line bg-brand-light/50 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-mute">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            Avg response
          </div>
          <div className="mt-1.5 font-display text-lg font-bold text-brand-ink">
            {formatResponseTime(data.avg_response_hours)}
          </div>
        </div>

        {/* Revenue from LF */}
        <div className="rounded-lg border border-brand-line bg-brand-light/50 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-mute">
            <Banknote className="h-3.5 w-3.5 text-brand-secondary" />
            Revenue
          </div>
          <div className="mt-1.5 font-display text-lg font-bold text-brand-ink">
            R {formatNumber(data.revenue_from_looking_for)}
          </div>
        </div>
      </div>

      {/* Regional & Category Breakdown */}
      {(data.regional_breakdown.length > 0 ||
        data.category_breakdown.length > 0) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Regional Breakdown */}
          {data.regional_breakdown.length > 0 && (
            <div className="rounded-lg border border-brand-line p-3">
              <div className="mb-2 text-xs font-medium text-brand-mute">
                By Region
              </div>
              <div className="space-y-1.5">
                {data.regional_breakdown.slice(0, 5).map((r) => (
                  <div
                    key={r.region}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-brand-ink">{r.region}</span>
                    <span className="text-brand-mute">{r.count} quotes</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category Breakdown */}
          {data.category_breakdown.length > 0 && (
            <div className="rounded-lg border border-brand-line p-3">
              <div className="mb-2 text-xs font-medium text-brand-mute">
                By Category
              </div>
              <div className="space-y-1.5">
                {data.category_breakdown.map((c) => (
                  <div
                    key={c.category}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="capitalize text-brand-ink">
                      {c.category}
                    </span>
                    <span className="text-brand-mute">{c.count} quotes</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Monthly trend — quotes sent vs accepted (was returned but never shown) */}
      {data.trend &&
        data.trend.some((t) => t.quotes_sent > 0 || t.accepted > 0) && (
          <div className="mt-4 rounded-lg border border-brand-line p-3">
            <div className="mb-2 text-xs font-medium text-brand-mute">
              Monthly trend — quotes sent vs accepted
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={data.trend.map((t) => ({
                  month: formatTrendMonth(t.month),
                  Sent: t.quotes_sent,
                  Accepted: t.accepted,
                }))}
                margin={{ top: 5, right: 5, left: -18, bottom: 0 }}
                barGap={2}
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
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                />
                <Bar dataKey="Sent" fill="#9DC1B0" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Accepted" fill="#10B981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
    </section>
  );
}

// "2026-03-01" | "2026-03" → "Mar"
function formatTrendMonth(month: string): string {
  const d = new Date(month.length === 7 ? `${month}-01` : month);
  if (isNaN(d.getTime())) return month;
  return d.toLocaleDateString("en-ZA", { month: "short" });
}

// Helper: Format number with K/M suffix
function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "0";
  if (value >= 1000000) {
    return (value / 1000000).toFixed(2) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(0) + "k";
  }
  return value.toLocaleString();
}

// Helper: Format response time in hours to human readable
function formatResponseTime(hours: number | undefined | null): string {
  if (hours === undefined || hours === null || isNaN(hours) || hours === 0)
    return "—";

  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}m`;
  }

  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  if (remainingHours === 0) {
    return `${days}d`;
  }
  return `${days}d ${remainingHours}h`;
}
