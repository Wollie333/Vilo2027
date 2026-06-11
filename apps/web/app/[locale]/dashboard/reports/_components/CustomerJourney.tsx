"use client";

import { Clock, MousePointer, Eye } from "lucide-react";

interface TimeToBookData {
  median_days: number;
  breakdown: {
    same_day: number;
    one_to_three: number;
    three_to_seven: number;
    seven_to_fourteen: number;
    over_fourteen: number;
  };
  avg_touchpoints: number;
  avg_session_duration: number;
}

interface CustomerJourneyProps {
  data: TimeToBookData;
}

export function CustomerJourney({ data }: CustomerJourneyProps) {
  const total =
    data.breakdown.same_day +
    data.breakdown.one_to_three +
    data.breakdown.three_to_seven +
    data.breakdown.seven_to_fourteen +
    data.breakdown.over_fourteen;

  const breakdownItems = [
    { label: "Same day", value: data.breakdown.same_day, color: "#10B981" },
    { label: "1-3 days", value: data.breakdown.one_to_three, color: "#3B82F6" },
    {
      label: "3-7 days",
      value: data.breakdown.three_to_seven,
      color: "#F59E0B",
    },
    {
      label: "7-14 days",
      value: data.breakdown.seven_to_fourteen,
      color: "#EF4444",
    },
    {
      label: "14+ days",
      value: data.breakdown.over_fourteen,
      color: "#6B7280",
    },
  ];

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 lg:p-6">
      {/* Header */}
      <div className="mb-5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
          Customer journey
        </div>
        <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
          {data.median_days.toFixed(1)} days to book
        </h3>
        <div className="mt-0.5 text-xs text-brand-mute">
          Median time from first view to confirmed booking
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="mb-5 grid grid-cols-3 gap-3 rounded border border-brand-line bg-brand-light p-3">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-brand-mute">
            <Clock className="h-3 w-3" />
            Median Days
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-brand-ink">
            {data.median_days.toFixed(1)}
          </div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-brand-mute">
            <MousePointer className="h-3 w-3" />
            Touchpoints
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-brand-ink">
            {data.avg_touchpoints.toFixed(1)}
          </div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-brand-mute">
            <Eye className="h-3 w-3" />
            Avg Session
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-brand-ink">
            {formatDuration(data.avg_session_duration)}
          </div>
        </div>
      </div>

      {/* Time Breakdown */}
      <div>
        <div className="mb-3 text-xs font-medium text-brand-ink">
          Booking timeframe breakdown
        </div>
        <div className="space-y-2">
          {breakdownItems.map((item) => {
            const percentage = total > 0 ? (item.value / total) * 100 : 0;

            return (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-20 text-xs text-brand-mute">{item.label}</div>
                <div className="flex-1">
                  <div className="h-6 overflow-hidden rounded bg-brand-light">
                    <div
                      className="flex h-full items-center justify-end rounded px-2 text-[10px] font-semibold text-white transition-all"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: item.color,
                        minWidth: item.value > 0 ? "24px" : "0",
                      }}
                    >
                      {percentage >= 10 && item.value}
                    </div>
                  </div>
                </div>
                <div className="w-12 text-right text-xs font-semibold text-brand-ink">
                  {percentage.toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights */}
      <div className="mt-5 rounded border border-brand-accent bg-brand-accent/10 p-3">
        <div className="text-xs text-brand-ink">
          <strong className="font-semibold">Insight:</strong>{" "}
          {data.median_days < 3
            ? "Guests book quickly! Consider time-limited offers to create urgency."
            : data.median_days < 7
              ? "Typical booking window. Ensure availability is up-to-date and respond to inquiries within 24 hours."
              : "Longer consideration period. Focus on building trust through reviews, detailed descriptions, and quick responses."}
        </div>
      </div>
    </div>
  );
}

// Helper: Format duration (seconds to "2m 14s" format)
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}
