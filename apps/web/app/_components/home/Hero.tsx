import { BadgeCheck, Lock, Percent, Search, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import type { HomeStats } from "./home-data";

function fmtNum(n: number): string {
  return n.toLocaleString("en-ZA").replace(/,/g, " ");
}

export async function Hero({
  stats,
  popularCities,
}: {
  stats: HomeStats;
  popularCities: string[];
}) {
  const t = await getTranslations("home");
  return (
    <section
      className="relative overflow-hidden border-b border-brand-line text-white"
      style={{
        background:
          "linear-gradient(150deg,#11201A 0%,#0A1410 55%,#06100C 100%)",
      }}
    >
      {/* Background accents */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.25) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-brand-primary/20 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />

      {/* Single centered column — the copy is the focal point */}
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 pb-16 pt-16 text-center lg:pb-24 lg:pt-24">
        <span className="inline-flex items-center gap-2 rounded-pill border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
          {t("heroBadge")}
        </span>

        <h1 className="mt-6 font-display text-[42px] font-extrabold leading-[1.02] tracking-tight text-white md:text-6xl lg:text-[64px]">
          {t("heroTitlePre")}
          <br />
          <span className="text-emerald-300">{t("heroTitleHighlight")}</span>
        </h1>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 md:text-lg">
          {t("heroSubtitle", {
            count: stats.properties,
            formatted: fmtNum(stats.properties),
          })}
        </p>

        {/* COMPACT search bar — native GET form, works without JS */}
        <div className="mt-9 w-full max-w-xl">
          <form
            action="/explore"
            method="get"
            className="flex items-center rounded-pill border border-brand-line bg-white p-1.5 shadow-lift"
          >
            <label className="min-w-0 flex-[1.4] cursor-text rounded-pill px-4 py-2 text-left transition-colors hover:bg-brand-light">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                {t("searchWhere")}
              </div>
              <input
                type="text"
                name="where"
                placeholder={t("searchWherePlaceholder")}
                aria-label={t("searchWhereAria")}
                className="w-full truncate bg-transparent text-sm font-medium text-brand-ink outline-none placeholder:text-brand-mute/70"
              />
            </label>

            <span className="hidden h-9 w-px shrink-0 bg-brand-line sm:block" />

            <div className="hidden min-w-0 flex-1 px-4 py-2 text-left sm:block">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                {t("searchWhen")}
              </div>
              <div className="truncate text-sm font-medium text-brand-ink">
                {t("searchAnyWeek")}
              </div>
            </div>

            <span className="h-9 w-px shrink-0 bg-brand-line" />

            <label className="min-w-0 flex-1 px-4 py-2 text-left">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                {t("searchGuests")}
              </div>
              <select
                name="guests"
                defaultValue=""
                aria-label={t("guestsAria")}
                className="w-full truncate bg-transparent text-sm font-medium text-brand-ink outline-none"
              >
                <option value="">{t("guestsAny")}</option>
                <option value="1">{t("guests1")}</option>
                <option value="2">{t("guests2")}</option>
                <option value="4">{t("guests4")}</option>
                <option value="6">{t("guests6")}</option>
                <option value="8">{t("guests8plus")}</option>
              </select>
            </label>

            <button
              type="submit"
              aria-label={t("searchAria")}
              className="ml-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white transition-colors hover:bg-brand-secondary"
            >
              <Search className="h-5 w-5" />
            </button>
          </form>

          {popularCities.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-white/60">
              <span className="font-medium">{t("popular")}</span>
              {popularCities.slice(0, 4).map((c, i) => (
                <span key={c} className="inline-flex items-center gap-2">
                  {i > 0 ? (
                    <span className="text-white/25">&middot;</span>
                  ) : null}
                  <Link
                    href={`/explore?where=${encodeURIComponent(c)}`}
                    className="hover:text-white"
                  >
                    {c}
                  </Link>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Trust row */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-emerald-300" />
            <span className="text-xs text-white/70">{t("trustPayments")}</span>
          </div>
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-emerald-300" />
            <span className="text-xs text-white/70">{t("trustVerified")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-emerald-300" />
            <span className="text-xs text-white/70">{t("trustNoFees")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
