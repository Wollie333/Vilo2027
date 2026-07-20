import {
  ArrowUpRight,
  Check,
  CircleAlert,
  CircleCheck,
  Gauge,
  Layers,
  Monitor,
  MousePointerClick,
  Percent,
  Plus,
  Smartphone,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { AnalyticsRange } from "@/lib/website/analytics";

import { loadOverviewData } from "../loadOverviewData";
import { NearbyExperiencesCard } from "../_components/NearbyExperiencesCard";
import { RangeTabs } from "../_components/overview/RangeTabs";
import { TrafficChart } from "../_components/overview/TrafficChart";

export const dynamic = "force-dynamic";

const RANGE_DAYS: Record<AnalyticsRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const STATUS_TONE = {
  published: "green",
  draft: "gray",
  unpublished: "amber",
} as const;

const BADGE_KEY = {
  draft: "draftBadge",
  published: "publishedBadge",
  unpublished: "unpublishedBadge",
} as const;

/** Source-bar accents (cycled), matching the mockup palette. */
const SOURCE_COLORS = ["#10B981", "#064E3B", "#34D399", "#0EA5E9", "#94A3B8"];

/** `.delta`-styled vs-previous indicator (emerald up / red down). */
function CmsDelta({ value, label }: { value: number | null; label: string }) {
  if (value == null)
    return <span style={{ color: "var(--mute)" }}>{label}</span>;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <>
      <span className={`delta ${up ? "up" : "down"}`}>
        <Icon style={{ width: 13, height: 13 }} />
        {up ? "+" : ""}
        {value}%
      </span>
      <span style={{ color: "var(--mute)" }}>{label}</span>
    </>
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

  const { site, analytics, portfolio, isLive, signals, performance } = data;
  const base = `/dashboard/website/${websiteId}`;
  const days = RANGE_DAYS[range];
  const siteName =
    site.brand.name?.trim() || site.businessName || site.subdomain;
  const siteGlyph = (siteName[0] || "·").toUpperCase();
  const siteColor = portfolio.find((p) => p.isCurrent)?.color ?? "#10B981";

  // ── Set-up checklist (deep-linked) ──────────────────────────
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

  // ── Right-rail KPIs (honest, real metrics only — no revenue/leads) ──
  const kpis = [
    {
      key: "statBookingClicks",
      icon: MousePointerClick,
      value: format.number(analytics.bookingClicks),
      delta: analytics.deltas.bookingClicks,
    },
    {
      key: "statConversion",
      icon: Percent,
      value: `${Math.round(analytics.conversion * 100)}%`,
      delta: null,
    },
    {
      key: "statPagesPerVisit",
      icon: Layers,
      value: analytics.pagesPerVisit.toFixed(1),
      delta: null,
    },
  ];

  const topMax = Math.max(1, ...analytics.topPages.map((p) => p.views));
  const sourcesTotal = analytics.sources.reduce((n, s) => n + s.visits, 0);
  const deviceTotal = analytics.devices.desktop + analytics.devices.mobile;
  const desktopPct =
    deviceTotal > 0
      ? Math.round((analytics.devices.desktop / deviceTotal) * 100)
      : 0;
  const devices =
    deviceTotal > 0
      ? [
          { key: "ovDeviceDesktop", icon: Monitor, pct: desktopPct },
          { key: "ovDeviceMobile", icon: Smartphone, pct: 100 - desktopPct },
        ]
      : [];

  const perfColor =
    performance.grade === "good"
      ? "#047857"
      : performance.grade === "fair"
        ? "#B45309"
        : "#B91C1C";
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

  return (
    <div className="wielo-cms space-y-9">
      {/* ── Portfolio: all websites ──────────────────────────── */}
      <section>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2
              className="font-display text-[17px] font-extrabold"
              style={{ color: "var(--ink)" }}
            >
              {t("ovPortfolioTitle")}
            </h2>
            <span className="tag gray num">{portfolio.length}</span>
          </div>
          <Link href="/dashboard/website" className="btn btn-dark btn-sm">
            <Plus style={{ width: 15, height: 15 }} />
            {t("ovNewWebsite")}
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {portfolio.map((p) => {
            const stats: [string, string][] = [
              ["statVisitors", format.number(p.visitors)],
              ["statPageviews", format.number(p.pageviews)],
              ["statBookingClicks", format.number(p.bookingClicks)],
            ];
            return (
              <Link
                key={p.id}
                href={`/dashboard/website/${p.id}`}
                className={`sitecard ${p.isCurrent ? "cur" : ""}`}
              >
                <div className="sitehero">
                  <div className="ph" />
                  <div className="glyph" style={{ background: p.color }}>
                    {p.glyph}
                  </div>
                  <div style={{ position: "absolute", top: 11, left: 11 }}>
                    <span className={`tag ${STATUS_TONE[p.status]}`}>
                      <span className="d" />
                      {t(BADGE_KEY[p.status])}
                    </span>
                  </div>
                  {p.isCurrent ? (
                    <div style={{ position: "absolute", top: 11, right: 11 }}>
                      <span className="tag green">
                        <span className="d" />
                        {t("ovViewing")}
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className="sitebody">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div
                        className="truncate font-display text-[15.5px] font-extrabold"
                        style={{ color: "var(--ink)" }}
                      >
                        {p.name}
                      </div>
                      <div
                        className="truncate font-mono text-[11.5px]"
                        style={{ color: "var(--mute)" }}
                      >
                        {p.subdomain}
                      </div>
                    </div>
                    <span
                      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px]"
                      style={{ background: "var(--soft)", color: "#064E3B" }}
                    >
                      <ArrowUpRight style={{ width: 16, height: 16 }} />
                    </span>
                  </div>
                  <div className="sitestats">
                    {stats.map(([k, v]) => (
                      <div key={k} className="ss">
                        <div className="ssv num">{v}</div>
                        <div className="ssl">{t(k)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Nearby experiences (real OSM data → Experiences page) ── */}
      <NearbyExperiencesCard websiteId={websiteId} />

      {/* ── Performance header ───────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] font-display text-[12px] font-extrabold text-white"
            style={{ background: siteColor }}
          >
            {siteGlyph}
          </span>
          <h2
            className="font-display text-[17px] font-extrabold"
            style={{ color: "var(--ink)" }}
          >
            {t("ovPerformance")}
          </h2>
          <span className="text-[13px]" style={{ color: "var(--mute)" }}>
            · {siteName}
          </span>
        </div>
        <div className="ml-auto">
          <RangeTabs value={range} />
        </div>
      </div>

      {/* ── Chart + KPI rail ─────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <section className="card overflow-hidden">
          <div className="card-h" style={{ justifyContent: "space-between" }}>
            <div className="flex items-baseline gap-3">
              <div
                className="num font-display text-[26px] font-extrabold"
                style={{ color: "var(--ink)" }}
              >
                {format.number(analytics.visitors)}
              </div>
              <span className="text-[12.5px]" style={{ color: "var(--mute)" }}>
                {t("ovVisitorsWord")} · {t("ovTrafficSub", { days })}
              </span>
              <CmsDelta
                value={analytics.deltas.visitors}
                label={t("ovVsPrev")}
              />
            </div>
          </div>

          {analytics.hasData ? (
            <div style={{ height: 210, padding: "14px 8px 4px" }}>
              <TrafficChart trend={analytics.trend} />
            </div>
          ) : (
            <p
              className="px-5 py-12 text-center text-sm"
              style={{ color: "var(--mute)" }}
            >
              {t("ovNoTraffic")}
            </p>
          )}

          <div
            className="grid grid-cols-3 border-t"
            style={{ borderColor: "var(--line)" }}
          >
            {(
              [
                ["statPageviews", format.number(analytics.pageviews)],
                ["statBookingClicks", format.number(analytics.bookingClicks)],
                ["ovConvRate", `${Math.round(analytics.conversion * 100)}%`],
              ] as [string, string][]
            ).map(([k, v], i) => (
              <div
                key={k}
                className={`px-5 py-3.5 ${i < 2 ? "border-r" : ""}`}
                style={{ borderColor: "var(--line)" }}
              >
                <div className="smallcaps">{t(k)}</div>
                <div
                  className="num mt-0.5 font-display text-[18px] font-bold"
                  style={{ color: "var(--ink)" }}
                >
                  {v}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.key} className="kpi">
                <div className="kico">
                  <Icon style={{ width: 16, height: 16 }} />
                </div>
                <div className="kl">{t(k.key)}</div>
                <div className="kv num" style={{ fontSize: 26 }}>
                  {k.value}
                </div>
                <div className="kf">
                  <CmsDelta value={k.delta} label={t("ovVsPrev")} />
                </div>
              </div>
            );
          })}
        </aside>
      </div>

      {/* ── Top pages + sources + devices ────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="card overflow-hidden">
          <div className="card-h" style={{ justifyContent: "space-between" }}>
            <h3>{t("ovTopPages")}</h3>
            <Link
              href={`${base}/pages`}
              className="text-[12px] font-semibold"
              style={{ color: "#10B981" }}
            >
              {t("ovManagePages")}
            </Link>
          </div>
          {analytics.topPages.length === 0 ? (
            <p
              className="px-5 py-8 text-center text-[13px]"
              style={{ color: "var(--mute)" }}
            >
              {t("ovTopPagesEmpty")}
            </p>
          ) : (
            <div className="p-2">
              {analytics.topPages.map((p, i) => (
                <div
                  key={p.path}
                  className="lrow"
                  style={{ cursor: "default" }}
                >
                  <span
                    className="num font-mono text-[12px]"
                    style={{ width: 18, color: "#9DB4A8" }}
                  >
                    {i + 1}
                  </span>
                  <span
                    className="truncate text-[13px] font-semibold"
                    style={{ width: 130, flexShrink: 0, color: "var(--ink)" }}
                  >
                    {p.path}
                  </span>
                  <span className="barmini">
                    <i style={{ width: `${(p.views / topMax) * 100}%` }} />
                  </span>
                  <span
                    className="num text-right text-[12px]"
                    style={{ width: 48, color: "var(--mute)" }}
                  >
                    {format.number(p.views)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="card overflow-hidden">
            <div className="card-h">
              <h3>{t("ovSourcesTitle")}</h3>
            </div>
            {analytics.sources.length === 0 ? (
              <p
                className="px-5 py-8 text-center text-[13px]"
                style={{ color: "var(--mute)" }}
              >
                {t("ovTopPagesEmpty")}
              </p>
            ) : (
              <div className="space-y-3 p-4">
                {analytics.sources.map((s, i) => {
                  const pct =
                    sourcesTotal > 0
                      ? Math.round((s.visits / sourcesTotal) * 100)
                      : 0;
                  return (
                    <div key={s.label}>
                      <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                        <span
                          className="truncate font-medium"
                          style={{ color: "var(--ink)" }}
                        >
                          {s.label === "Direct" ? t("ovSourceDirect") : s.label}
                        </span>
                        <span className="num" style={{ color: "var(--mute)" }}>
                          {pct}%
                        </span>
                      </div>
                      <div className="barmini">
                        <i
                          style={{
                            width: `${pct}%`,
                            background: SOURCE_COLORS[i % SOURCE_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="card-h">
              <h3>{t("ovDevicesTitle")}</h3>
            </div>
            {devices.length === 0 ? (
              <p
                className="px-5 py-8 text-center text-[13px]"
                style={{ color: "var(--mute)" }}
              >
                {t("ovTopPagesEmpty")}
              </p>
            ) : (
              <div className="p-2">
                {devices.map((d) => {
                  const Icon = d.icon;
                  return (
                    <div
                      key={d.key}
                      className="lrow"
                      style={{ cursor: "default" }}
                    >
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-[8px]"
                        style={{ background: "var(--soft)", color: "#064E3B" }}
                      >
                        <Icon style={{ width: 16, height: 16 }} />
                      </span>
                      <span
                        className="flex-1 text-[13px] font-medium"
                        style={{ color: "var(--ink)" }}
                      >
                        {t(d.key)}
                      </span>
                      <span
                        className="num font-display text-[14px] font-bold"
                        style={{ color: "var(--ink)" }}
                      >
                        {d.pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* ── Setup & health: checklist · needs attention · image perf ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Checklist */}
        <section className="card overflow-hidden">
          <div className="card-h">
            <h3>{t("checklistTitle")}</h3>
          </div>
          <ul className="p-2">
            {steps.map((s) => (
              <li key={s.key}>
                <Link href={s.seg ? `${base}/${s.seg}` : base} className="lrow">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${
                      s.done ? "text-white" : "text-transparent"
                    }`}
                    style={{
                      background: s.done ? "#10B981" : "transparent",
                      border: s.done ? "none" : "1px solid var(--line)",
                    }}
                  >
                    <Check style={{ width: 12, height: 12 }} strokeWidth={3} />
                  </span>
                  <span
                    className="flex-1 text-[13px]"
                    style={{
                      color: s.done ? "var(--mute)" : "var(--ink)",
                      textDecoration: s.done ? "line-through" : "none",
                      fontWeight: s.done ? 400 : 500,
                    }}
                  >
                    {t(s.key)}
                  </span>
                  <ArrowUpRight
                    style={{ width: 14, height: 14, color: "var(--mute)" }}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Needs attention */}
        <section className="card overflow-hidden">
          <div className="card-h">
            <h3>{t("ovAttnTitle")}</h3>
          </div>
          {signals.length === 0 ? (
            <p
              className="flex items-center gap-2 px-5 py-6 text-[13px]"
              style={{ color: "var(--mute)" }}
            >
              <CircleCheck
                style={{ width: 16, height: 16, color: "#047857" }}
              />
              {t("ovAttnAllGood")}
            </p>
          ) : (
            <ul className="space-y-2 p-3">
              {signals.map((sig) => (
                <li key={sig.key}>
                  <Link
                    href={sig.seg ? `${base}/${sig.seg}` : base}
                    className="flex items-center gap-2.5 rounded-[10px] border px-3.5 py-2.5 text-[13px]"
                    style={{
                      borderColor: "#FDE68A",
                      background: "#FFFBEB",
                      color: "#92400E",
                    }}
                  >
                    <CircleAlert
                      style={{
                        width: 16,
                        height: 16,
                        flexShrink: 0,
                        color: "#B45309",
                      }}
                    />
                    <span className="flex-1">
                      {t(sig.key, { count: sig.count ?? 0 })}
                    </span>
                    <ArrowUpRight style={{ width: 14, height: 14 }} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Image performance */}
        <section className="card overflow-hidden">
          <div className="card-h">
            <Gauge style={{ width: 16, height: 16, color: "var(--mute)" }} />
            <h3>{t("perfTitle")}</h3>
          </div>
          <div className="p-5">
            {performance.imageCount > 0 ? (
              <>
                <div className="flex items-baseline gap-1">
                  <span
                    className="font-display text-[34px] font-extrabold"
                    style={{ color: perfColor }}
                  >
                    {performance.score}
                  </span>
                  <span className="text-sm" style={{ color: "var(--mute)" }}>
                    / 100
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-pill bg-brand-light">
                  <span
                    className={`block h-full ${perfBar}`}
                    style={{ width: `${performance.score}%` }}
                  />
                </div>
                <span
                  className="mt-2 inline-block text-[13px] font-semibold"
                  style={{ color: perfColor }}
                >
                  {t(perfGradeKey)}
                </span>
                <ul className="mt-4 space-y-2">
                  {performance.checks.map((c) => (
                    <li
                      key={c.key}
                      className="flex items-start gap-2 text-[13px]"
                    >
                      {c.status === "good" ? (
                        <CircleCheck
                          style={{
                            width: 16,
                            height: 16,
                            marginTop: 2,
                            flexShrink: 0,
                            color: "#047857",
                          }}
                        />
                      ) : (
                        <CircleAlert
                          style={{
                            width: 16,
                            height: 16,
                            marginTop: 2,
                            flexShrink: 0,
                            color: "#B45309",
                          }}
                        />
                      )}
                      <span style={{ color: "var(--ink)" }}>
                        {t(c.key, { count: c.count ?? 0 })}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm" style={{ color: "var(--mute)" }}>
                {t("perfEmpty")}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
