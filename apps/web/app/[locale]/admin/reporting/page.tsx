import { Download } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import {
  buildPlatformReport,
  isReportRange,
  type ReportRange,
} from "@/lib/billing/platform-report";

import { AdminKpiCard } from "../_components/AdminKpiCard";
import { PlanDonutChart } from "./_components/PlanDonutChart";
import { RevenueAreaChart } from "./_components/RevenueAreaChart";
import { UserGrowthChart } from "./_components/UserGrowthChart";

export const dynamic = "force-dynamic";

// Money on a financial report — unlike the plan-pricing helper, a zero value is
// "R 0", never "Free" (there's nothing free about R0 outstanding/refunded/MRR).
function zar(amount: number): string {
  return `R ${Math.round(amount).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}

const RANGES: { key: ReportRange; label: string }[] = [
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "6m", label: "6M" },
  { key: "12m", label: "12M" },
  { key: "ytd", label: "YTD" },
];

export default async function AdminReportingPage({
  searchParams,
}: {
  searchParams?: { range?: string };
}) {
  await requirePermission("subscriptions.edit");

  const range: ReportRange = isReportRange(searchParams?.range)
    ? (searchParams!.range as ReportRange)
    : "12m";

  const report = await buildPlatformReport(range);
  const k = report.kpis;

  const revenueTotal12m = report.monthly.reduce((s, m) => s + m.revenue, 0);

  return (
    <div className="space-y-8">
      {/* Dark hero */}
      <section className="overflow-hidden rounded-card bg-gradient-to-br from-brand-deep via-brand-deep to-[#0a3d2a] p-6 text-white shadow-card lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-accent/80">
              Business reporting
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold lg:text-3xl">
              Wielo at a glance
            </h1>
            <p className="mt-1 max-w-xl text-[13px] text-white/70">
              Recurring revenue, growth and retention — the numbers that show
              how Wielo is performing as a business.
            </p>
          </div>
          <a
            href={`/admin/reporting/pdf?range=${range}`}
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-brand-deep hover:bg-brand-accent"
          >
            <Download className="h-4 w-4" /> Download PDF report
          </a>
        </div>

        {/* Headline metrics inside the hero */}
        <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-card bg-white/10 sm:grid-cols-4">
          <HeroStat label="MRR" value={zar(k.mrr)} />
          <HeroStat label="ARR" value={zar(k.arr)} />
          <HeroStat label="Paying hosts" value={String(k.payingHosts)} />
          <HeroStat label="ARPU" value={zar(k.arpu)} />
        </div>
      </section>

      {/* Range filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-bold text-brand-ink">
          Performance
        </h2>
        <div className="inline-flex rounded-full border border-brand-line bg-white p-1 text-[11px] font-medium shadow-card">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/admin/reporting?range=${r.key}`}
              className={`rounded-full px-3.5 py-1.5 transition-colors ${
                range === r.key
                  ? "bg-brand-primary text-white"
                  : "text-brand-mute hover:text-brand-ink"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Revenue KPI row (period-aware) */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminKpiCard
          label={`Collected · ${report.rangeLabel}`}
          value={zar(k.collectedPeriod)}
        />
        <AdminKpiCard
          label="Collected · all-time"
          value={zar(k.collectedAllTime)}
        />
        <AdminKpiCard label="Outstanding" value={zar(k.outstanding)} />
        <AdminKpiCard label="Refunded" value={zar(k.refunded)} />
      </section>

      {/* Charts */}
      <section className="grid gap-5 lg:grid-cols-3">
        <RevenueAreaChart
          data={report.monthly.map((m) => ({
            label: m.label,
            revenue: m.revenue,
          }))}
          total={revenueTotal12m}
        />
        <PlanDonutChart data={report.plans} />
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <UserGrowthChart
          data={report.monthly.map((m) => ({
            label: m.label,
            hosts: m.hosts,
            guests: m.guests,
          }))}
          totalNew={k.newUsersPeriod}
        />
        {/* Retention + funnel */}
        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card lg:col-span-2 lg:p-6">
          <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
            Retention & funnel
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <AdminKpiCard label="On trial" value={String(k.trials)} />
            <AdminKpiCard
              label="Trial → paid"
              value={`${k.trialConversion}%`}
            />
            <AdminKpiCard label="Churned" value={String(k.churned)} />
            <AdminKpiCard label="Churn rate" value={`${k.churnRate}%`} />
          </div>
          <div className="mt-5 border-t border-brand-line pt-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-brand-mute">
              Subscriptions by status
            </div>
            <div className="space-y-2">
              {report.statusFunnel.length === 0 ? (
                <p className="text-sm text-brand-mute">No subscriptions yet.</p>
              ) : (
                report.statusFunnel.map((s) => (
                  <div
                    key={s.status}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="capitalize text-brand-ink">
                      {s.status.replace(/_/g, " ")}
                    </span>
                    <span className="font-semibold text-brand-ink">
                      {s.count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Growth + platform volume */}
      <section>
        <h2 className="mb-3 font-display text-base font-bold text-brand-ink">
          Growth & platform volume
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <AdminKpiCard label="Total users" value={k.totalUsers} />
          <AdminKpiCard label="Hosts" value={k.hosts} />
          <AdminKpiCard label="Guests" value={k.guests} />
          <AdminKpiCard
            label={`New · ${report.rangeLabel}`}
            value={k.newUsersPeriod}
          />
          <AdminKpiCard label="Active listings" value={k.activeListings} />
          <AdminKpiCard label="GMV processed" value={zar(k.gmv)} />
        </div>
        <p className="mt-3 text-[11px] text-brand-mute">
          GMV = booking value flowing host↔guest
          (confirmed/checked-in/completed). Wielo never holds this — it&apos;s a
          platform-scale metric, not Wielo income.
        </p>
      </section>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-brand-deep/40 p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-accent/70">
        {label}
      </div>
      <div className="num mt-1 font-display text-xl font-bold leading-none text-white">
        {value}
      </div>
    </div>
  );
}
