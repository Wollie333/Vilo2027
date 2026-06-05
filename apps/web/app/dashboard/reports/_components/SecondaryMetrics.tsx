"use client";

import {
  PiggyBank,
  Star,
  XCircle,
  RotateCcw,
  FileText,
  Eye,
} from "lucide-react";

interface SecondaryMetricsData {
  net_value: number;
  commission_saved: number;
  avg_rating: number;
  review_count: number;
  rating_delta: number | null;
  cancellation_rate: number;
  cancellation_count: number;
  total_bookings: number;
  refund_rate: number;
  refund_amount: number;
  refund_count: number;
  quotes_sent: number;
  quotes_accepted: number;
  acceptance_rate: number;
  listing_views: number;
  avg_session_seconds: number;
}

interface SecondaryMetricsProps {
  data: SecondaryMetricsData;
}

export function SecondaryMetrics({ data }: SecondaryMetricsProps) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {/* Net Booking Value */}
      <div className="rounded-card border border-brand-line bg-white p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-mute">
          <PiggyBank className="h-3.5 w-3.5 text-brand-secondary" />
          Net booking value
        </div>
        <div className="mt-2 font-display text-xl font-bold text-brand-ink">
          R {formatNumber(data.net_value)}
        </div>
        <div className="mt-0.5 text-[11px] text-brand-secondary">
          R {formatNumber(data.commission_saved)} commission saved
        </div>
      </div>

      {/* Average Rating */}
      <div className="rounded-card border border-brand-line bg-white p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-mute">
          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
          Avg rating
        </div>
        <div className="mt-2 font-display text-xl font-bold text-brand-ink">
          {data.avg_rating.toFixed(2)}
        </div>
        <div className="mt-0.5 text-[11px] text-brand-mute">
          {formatNumber(data.review_count)} reviews
          {data.rating_delta !== null && (
            <>
              {" "}
              ·{" "}
              <span
                className={
                  data.rating_delta >= 0 ? "text-green-700" : "text-red-700"
                }
              >
                {data.rating_delta >= 0 ? "+" : ""}
                {data.rating_delta.toFixed(2)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Cancellation Rate */}
      <div className="rounded-card border border-brand-line bg-white p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-mute">
          <XCircle className="h-3.5 w-3.5 text-status-cancelled" />
          Cancellation rate
        </div>
        <div className="mt-2 font-display text-xl font-bold text-brand-ink">
          {data.cancellation_rate.toFixed(1)}%
        </div>
        <div className="mt-0.5 text-[11px] text-brand-mute">
          {data.cancellation_count} of {data.total_bookings}
        </div>
      </div>

      {/* Refund Rate */}
      <div className="rounded-card border border-brand-line bg-white p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-mute">
          <RotateCcw className="h-3.5 w-3.5 text-status-cancelled" />
          Refund rate
        </div>
        <div className="mt-2 font-display text-xl font-bold text-brand-ink">
          {data.refund_rate.toFixed(1)}%
        </div>
        <div className="mt-0.5 text-[11px] text-brand-mute">
          R {formatNumber(data.refund_amount)} · {data.refund_count} refunds
        </div>
      </div>

      {/* Quotes Sent */}
      <div className="rounded-card border border-brand-line bg-white p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-mute">
          <FileText className="h-3.5 w-3.5 text-brand-secondary" />
          Quotes sent
        </div>
        <div className="mt-2 font-display text-xl font-bold text-brand-ink">
          {formatNumber(data.quotes_sent)}
        </div>
        <div className="mt-0.5 text-[11px] text-brand-mute">
          {data.acceptance_rate.toFixed(1)}% accepted
        </div>
      </div>

      {/* Listing Views */}
      <div className="rounded-card border border-brand-line bg-white p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-mute">
          <Eye className="h-3.5 w-3.5 text-brand-secondary" />
          Listing views
        </div>
        <div className="mt-2 font-display text-xl font-bold text-brand-ink">
          {formatNumber(data.listing_views)}
        </div>
        <div className="mt-0.5 text-[11px] text-brand-mute">
          avg {formatSessionDuration(data.avg_session_seconds)} on page
        </div>
      </div>
    </section>
  );
}

// Helper: Format number with K/M suffix
function formatNumber(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(2) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(0) + "k";
  }
  return value.toString();
}

// Helper: Format session duration (seconds to "2m 14s" format)
function formatSessionDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}
