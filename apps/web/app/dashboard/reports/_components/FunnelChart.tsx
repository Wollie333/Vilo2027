"use client";

import { Eye, MessageSquare, FileText, CheckCircle, TrendingDown } from "lucide-react";

interface FunnelData {
  views: number;
  inquiries: number;
  quotes: number;
  bookings: number;
  conversion_rates: {
    views_to_inquiries: number;
    inquiries_to_quotes: number;
    quotes_to_bookings: number;
    views_to_bookings: number;
  };
}

interface FunnelChartProps {
  data: FunnelData;
}

interface FunnelStep {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

export function FunnelChart({ data }: FunnelChartProps) {
  const steps: FunnelStep[] = [
    {
      label: "Views",
      value: data.views,
      icon: Eye,
      color: "#10B981",
      bgColor: "#D1FAE5",
    },
    {
      label: "Inquiries",
      value: data.inquiries,
      icon: MessageSquare,
      color: "#3B82F6",
      bgColor: "#DBEAFE",
    },
    {
      label: "Quotes",
      value: data.quotes,
      icon: FileText,
      color: "#F59E0B",
      bgColor: "#FEF3C7",
    },
    {
      label: "Bookings",
      value: data.bookings,
      icon: CheckCircle,
      color: "#8B5CF6",
      bgColor: "#EDE9FE",
    },
  ];

  const maxValue = Math.max(data.views, data.inquiries, data.quotes, data.bookings, 1);

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 lg:p-6">
      {/* Header */}
      <div className="mb-5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
          Conversion funnel
        </div>
        <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
          {formatNumber(data.views)} views → {formatNumber(data.bookings)} bookings
        </h3>
        <div className="mt-0.5 text-xs text-brand-mute">
          Overall conversion: {(data.conversion_rates.views_to_bookings ?? 0).toFixed(1)}% ·
          Track guest journey from discovery to booking
        </div>
      </div>

      {/* Funnel Bars */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const percentage = (step.value / maxValue) * 100;
          const Icon = step.icon;

          // Get conversion rate to next step
          let conversionRate: number | null = null;
          if (index === 0) conversionRate = data.conversion_rates.views_to_inquiries;
          if (index === 1) conversionRate = data.conversion_rates.inquiries_to_quotes;
          if (index === 2) conversionRate = data.conversion_rates.quotes_to_bookings;

          return (
            <div key={step.label}>
              {/* Bar */}
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded"
                  style={{ backgroundColor: step.bgColor }}
                >
                  <div style={{ color: step.color }}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>

                {/* Bar container */}
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-brand-ink">{step.label}</span>
                    <span className="font-semibold text-brand-ink">
                      {formatNumber(step.value)}
                    </span>
                  </div>
                  <div className="h-6 overflow-hidden rounded bg-brand-light">
                    <div
                      className="flex h-full items-center justify-end rounded px-2 text-[10px] font-semibold text-white transition-all"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: step.color,
                        minWidth: step.value > 0 ? "24px" : "0",
                      }}
                    >
                      {percentage >= 15 && `${percentage.toFixed(0)}%`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Conversion Rate to Next Step */}
              {conversionRate !== null && conversionRate !== undefined && (
                <div className="ml-11 mt-2 flex items-center gap-1.5 text-xs text-brand-mute">
                  <TrendingDown className="h-3 w-3" />
                  <span>
                    {conversionRate.toFixed(1)}% convert to next step
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-brand-line pt-4">
        <div className="text-center">
          <div className="text-xs text-brand-mute">View-to-Inquiry</div>
          <div className="mt-1 font-display text-lg font-bold text-brand-ink">
            {(data.conversion_rates.views_to_inquiries ?? 0).toFixed(1)}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-brand-mute">Quote-to-Book</div>
          <div className="mt-1 font-display text-lg font-bold text-brand-ink">
            {(data.conversion_rates.quotes_to_bookings ?? 0).toFixed(1)}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-brand-mute">Overall</div>
          <div className="mt-1 font-display text-lg font-bold text-brand-primary">
            {(data.conversion_rates.views_to_bookings ?? 0).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper: Format number with K/M suffix
function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "0";
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "k";
  }
  return value.toString();
}
