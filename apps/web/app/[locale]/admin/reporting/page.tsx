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
import { GmvTrendChart } from "./_components/GmvTrendChart";
import { SubscriberMovementChart } from "./_components/SubscriberMovementChart";

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

  const revenueTotal = report.monthly.reduce((s, m) => s + m.revenue, 0);
  const gmvTotal = report.monthly.reduce((s, m) => s + m.gmv, 0);

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
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <AdminKpiCard
          label={`Collected · ${report.rangeLabel}`}
          value={zar(k.collectedPeriod)}
          sub={
            k.momRevenue !== null
              ? `${k.momRevenue >= 0 ? "▲" : "▼"} ${Math.abs(k.momRevenue)}% MoM`
              : undefined
          }
        />
        <AdminKpiCard
          label="Collected · all-time"
          value={zar(k.collectedAllTime)}
        />
        <AdminKpiCard label="Outstanding" value={zar(k.outstanding)} />
        <AdminKpiCard label="Refunded" value={zar(k.refunded)} />
        <AdminKpiCard
          label="VAT collected"
          value={zar(k.vatCollected)}
          sub={`output tax · ${report.rangeLabel}`}
        />
        <AdminKpiCard
          label="Take-rate"
          value={`${k.takeRate}%`}
          sub="Wielo revenue ÷ GMV"
        />
      </section>

      {/* Charts */}
      <section className="grid gap-5 lg:grid-cols-3">
        <RevenueAreaChart
          data={report.monthly.map((m) => ({
            label: m.label,
            revenue: m.revenue,
          }))}
          total={revenueTotal}
          months={report.monthsShown}
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <AdminKpiCard label="Total users" value={k.totalUsers} />
          <AdminKpiCard label="Hosts" value={k.hosts} />
          <AdminKpiCard label="Guests" value={k.guests} />
          <AdminKpiCard
            label={`New · ${report.rangeLabel}`}
            value={k.newUsersPeriod}
            sub={
              k.momSignups !== null
                ? `${k.momSignups >= 0 ? "▲" : "▼"} ${Math.abs(k.momSignups)}% MoM`
                : undefined
            }
          />
          <AdminKpiCard label="Active listings" value={k.activeListings} />
          <AdminKpiCard label="Bookings" value={k.bookingCount} />
          <AdminKpiCard label="GMV processed" value={zar(k.gmv)} />
        </div>
        <p className="mt-3 text-[11px] text-brand-mute">
          GMV = booking value flowing host↔guest
          (confirmed/checked-in/completed). Wielo never holds this — it&apos;s a
          platform-scale metric, not Wielo income.
        </p>
      </section>

      {/* Retention & lifetime value */}
      <section>
        <h2 className="mb-3 font-display text-base font-bold text-brand-ink">
          Retention & lifetime value
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <AdminKpiCard
            label="Lifetime rev / host"
            value={zar(k.lifetimeRevenuePerHost)}
            sub="collected ÷ paying hosts"
          />
          <AdminKpiCard
            label="ARR / account"
            value={zar(k.arrPerAccount)}
            sub="ARPU × 12"
          />
          <AdminKpiCard
            label="Est. LTV"
            value={k.estimatedLtv !== null ? zar(k.estimatedLtv) : "—"}
            sub="ARPU ÷ monthly churn"
          />
          <AdminKpiCard
            label="Avg lifespan"
            value={
              k.avgLifespanMonths !== null ? `${k.avgLifespanMonths} mo` : "—"
            }
            sub="1 ÷ monthly churn"
          />
          <AdminKpiCard
            label="Monthly churn"
            value={`${k.monthlyChurnRate}%`}
            sub="cancelled ÷ active · 30d"
          />
        </div>
        <div className="mt-3 grid gap-5 lg:grid-cols-3">
          <SubscriberMovementChart data={report.subscriberMovement} />
          <div className="rounded-card border border-brand-line bg-white p-5 shadow-card lg:p-6">
            <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
              Lifetime & recurring
            </div>
            <div className="mt-4 space-y-3">
              <MiniStat label="MRR" value={zar(k.mrr)} />
              <MiniStat label="ARR" value={zar(k.arr)} />
              <MiniStat label="ARPU" value={zar(k.arpu)} />
              <MiniStat
                label="Collected all-time"
                value={zar(k.collectedAllTime)}
              />
              <MiniStat label="Paying hosts" value={String(k.payingHosts)} />
            </div>
            <p className="mt-4 text-[11px] text-brand-mute">
              LTV &amp; lifespan are estimates from current ARPU and last-30-day
              churn — they sharpen as more subscription history accrues.
            </p>
          </div>
        </div>
      </section>

      {/* GMV trend + booking-status distribution */}
      <section className="grid gap-5 lg:grid-cols-3">
        <GmvTrendChart
          data={report.monthly.map((m) => ({ label: m.label, gmv: m.gmv }))}
          total={gmvTotal}
          months={report.monthsShown}
        />
        <BreakdownCard
          title="Bookings by status"
          subtitle="All bookings · all-time"
          empty="No bookings yet."
          rows={report.bookingStatus.map((b) => ({
            key: b.status,
            label: b.status.replace(/_/g, " "),
            meta: "",
            value: String(b.count),
          }))}
        />
      </section>

      {/* Payment methods + credit notes */}
      <section className="grid gap-5 lg:grid-cols-2">
        <BreakdownCard
          title="Payment methods"
          subtitle={`Collected · ${report.rangeLabel}`}
          empty="No charges in this period."
          rows={report.paymentMethods.map((p) => ({
            key: p.provider,
            label: providerLabel(p.provider),
            meta: `${p.count} ${p.count === 1 ? "charge" : "charges"}`,
            value: zar(p.amount),
          }))}
        />
        <BreakdownCard
          title="Credit notes & refunds"
          subtitle={`${report.rangeLabel} · refunds, credits, adjustments`}
          empty="No credit notes in this period."
          rows={report.creditNotes.map((c) => ({
            key: c.kind,
            label: c.kind.charAt(0).toUpperCase() + c.kind.slice(1),
            meta: `${c.count} ${c.count === 1 ? "note" : "notes"}`,
            value: zar(c.amount),
          }))}
        />
      </section>

      {/* Credits, quotes & affiliate */}
      <section>
        <h2 className="mb-3 font-display text-base font-bold text-brand-ink">
          Credits, quotes & affiliate · {report.rangeLabel}
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <AdminKpiCard label="Credits bought" value={k.creditsPurchased} />
          <AdminKpiCard label="Credits granted" value={k.creditsGranted} />
          <AdminKpiCard label="Credits spent" value={k.creditsSpent} />
          <AdminKpiCard label="Quotes created" value={k.quotesCreated} />
          <AdminKpiCard label="Looking-For posts" value={k.lookingForPosts} />
          <AdminKpiCard
            label="Looking-For quotes"
            value={k.lookingForResponses}
          />
          <AdminKpiCard
            label="Affiliate commissions"
            value={zar(k.affiliateCommissions)}
          />
          <AdminKpiCard
            label="Affiliate payouts"
            value={zar(k.affiliatePayouts)}
          />
        </div>
      </section>

      {/* Geography */}
      {report.geography.length > 0 && (
        <BreakdownCard
          title="Listings by province"
          subtitle="Published listings · all-time"
          empty="No published listings yet."
          rows={report.geography.map((g) => ({
            key: g.province,
            label: g.province,
            meta: "",
            value: `${g.listings} ${g.listings === 1 ? "listing" : "listings"}`,
          }))}
        />
      )}
    </div>
  );
}

// Pretty labels for the payment providers seen on the ledger.
function providerLabel(provider: string): string {
  const map: Record<string, string> = {
    paystack: "Paystack",
    paypal: "PayPal",
    eft: "Manual EFT",
    manual: "Manual EFT",
    credit: "Wielo credit",
    unknown: "Other / unspecified",
  };
  return map[provider.toLowerCase()] ?? provider;
}

// Simple label · meta · value breakdown card, reused across the report.
function BreakdownCard({
  title,
  subtitle,
  rows,
  empty,
}: {
  title: string;
  subtitle: string;
  rows: { key: string; label: string; meta: string; value: string }[];
  empty: string;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card lg:p-6">
      <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
        {title}
      </div>
      <div className="mt-0.5 text-xs text-brand-mute">{subtitle}</div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-brand-mute">{empty}</p>
      ) : (
        <div className="mt-4 space-y-2 border-t border-brand-line pt-4">
          {rows.map((r) => (
            <div
              key={r.key}
              className="flex items-center justify-between text-xs"
            >
              <span className="font-medium text-brand-ink">{r.label}</span>
              <div className="flex items-center gap-3">
                {r.meta ? (
                  <span className="text-brand-mute">{r.meta}</span>
                ) : null}
                <span className="font-semibold text-brand-ink">{r.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-brand-line pb-2 text-sm last:border-0 last:pb-0">
      <span className="text-brand-mute">{label}</span>
      <span className="font-semibold text-brand-ink">{value}</span>
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
