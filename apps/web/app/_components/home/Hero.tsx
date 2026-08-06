import { BadgeCheck, Lock, Percent, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { DirectorySearchBar } from "@/app/_components/browse/DirectorySearchBar";
import { Link } from "@/i18n/navigation";
import { listedRegionPhrase } from "@/lib/geo/regionPhrase";
import { getCategoryTree } from "@/lib/taxonomy/getCategories";

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
  const [t, region, tree] = await Promise.all([
    getTranslations("home"),
    listedRegionPhrase(),
    getCategoryTree(),
  ]);

  // Flat leaf list (Lodge, B&B, Guesthouse…) for the search bar's Type field.
  const typeOptions = tree.accommodation.flatMap((root) =>
    root.children.map((leaf) => ({ value: leaf.slug, label: leaf.label })),
  );
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

      {/* Single centered column — the copy is the focal point. Widens at lg only
          so the search bar has room for one clean row; the copy stays centered. */}
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 pb-12 pt-12 text-center lg:max-w-5xl lg:pb-20 lg:pt-20">
        <span className="inline-flex items-center gap-2 rounded-pill border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
          {t("heroBadge", { region: region.label })}
        </span>

        <h1 className="mt-5 font-display text-[40px] font-extrabold leading-[1.02] tracking-tight text-white md:text-6xl lg:text-[64px]">
          {t("heroTitlePre")}
          <br />
          <span className="text-emerald-300">{t("heroTitleHighlight")}</span>
        </h1>

        <p className="mt-4 max-w-xl text-base leading-relaxed text-white/80 md:text-lg">
          {t("heroSubtitle", {
            count: stats.properties,
            formatted: fmtNum(stats.properties),
          })}
        </p>

        {/* Search — modern where/type/dates/guests bar. Hands off to /explore,
            which owns the richer filters (price, bedrooms, amenities…). */}
        <div className="mt-7 w-full max-w-2xl lg:max-w-5xl">
          <DirectorySearchBar
            typeOptions={typeOptions}
            basePath="/explore"
            variant="hero"
            showType
          />

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
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
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
