import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight, Search, Sparkles, X } from "lucide-react";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { Link } from "@/i18n/navigation";
import { getBrandName } from "@/lib/brand";
import {
  searchSpecials,
  SPECIAL_TYPE_LABEL,
  type SpecialsSearchParams,
} from "@/lib/specials/directory";
import { SPECIAL_CATEGORIES } from "@/lib/specials/categories";
import { createAdminClient } from "@/lib/supabase/admin";

import { SpecialCard } from "./SpecialCard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("specials");
  return { title: t("dirMetaTitle"), description: t("dirMetaDesc") };
}

export const dynamic = "force-dynamic";

const BASE_PATH = "/deals";

// Build a directory href that keeps the other active filters intact.
function filterHref(
  current: { where: string; type: string; category: string },
  patch: Partial<{ type: string; category: string }>,
): string {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.where) params.set("where", next.where);
  if (next.type) params.set("type", next.type);
  if (next.category) params.set("category", next.category);
  const qs = params.toString();
  return `${BASE_PATH}${qs ? `?${qs}` : ""}`;
}

export default async function SpecialsDirectoryPage({
  searchParams,
}: {
  searchParams?: SpecialsSearchParams;
}) {
  const admin = createAdminClient();
  const [t, brandName] = await Promise.all([
    getTranslations("specials"),
    getBrandName(),
  ]);
  const result = await searchSpecials(admin, searchParams, BASE_PATH);
  const { where, type, category } = result;
  const current = { where, type, category };

  // Accommodation types present in the unfiltered set would need a second query;
  // a fixed list (same as /explore) keeps the chip row stable and predictable.
  const typeChips = Object.keys(SPECIAL_TYPE_LABEL).filter(
    (key) => key !== "other",
  );

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      {/* Hero / search */}
      <section className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
          <div className="flex items-center gap-2 text-brand-primary">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              {t("dirBadge")}
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-brand-ink md:text-3xl">
            {t("dirTitle", { brand: brandName })}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-mute">
            {t("dirSubtitle")}
          </p>

          <form
            action={BASE_PATH}
            method="get"
            className="mt-5 flex max-w-xl items-center gap-2"
          >
            {type ? <input type="hidden" name="type" value={type} /> : null}
            {category ? (
              <input type="hidden" name="category" value={category} />
            ) : null}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
              <input
                type="text"
                name="where"
                defaultValue={where}
                placeholder={t("dirSearchPlaceholder")}
                className="w-full rounded-pill border border-brand-line bg-white py-2.5 pl-9 pr-4 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-pill bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90"
            >
              {t("dirSearchCta")}
            </button>
          </form>
        </div>
      </section>

      {/* Category + type chips */}
      <section className="sticky top-16 z-20 border-b border-brand-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-2 px-5 py-3 lg:px-8">
          <Link
            href={filterHref(current, { category: "", type: "" })}
            className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
              !category && !type
                ? "bg-brand-primary text-white"
                : "border border-brand-line bg-white text-brand-mute hover:bg-brand-accent"
            }`}
          >
            {t("dirFilterAll")}
          </Link>
          {SPECIAL_CATEGORIES.map((c) => (
            <Link
              key={c.key}
              href={filterHref(current, {
                category: category === c.key ? "" : c.key,
              })}
              className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
                category === c.key
                  ? "bg-brand-primary text-white"
                  : "border border-brand-line bg-white text-brand-mute hover:bg-brand-accent"
              }`}
            >
              {t(`category_${c.key}`)}
            </Link>
          ))}
          <span className="mx-1 self-center text-brand-line">|</span>
          {typeChips.map((key) => (
            <Link
              key={key}
              href={filterHref(current, {
                type: type === key ? "" : key,
              })}
              className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
                type === key
                  ? "bg-brand-secondary text-white"
                  : "border border-brand-line bg-white text-brand-mute hover:bg-brand-accent"
              }`}
            >
              {t(`type_${key}`)}
            </Link>
          ))}
        </div>
      </section>

      {/* Results */}
      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-brand-ink">
              {where ? t("dirResultsMatching", { where }) : t("dirResultsAll")}
            </h2>
            {result.hasFilters ? (
              <Link
                href={BASE_PATH}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
              >
                <X className="h-3 w-3" />
                {t("dirClearFilters")}
              </Link>
            ) : null}
          </div>
          <div className="text-sm text-brand-mute">
            {t("dirDealCount", { count: result.totalCount })}
            {result.totalPages > 1
              ? t("dirPageSuffix", {
                  page: result.safePage,
                  total: result.totalPages,
                })
              : ""}
          </div>
        </div>

        {result.specials.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="font-display text-lg font-bold text-brand-ink">
              {t("dirEmptyTitle")}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
              {t("dirEmptyBody", { brand: brandName })}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.specials.map((s) => (
              <SpecialCard key={s.id} special={s} />
            ))}
          </div>
        )}

        {result.totalPages > 1 && result.specials.length > 0 ? (
          <nav
            aria-label={t("dirPaginationAria")}
            className="mt-10 flex items-center justify-center gap-3"
          >
            {result.prevHref ? (
              <Link
                href={result.prevHref}
                rel="prev"
                className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("dirPrev")}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-brand-light/40 px-4 py-2 text-sm font-medium text-brand-mute">
                <ArrowLeft className="h-4 w-4" />
                {t("dirPrev")}
              </span>
            )}
            <span className="text-sm font-medium text-brand-mute">
              {t("dirPageOf", {
                page: result.safePage,
                total: result.totalPages,
              })}
            </span>
            {result.nextHref ? (
              <Link
                href={result.nextHref}
                rel="next"
                className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent"
              >
                {t("dirNext")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-brand-light/40 px-4 py-2 text-sm font-medium text-brand-mute">
                {t("dirNext")}
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </nav>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  );
}
