"use client";

import { XCircle, RotateCcw, Clock, AlertTriangle } from "lucide-react";

interface CancellationReason {
  reason: string;
  count: number;
}

interface RefundsCancellationsData {
  refund_count: number;
  refund_amount: number;
  refund_rate: number;
  cancellation_count: number;
  cancellation_revenue_impact: number;
  cancellation_rate: number;
  cancellation_reasons: CancellationReason[];
  avg_refund_turnaround_days: number;
}

interface RefundsCancellationsProps {
  data: RefundsCancellationsData;
}

const REASON_COLORS: Record<string, string> = {
  "Guest request": "#3B82F6", // blue
  "Host unavailable": "#F59E0B", // amber
  "Payment failed": "#EF4444", // red
  "Policy violation": "#8B5CF6", // purple
  "Other": "#9CA3AF", // gray
};

export function RefundsCancellations({ data }: RefundsCancellationsProps) {
  const totalReasons = data.cancellation_reasons.reduce((sum, r) => sum + r.count, 0);
  const maxReasonCount = Math.max(...data.cancellation_reasons.map((r) => r.count), 1);

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 lg:p-6">
      {/* Header */}
      <div className="mb-5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
          Refunds & Cancellations
        </div>
        <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
          {data.cancellation_count + data.refund_count} total issues
        </h3>
        <div className="mt-0.5 text-xs text-brand-mute">
          Track and minimize revenue loss
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        {/* Cancellations Card */}
        <div className="rounded border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2 text-xs text-red-700">
            <XCircle className="h-3.5 w-3.5" />
            Cancellations
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-red-900">
            {data.cancellation_rate}%
          </div>
          <div className="mt-1 text-xs text-red-700">
            {data.cancellation_count} bookings · R{" "}
            {formatCurrency(data.cancellation_revenue_impact)} impact
          </div>
        </div>

        {/* Refunds Card */}
        <div className="rounded border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-xs text-amber-700">
            <RotateCcw className="h-3.5 w-3.5" />
            Refunds
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-amber-900">
            {data.refund_rate}%
          </div>
          <div className="mt-1 text-xs text-amber-700">
            {data.refund_count} issued · R {formatCurrency(data.refund_amount)}
          </div>
        </div>
      </div>

      {/* Refund Turnaround */}
      <div className="mb-5 flex items-center justify-between rounded border border-brand-line bg-brand-light p-3">
        <div className="flex items-center gap-2 text-xs text-brand-mute">
          <Clock className="h-3.5 w-3.5" />
          Avg refund turnaround
        </div>
        <div className="text-sm font-bold text-brand-ink">
          {data.avg_refund_turnaround_days.toFixed(1)} days
        </div>
      </div>

      {/* Cancellation Reasons Breakdown */}
      {totalReasons > 0 && (
        <div>
          <div className="mb-3 text-xs font-medium text-brand-ink">
            Cancellation reasons
          </div>

          <div className="space-y-2">
            {data.cancellation_reasons
              .filter((reason) => reason.count > 0)
              .map((reason) => {
                const percentage = totalReasons > 0 ? (reason.count / totalReasons) * 100 : 0;
                const barWidth = (reason.count / maxReasonCount) * 100;
                const color = REASON_COLORS[reason.reason] || REASON_COLORS["Other"];

                return (
                  <div key={reason.reason}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-brand-ink">{reason.reason}</span>
                      <span className="font-semibold text-brand-ink">
                        {reason.count} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-brand-light">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: color,
                          minWidth: reason.count > 0 ? "4px" : "0",
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Insight */}
      <div className="mt-5 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        <div className="text-xs text-amber-900">
          <strong className="font-semibold">Action needed:</strong>{" "}
          {data.cancellation_rate > 10
            ? `High cancellation rate (${data.cancellation_rate}%). Review policies and guest communication.`
            : data.refund_rate > 5
            ? `Refund rate at ${data.refund_rate}%. Investigate common refund causes.`
            : data.avg_refund_turnaround_days > 7
            ? `Refund turnaround is ${data.avg_refund_turnaround_days.toFixed(1)} days. Aim for <7 days to improve guest satisfaction.`
            : "Low cancellation and refund rates. Maintain current service quality."}
        </div>
      </div>
    </div>
  );
}

// Helper: Format currency with spaces for thousands
function formatCurrency(value: number): string {
  return value
    .toLocaleString("en-ZA", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    .replace(/,/g, " ");
}
