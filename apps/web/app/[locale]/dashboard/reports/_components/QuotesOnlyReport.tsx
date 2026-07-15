"use client";

import { FileText, CheckCircle, Percent, Banknote, Coins } from "lucide-react";

import { LookingForStats } from "./LookingForStats";

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

export interface QuotesOnlyReportData {
  periodLabel: string;
  quotes: {
    sent: number;
    accepted: number;
    acceptanceRate: number;
    valueAccepted: number;
  };
  credits: { balance: number; spent: number; granted: number };
  lookingFor: LookingForStatsData | null;
}

export function QuotesOnlyReport({ data }: { data: QuotesOnlyReportData }) {
  return (
    <div className="max-w-[1520px] space-y-6 px-5 py-6 lg:space-y-7 lg:px-8 lg:py-7">
      <section>
        <h2 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-[28px]">
          Quotes performance
        </h2>
        <p className="mt-1 text-sm text-brand-mute">
          Your quoting activity, acceptance and credits · {data.periodLabel}
        </p>
      </section>

      {/* Headline KPIs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
        <Kpi
          icon={<FileText className="h-3.5 w-3.5" />}
          label="Quotes sent"
          value={String(data.quotes.sent)}
        />
        <Kpi
          icon={<CheckCircle className="h-3.5 w-3.5" />}
          label="Accepted"
          value={String(data.quotes.accepted)}
        />
        <Kpi
          icon={<Percent className="h-3.5 w-3.5" />}
          label="Acceptance rate"
          value={`${data.quotes.acceptanceRate.toFixed(0)}%`}
        />
        <Kpi
          icon={<Banknote className="h-3.5 w-3.5" />}
          label="Value accepted"
          value={`R ${fmt(data.quotes.valueAccepted)}`}
        />
        <Kpi
          icon={<Coins className="h-3.5 w-3.5" />}
          label="Credits balance"
          value={String(data.credits.balance)}
          sub={`${data.credits.spent} spent · ${data.credits.granted} added`}
        />
      </section>

      {/* Looking-For performance (reuses the host LF panel) */}
      {data.lookingFor && <LookingForStats data={data.lookingFor} />}
    </div>
  );
}

function Kpi({
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
    <div className="rounded-card border border-brand-line bg-white p-5">
      <div className="flex items-center gap-2">
        <div className="inline-flex h-7 w-7 items-center justify-center rounded bg-brand-accent text-brand-secondary">
          {icon}
        </div>
        <span className="text-xs font-medium text-brand-mute">{label}</span>
      </div>
      <div className="mt-3 font-display text-2xl font-bold text-brand-ink">
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-brand-mute">{sub}</div> : null}
    </div>
  );
}

function fmt(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "0";
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + "M";
  if (value >= 1000) return (value / 1000).toFixed(1) + "k";
  return value.toFixed(0);
}
