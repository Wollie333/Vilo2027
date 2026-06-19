import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import {
  ArrowLeft,
  CalendarDays,
  Eye,
  MousePointerClick,
  Pencil,
  ReceiptText,
  Sparkles,
  Tag,
  TicketCheck,
  TrendingUp,
  Users,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import { requireHost } from "@/lib/host/current";
import { formatMoney } from "@/lib/format";
import {
  loadSpecialReport,
  type SpecialBookingRow,
  type SpecialReport,
} from "@/lib/specials/reporting";

type SpecialsT = Awaited<ReturnType<typeof getTranslations>>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("specials");
  return { title: t("rpMetaTitle") };
}

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-brand-light text-brand-mute",
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
  archived: "bg-brand-light text-brand-mute",
};

function humanise(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Special lifecycle status → label (reuses the shared status_* keys). */
function specialStatusLabel(t: SpecialsT, status: string): string {
  return t.has(`status_${status}`) ? t(`status_${status}`) : humanise(status);
}

/** Booking status → label (rpStat_* with a humanised fallback for any unknown). */
function bookingStatusLabel(t: SpecialsT, status: string): string {
  return t.has(`rpStat_${status}`) ? t(`rpStat_${status}`) : humanise(status);
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(d: string): string {
  return new Date(d).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function SpecialReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const host = await requireHost();
  if (!host.ok) redirect(`/login?next=/dashboard/specials/${id}`);

  const report = await loadSpecialReport(id, host.hostId);
  if (!report) notFound();

  const t = await getTranslations("specials");

  const hasSavings =
    report.savingsAmount != null && report.savingsAmount > 0 ? true : false;

  return (
    <div className="space-y-6">
      <Header report={report} t={t} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={ReceiptText}
          label={t("rpKpiRevenue")}
          value={formatMoney(report.revenue, report.currency)}
          sub={t("rpKpiRevenueSub", { count: report.revenueBookings })}
        />
        <Kpi
          icon={TicketCheck}
          label={t("rpKpiBookings")}
          value={String(report.totalBookings)}
          sub={t("rpKpiBookingsSub")}
        />
        <Kpi
          icon={TrendingUp}
          label={t("rpKpiRedeemed")}
          value={`${report.redemptionsUsed} / ${report.quantity}`}
          sub={t("rpKpiRedeemedSub", {
            pct: report.sellThroughPct,
            remaining: report.remaining,
          })}
        />
        <Kpi
          icon={Tag}
          label={t("rpKpiSavings")}
          value={
            hasSavings
              ? `${formatMoney(report.savingsAmount, report.currency)}`
              : "—"
          }
          sub={
            hasSavings && report.savingsPct != null
              ? t("rpKpiSavingsSub", {
                  pct: report.savingsPct,
                  was: formatMoney(report.wasPrice, report.currency),
                })
              : t("rpKpiSavingsNone")
          }
        />
      </div>

      <SellThrough report={report} t={t} />

      {report.byStatus.length > 0 ? (
        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <h2 className="font-display text-sm font-bold text-brand-ink">
            {t("rpFunnel")}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {report.byStatus.map((s) => (
              <span
                key={s.status}
                className="inline-flex items-center gap-1.5 rounded-pill bg-brand-light px-3 py-1 text-[12.5px] font-medium text-brand-ink"
              >
                {bookingStatusLabel(t, s.status)}
                <span className="font-bold text-brand-primary">{s.count}</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <Traffic report={report} t={t} />

      <RecentBookings rows={report.recent} t={t} />

      <p className="px-1 text-[12px] leading-relaxed text-brand-mute">
        {t("rpFootnote")}
      </p>
    </div>
  );
}

function Traffic({ report, t }: { report: SpecialReport; t: SpecialsT }) {
  return (
    <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-bold text-brand-ink">
          {t("rpTraffic")}
        </h2>
        <span className="text-[12.5px] font-semibold text-brand-ink">
          {t("rpViewToBooking", { pct: report.viewToBookingPct })}
        </span>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Stat
          icon={Eye}
          label={t("rpPageViews")}
          value={String(report.views)}
          sub={t("rpUniqueViewers", { count: report.uniqueViewers })}
        />
        <Stat
          icon={MousePointerClick}
          label={t("rpBookClicks")}
          value={String(report.bookClicks)}
          sub={t("rpBookClicksSub")}
        />
        <Stat
          icon={Users}
          label={t("rpBookingsStat")}
          value={String(report.totalBookings)}
          sub={
            report.uniqueViewers > 0
              ? t("rpOfViewers", { pct: report.viewToBookingPct })
              : t("rpNoViews")
          }
        />
      </div>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-light text-brand-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
          {label}
        </div>
        <div className="font-display text-xl font-bold text-brand-ink">
          {value}
        </div>
        <div className="text-[12px] text-brand-mute">{sub}</div>
      </div>
    </div>
  );
}

function Header({ report, t }: { report: SpecialReport; t: SpecialsT }) {
  const statusCls = STATUS_STYLE[report.status] ?? STATUS_STYLE.draft;
  return (
    <section
      className="relative overflow-hidden rounded-card border border-brand-line p-7 text-white shadow-card md:p-8"
      style={{
        backgroundImage:
          "linear-gradient(145deg, #030806 0%, #0a1510 50%, #051209 100%)",
      }}
    >
      <div
        aria-hidden
        className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-brand-primary/30 blur-3xl"
      />
      <div className="relative">
        <Link
          href="/dashboard/specials"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-accent/70 transition-colors hover:text-brand-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("rpAllSpecials")}
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent backdrop-blur">
              <Sparkles className="h-3 w-3" />
              {t("rpBadge")}
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold leading-tight tracking-tight md:text-3xl">
              {report.title}
            </h1>
            <p className="mt-1 text-[13.5px] text-brand-accent/80">
              {report.propertyName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-pill px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide ${statusCls}`}
            >
              {specialStatusLabel(t, report.status)}
            </span>
            <Link
              href={`/dashboard/specials/${report.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-white px-3.5 py-2 text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-accent"
            >
              <Pencil className="h-3.5 w-3.5" />
              {t("rpEdit")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof ReceiptText;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-center gap-2 text-brand-mute">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="mt-2 font-display text-2xl font-bold text-brand-ink">
        {value}
      </div>
      <div className="mt-0.5 text-[12px] text-brand-mute">{sub}</div>
    </div>
  );
}

function SellThrough({ report, t }: { report: SpecialReport; t: SpecialsT }) {
  const width = Math.min(100, report.sellThroughPct);
  const soldOut = report.remaining <= 0;
  return (
    <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-bold text-brand-ink">
          {t("rpSellThrough")}
        </h2>
        <span
          className={`text-[12.5px] font-semibold ${
            soldOut ? "text-red-600" : "text-brand-ink"
          }`}
        >
          {t("rpRedeemedOf", {
            used: report.redemptionsUsed,
            total: report.quantity,
          })}
          {soldOut ? t("rpSoldOut") : ""}
        </span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-pill bg-brand-light">
        <div
          className={`h-full rounded-pill ${
            soldOut ? "bg-red-500" : "bg-brand-primary"
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
    </section>
  );
}

function RecentBookings({
  rows,
  t,
}: {
  rows: SpecialBookingRow[];
  t: SpecialsT;
}) {
  return (
    <section className="rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-brand-line px-5 py-4">
        <CalendarDays className="h-4 w-4 text-brand-mute" />
        <h2 className="font-display text-sm font-bold text-brand-ink">
          {t("rpRecent")}
        </h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-brand-mute">
          {t("rpRecentEmpty")}
        </p>
      ) : (
        <div className="divide-y divide-brand-line">
          {rows.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/bookings/${b.id}`}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-brand-light"
            >
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold text-brand-ink">
                  {b.guestName}
                </div>
                <div className="mt-0.5 text-[12px] text-brand-mute">
                  {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}
                  {b.bookedVia ? t("rpVia", { via: b.bookedVia }) : ""}
                  {` · ${fmtDateTime(b.createdAt)}`}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-pill bg-brand-light px-2.5 py-0.5 text-[11px] font-medium text-brand-ink">
                  {bookingStatusLabel(t, b.status)}
                </span>
                <span className="text-[13.5px] font-semibold text-brand-ink">
                  {formatMoney(b.totalAmount, b.currency)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
