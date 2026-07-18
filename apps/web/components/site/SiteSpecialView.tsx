import { notFound } from "next/navigation";

import {
  buildSitePreviewPages,
  loadSiteContext,
  loadSiteSpecialPage,
  siteBookHref,
  type SiteSpecialDetail,
} from "@/lib/site/loadSitePage";
import { siteSurfaceIsDark } from "@/lib/site/themes";
import type { SpecialCard } from "@/lib/site/types";

import { JsonLd } from "./JsonLd";
import { OceansViewSpecialDetail } from "./oceansview/OceansViewSpecialDetail";
import { SiteChrome } from "./SiteChrome";
import { siteAsset } from "./SitePageView";
import { SiteImg } from "./SiteImg";
import { SiteThemeRoot } from "./SiteThemeRoot";

function fmtMoney(amount: number | null, currency: string): string | null {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

/** Minimal, on-brand offer detail for non-OceansView themes (token-driven). */
function GenericSpecialDetail({
  special,
  otherSpecials,
  specialsHref,
}: {
  special: SiteSpecialDetail;
  otherSpecials: SpecialCard[];
  specialsHref: string;
}) {
  const price = fmtMoney(special.price, special.currency);
  const was = fmtMoney(special.wasPrice, special.currency);
  const unit = special.priceMode === "per_night" ? " / night" : "";
  const hero = special.imageUrl
    ? (siteAsset(special.imageUrl) ?? special.imageUrl)
    : null;
  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-20 pt-8">
      <nav
        aria-label="Breadcrumb"
        style={{ color: "var(--site-mute)" }}
        className="text-sm"
      >
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <a href="/" className="hover:opacity-80">
              Home
            </a>
          </li>
          <li aria-hidden>›</li>
          <li>
            <a href={specialsHref} className="hover:opacity-80">
              Specials
            </a>
          </li>
          <li aria-hidden>›</li>
          <li style={{ color: "var(--site-ink)" }} className="font-medium">
            {special.title}
          </li>
        </ol>
      </nav>

      {hero ? (
        <SiteImg
          src={hero}
          alt={special.title}
          priority
          sizes="(min-width: 768px) 900px, 100vw"
          widths={[600, 900, 1280]}
          style={{ borderRadius: "var(--site-radius)" }}
          className="mt-6 aspect-[16/9] w-full object-cover"
        />
      ) : null}

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          {special.badge ? (
            <span
              style={{
                background: "var(--site-accent)",
                color: "var(--site-accent-ink)",
                borderRadius: "999px",
              }}
              className="inline-block px-3 py-1 text-xs font-semibold"
            >
              {special.badge}
            </span>
          ) : null}
          <h1
            style={{
              fontFamily: "var(--site-font-heading)",
              color: "var(--site-ink)",
            }}
            className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl"
          >
            {special.title}
          </h1>
        </div>
        {price ? (
          <div className="text-right">
            {was ? (
              <span
                style={{ color: "var(--site-mute)" }}
                className="mr-2 text-base line-through"
              >
                {was}
              </span>
            ) : null}
            <span
              style={{ color: "var(--site-ink)" }}
              className="text-2xl font-semibold"
            >
              {price}
              <span
                style={{ color: "var(--site-mute)" }}
                className="text-sm font-normal"
              >
                {unit}
              </span>
            </span>
          </div>
        ) : null}
      </div>

      {special.description ? (
        <p
          style={{ color: "var(--site-ink)" }}
          className="mt-5 max-w-2xl text-base leading-relaxed"
        >
          {special.description}
        </p>
      ) : null}

      <a
        href={special.bookHref}
        data-wielo-book
        style={{
          background: "var(--site-btn-primary-bg)",
          color: "var(--site-btn-primary-color)",
          border: "var(--site-btn-primary-border)",
          borderRadius: "var(--site-btn-primary-radius)",
        }}
        className="mt-8 inline-flex min-h-[52px] items-center justify-center px-8 text-sm font-semibold transition-opacity hover:opacity-90"
      >
        Book this offer
      </a>

      {otherSpecials.length > 0 ? (
        <div className="mt-16">
          <h2
            style={{
              fontFamily: "var(--site-font-heading)",
              color: "var(--site-ink)",
            }}
            className="text-xl font-semibold"
          >
            More offers
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {otherSpecials.slice(0, 3).map((s) => (
              <a
                key={s.id}
                href={s.detailHref ?? `/specials/${s.slug ?? ""}`}
                className="group block"
              >
                <article
                  style={{
                    background: "var(--site-surface)",
                    borderColor: "var(--site-line)",
                    borderRadius: "var(--site-radius)",
                  }}
                  className="flex h-full flex-col overflow-hidden border"
                >
                  {s.imageUrl ? (
                    <SiteImg
                      src={siteAsset(s.imageUrl) ?? s.imageUrl}
                      alt={s.title}
                      sizes="(min-width: 640px) 33vw, 100vw"
                      widths={[320, 480, 640]}
                      className="aspect-[16/9] w-full object-cover"
                    />
                  ) : null}
                  <div className="p-4">
                    <h3
                      style={{
                        fontFamily: "var(--site-font-heading)",
                        color: "var(--site-ink)",
                      }}
                      className="line-clamp-2 text-sm font-semibold transition-opacity group-hover:opacity-80"
                    >
                      {s.title}
                    </h3>
                  </div>
                </article>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Renders one SPECIAL/offer as a full page: the themed frame + the offer-detail
 * design (bespoke for OceansView, a token-driven generic layout otherwise), so a
 * guest can browse the offer before booking. 404s when the slug matches no
 * currently-bookable offer. Mirrors `SiteRoomView`.
 */
export async function SiteSpecialView({
  siteRef,
  specialSlug,
  preview = false,
  siteParam,
  themeSlug,
}: {
  siteRef: string;
  specialSlug: string;
  preview?: boolean;
  siteParam?: string | null;
  themeSlug?: string;
}) {
  const ctx = await loadSiteContext(siteRef, { preview, siteParam, themeSlug });
  if (!ctx) notFound();

  const result = await loadSiteSpecialPage(ctx, specialSlug);
  if (!result) notFound();
  const { special, otherSpecials, specialsHref } = result;

  const headerBookHref =
    ctx.propertyIds.length > 0 ? siteBookHref(ctx, {}) : undefined;
  const previewPages = ctx.preview
    ? await buildSitePreviewPages(ctx)
    : undefined;
  const previewCtx = ctx.preview
    ? { subdomain: ctx.subdomain, themeSlug: ctx.previewThemeSlug }
    : undefined;

  return (
    <>
      <JsonLd graph={[]} />
      <SiteThemeRoot theme={ctx.theme}>
        <SiteChrome
          brand={ctx.brand}
          nav={ctx.nav}
          navigation={ctx.navigation}
          conversion={ctx.conversion}
          analytics={ctx.analytics}
          layout={ctx.layout}
          popupForm={ctx.popupForm}
          websiteId={ctx.websiteId}
          bookHref={headerBookHref}
          darkChrome={siteSurfaceIsDark(ctx.theme)}
          analyticsWebsiteId={ctx.preview ? undefined : ctx.websiteId}
          preset={ctx.theme.preset}
          header={ctx.theme.header}
          footer={ctx.theme.footer}
          preview={previewCtx}
          previewPages={previewPages}
          // Opens with a breadcrumb (light text), never a full-bleed hero — keep
          // the header solid so links stay legible (matches room detail).
          pageHasHero={false}
        >
          {ctx.theme.preset === "oceansview" ? (
            <OceansViewSpecialDetail
              special={special}
              otherSpecials={otherSpecials}
              specialsHref={specialsHref}
              asset={siteAsset}
            />
          ) : (
            <GenericSpecialDetail
              special={special}
              otherSpecials={otherSpecials}
              specialsHref={specialsHref}
            />
          )}
        </SiteChrome>
      </SiteThemeRoot>
    </>
  );
}
