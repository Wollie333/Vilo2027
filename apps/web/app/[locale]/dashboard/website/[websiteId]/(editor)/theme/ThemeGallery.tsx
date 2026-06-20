"use client";

import { Check, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { ThemeOption } from "@/lib/site/themes.server";

import { ThemeActivateModal } from "./ThemeActivateModal";

export function ThemeGallery({
  websiteId,
  themes,
  activeSlug,
  subdomain,
}: {
  websiteId: string;
  themes: ThemeOption[];
  activeSlug: string;
  subdomain: string;
}) {
  const t = useTranslations("website");
  const [activateTheme, setActivateTheme] = useState<ThemeOption | null>(null);
  const previewHref = (slug: string) =>
    `/site?site=${subdomain}&preview=1&theme=${slug}`;

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((theme) => {
          const active = theme.slug === activeSlug;
          const p = theme.base.palette;

          return (
            <div
              key={theme.id}
              className="group overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm transition-all hover:border-brand-line/80 hover:shadow-lg"
            >
              {/* Preview Image Area */}
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-brand-light">
                {theme.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={theme.previewUrl}
                    alt={theme.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  // Palette mini-mock when no preview image
                  <div
                    className="flex h-full w-full flex-col transition-transform duration-300 group-hover:scale-105"
                    style={{ background: p?.bg }}
                  >
                    {/* Mini header mock */}
                    <div className="flex items-center gap-2 px-4 pt-4">
                      <span
                        className="h-6 w-6 rounded-full"
                        style={{ background: p?.accent }}
                      />
                      <span
                        className="h-2 w-24 rounded-full"
                        style={{ background: p?.ink, opacity: 0.2 }}
                      />
                    </div>
                    {/* Mini hero mock */}
                    <div
                      className="mx-4 mt-4 flex-1 rounded-lg"
                      style={{ background: p?.surface }}
                    />
                    {/* Mini color strip */}
                    <div className="flex gap-2 p-4">
                      {[p?.surface, p?.accent, p?.ink, p?.mute].map((c, i) => (
                        <span
                          key={i}
                          className="h-6 flex-1 rounded-lg"
                          style={{ background: c, opacity: i === 3 ? 0.5 : 1 }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Active badge */}
                {active && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                    <Check className="h-3.5 w-3.5" />
                    {t("themeActive")}
                  </span>
                )}

                {/* Hover overlay — preview opens the live site in a new tab */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                  <a
                    href={previewHref(theme.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-ink shadow-lg transition hover:bg-brand-light"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t("themePreviewBtn")}
                  </a>
                </div>
              </div>

              {/* Card Footer */}
              <div className="p-4">
                {/* Title and tier */}
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h3 className="font-display text-base font-bold text-brand-ink">
                    {theme.name}
                  </h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      theme.isPremium
                        ? "bg-amber-100 text-amber-700"
                        : "bg-brand-light text-brand-mute"
                    }`}
                  >
                    {theme.isPremium ? t("themePremium") : t("themeFree")}
                  </span>
                </div>

                {/* Description */}
                {theme.description && (
                  <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-brand-mute">
                    {theme.description}
                  </p>
                )}

                {/* Actions — Preview opens a new tab; Activate confirms */}
                <div className="flex items-center gap-2">
                  <a
                    href={previewHref(theme.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-brand-line bg-white px-3.5 py-2.5 text-sm font-semibold text-brand-ink transition hover:bg-brand-light"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t("themePreviewBtn")}
                  </a>
                  <button
                    type="button"
                    onClick={() => !active && setActivateTheme(theme)}
                    disabled={active}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
                      active
                        ? "cursor-default bg-green-50 text-green-700"
                        : "bg-brand-primary text-white hover:opacity-90"
                    }`}
                  >
                    {active ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="h-4 w-4" />
                        {t("themeCurrentlyActive")}
                      </span>
                    ) : (
                      t("themeActivate")
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Activate confirmation */}
      {activateTheme && (
        <ThemeActivateModal
          theme={activateTheme}
          websiteId={websiteId}
          subdomain={subdomain}
          isActive={activateTheme.slug === activeSlug}
          onClose={() => setActivateTheme(null)}
        />
      )}
    </>
  );
}
