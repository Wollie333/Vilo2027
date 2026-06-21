import {
  ArrowUpRight,
  Check,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Feather,
  Gauge,
  Globe,
  Image as ImageIcon,
  Newspaper,
  Palette,
  Pencil,
  SearchCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { AnalyticsRange } from "@/lib/website/analytics";

import { loadOverviewData } from "../loadOverviewData";
import { CopyLinkButton } from "../_components/overview/CopyLinkButton";
import { RangeTabs } from "../_components/overview/RangeTabs";
import { TrafficChart } from "../_components/overview/TrafficChart";

export const dynamic = "force-dynamic";

const RANGE_DAYS: Record<AnalyticsRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function Delta({ value, label }: { value: number | null; label: string }) {
  if (value == null) return null;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[12px] font-medium ${
        up ? "text-emerald-600" : "text-red-500"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {up ? "+" : ""}
      {value}% {label}
    </span>
  );
}

export default async function WebsiteOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ websiteId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { websiteId } = await params;
  const sp = await searchParams;
  const range: AnalyticsRange =
    sp.range === "7d" || sp.range === "90d" ? sp.range : "30d";

  const [t, format, data] = await Promise.all([
    getTranslations("website"),
    getFormatter(),
    loadOverviewData(websiteId, range),
  ]);
  if (!data) notFound();

  const {
    site,
    analytics,
    publicUrl,
    previewUrl,
    isLive,
    signals,
    performance,
  } = data;
  const base = `/dashboard/website/${websiteId}`;

  const perfColor =
    performance.grade === "good"
      ? "text-emerald-600"
      : performance.grade === "fair"
        ? "text-amber-600"
        : "text-red-500";
  const perfBar =
    performance.grade === "good"
      ? "bg-emerald-500"
      : performance.grade === "fair"
        ? "bg-amber-500"
        : "bg-red-500";
  const perfGradeKey =
    performance.grade === "good"
      ? "perfGradeGood"
      : performance.grade === "fair"
        ? "perfGradeFair"
        : "perfGradePoor";

  const publishedWhen = site.publishedAt
    ? format.dateTime(new Date(site.publishedAt), {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  const steps = [
    {
      key: "stepBrandTitle",
      done: Boolean(site.brand.logo_path),
      seg: "brand",
    },
    { key: "stepThemeTitle", done: Boolean(site.theme.accent), seg: "theme" },
    { key: "stepPagesTitle", done: site.counts.pages > 0, seg: "pages" },
    { key: "stepSeoTitle", done: Boolean(site.seo.title), seg: "seo" },
    { key: "stepPublishTitle", done: isLive, seg: "" },
  ];

  const stats = [
    {
      key: "statVisitors",
      value: format.number(analytics.visitors),
      delta: analytics.deltas.visitors,
    },
    {
      key: "statPageviews",
      value: format.number(analytics.pageviews),
      delta: analytics.deltas.pageviews,
    },
    {
      key: "statBookingClicks",
      value: format.number(analytics.bookingClicks),
      delta: analytics.deltas.bookingClicks,
    },
    {
      key: "statConversion",
      value: `${Math.round(analytics.conversion * 100)}%`,
      delta: null,
    },
  ];

  const quickLinks = [
    { seg: "brand", key: "tabBrand", icon: ImageIcon },
    { seg: "theme", key: "tabTheme", icon: Palette },
    { seg: "pages", key: "tabPages", icon: Feather },
    { seg: "blog", key: "tabBlog", icon: Newspaper },
    { seg: "domain", key: "tabDomain", icon: Globe },
    { seg: "seo", key: "tabSeo", icon: SearchCheck },
  ];

  const deviceTotal = analytics.devices.desktop + analytics.devices.mobile;
  const desktopPct =
    deviceTotal > 0
      ? Math.round((analytics.devices.desktop / deviceTotal) * 100)
      : 0;

  return (
    <div className="space-y-5">
      {/* ── Status hero + checklist ───────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
          <div className="flex items-center gap-2.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isLive ? "bg-emerald-500" : "bg-brand-mute/40"
              }`}
            />
            <span className="font-display text-[15px] font-bold text-brand-ink">
              {isLive ? t("statusLiveTitle") : t("statusDraftTitle")}
            </span>
          </div>

          <a
            href={isLive ? publicUrl : previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-3 inline-flex items-center gap-2 font-mono text-[15px] text-brand-secondary hover:text-brand-primary"
          >
            <Globe className="h-4 w-4" />
            {publicUrl.replace(/^https?:\/\//, "")}
            <ArrowUpRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
          </a>
          <p className="mt-2 text-[12.5px] text-brand-mute">
            {isLive && publishedWhen
              ? `${t("ovLastPublished", { when: publishedWhen })} · ${t("ovAutoSaved")}`
              : t("ovDraftHint")}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <a
              href={isLive ? publicUrl : previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light"
            >
              <ExternalLink className="h-4 w-4 text-brand-mute" />
              {t("ovVisitSite")}
            </a>
            <Link
              href={`${base}/pages`}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light"
            >
              <Pencil className="h-4 w-4 text-brand-mute" />
              {t("ovEditPages")}
            </Link>
            <CopyLinkButton url={publicUrl} />
          </div>
        </section>

        {/* Set-up checklist (deep-linked) */}
        <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
          <h2 className="font-display text-lg font-bold text-brand-ink">
            {t("checklistTitle")}
          </h2>
          <ul className="mt-4 space-y-1">
            {steps.map((s) => (
              <li key={s.key}>
                <Link
                  href={s.seg ? `${base}/${s.seg}` : base}
                  className="group flex items-center justify-between gap-3 rounded-[8px] px-2 py-1.5 transition hover:bg-brand-light/60"
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        s.done
                          ? "bg-brand-primary text-white"
                          : "border border-brand-line text-transparent"
                      }`}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span
                      className={`text-sm ${
                        s.done
                          ? "text-brand-mute line-through"
                          : "font-medium text-brand-ink"
                      }`}
                    >
                      {t(s.key)}
                    </span>
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-brand-mute opacity-0 transition group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ── Traffic dashboard ─────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-line px-5 py-3.5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
                {t("ovTrafficTitle")} ·{" "}
                {t("ovTrafficSub", { days: RANGE_DAYS[range] })}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-display text-[20px] font-bold text-brand-ink">
                  {format.number(analytics.visitors)}
                </span>
                <Delta
                  value={analytics.deltas.visitors}
                  label={t("ovVsPrev")}
                />
              </div>
            </div>
            <RangeTabs value={range} />
          </div>

          {analytics.hasData ? (
            <div className="px-5 pt-4">
              <TrafficChart trend={analytics.trend} />
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-brand-mute">
              {t("ovNoTraffic")}
            </p>
          )}

          <dl className="grid grid-cols-2 gap-px border-t border-brand-line bg-brand-line sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.key} className="bg-white p-4">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
                  {t(s.key)}
                </dt>
                <dd className="mt-1 font-display text-[16px] font-bold text-brand-ink">
                  {s.value}
                </dd>
                {s.delta != null ? <Delta value={s.delta} label="" /> : null}
              </div>
            ))}
          </dl>
        </section>

        {/* Top pages */}
        <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <div className="border-b border-brand-line px-5 py-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
              {t("ovTopPages")}
            </div>
          </div>
          {analytics.topPages.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-brand-mute">
              {t("ovTopPagesEmpty")}
            </p>
          ) : (
            <ul className="divide-y divide-brand-line">
              {analytics.topPages.map((p) => (
                <li
                  key={p.path}
                  className="flex items-center gap-3 px-5 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-brand-mute">
                    {p.path}
                  </span>
                  <span className="font-display text-[13px] font-bold text-brand-ink">
                    {format.number(p.views)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Sources + devices ─────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <div className="border-b border-brand-line px-5 py-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
              {t("ovSourcesTitle")}
            </div>
          </div>
          {analytics.sources.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-brand-mute">
              {t("ovTopPagesEmpty")}
            </p>
          ) : (
            <ul className="divide-y divide-brand-line">
              {analytics.sources.map((s) => (
                <li
                  key={s.label}
                  className="flex items-center gap-3 px-5 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-brand-ink">
                    {s.label === "Direct" ? t("ovSourceDirect") : s.label}
                  </span>
                  <span className="font-display text-[13px] font-bold text-brand-ink">
                    {format.number(s.visits)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
            {t("ovDevicesTitle")}
          </div>
          {deviceTotal === 0 ? (
            <p className="py-8 text-center text-[13px] text-brand-mute">
              {t("ovTopPagesEmpty")}
            </p>
          ) : (
            <div className="mt-4">
              <div className="flex h-3 overflow-hidden rounded-pill bg-brand-light">
                <span
                  className="bg-brand-primary"
                  style={{ width: `${desktopPct}%` }}
                />
                <span
                  className="bg-brand-secondary"
                  style={{ width: `${100 - desktopPct}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2 text-brand-ink">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-primary" />
                  {t("ovDeviceDesktop")} · {desktopPct}%
                </span>
                <span className="flex items-center gap-2 text-brand-ink">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-secondary" />
                  {t("ovDeviceMobile")} · {100 - desktopPct}%
                </span>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── Image performance ─────────────────────────────────── */}
      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-brand-mute" />
          <h2 className="font-display text-lg font-bold text-brand-ink">
            {t("perfTitle")}
          </h2>
        </div>
        <p className="mt-1 text-[12.5px] text-brand-mute">{t("perfDesc")}</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
          <div>
            {performance.imageCount > 0 ? (
              <>
                <div className="flex items-baseline gap-1">
                  <span
                    className={`font-display text-4xl font-bold ${perfColor}`}
                  >
                    {performance.score}
                  </span>
                  <span className="text-sm text-brand-mute">/ 100</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-pill bg-brand-light">
                  <span
                    className={`block h-full ${perfBar}`}
                    style={{ width: `${performance.score}%` }}
                  />
                </div>
                <span
                  className={`mt-2 inline-block text-[13px] font-semibold ${perfColor}`}
                >
                  {t(perfGradeKey)}
                </span>
              </>
            ) : (
              <p className="text-sm text-brand-mute">{t("perfEmpty")}</p>
            )}
          </div>
          <ul className="space-y-2">
            {performance.checks.map((c) => (
              <li key={c.key} className="flex items-start gap-2 text-[13px]">
                {c.status === "good" ? (
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                )}
                <span className="text-brand-ink">
                  {t(c.key, { count: c.count ?? 0 })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Needs attention ───────────────────────────────────── */}
      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-bold text-brand-ink">
          {t("ovAttnTitle")}
        </h2>
        {signals.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-brand-mute">
            <CircleCheck className="h-4 w-4 text-emerald-600" />
            {t("ovAttnAllGood")}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {signals.map((sig) => (
              <li key={sig.key}>
                <Link
                  href={sig.seg ? `${base}/${sig.seg}` : base}
                  className="group flex items-center gap-2.5 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900 transition hover:bg-amber-100"
                >
                  <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" />
                  <span className="flex-1">
                    {t(sig.key, { count: sig.count ?? 0 })}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Quick links ───────────────────────────────────────── */}
      <section>
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
          {t("ovManageTitle")}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.seg}
                href={`${base}/${l.seg}`}
                className="group flex items-start gap-3.5 rounded-card border border-brand-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-brand-light text-brand-primary">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[14px] font-bold text-brand-ink">
                    {t(l.key)}
                  </span>
                </span>
                <ArrowUpRight className="h-4 w-4 text-brand-mute opacity-0 transition group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
