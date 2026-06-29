"use client";

import { buildSiteVars, type SitePreset } from "@/lib/site/themes";

/**
 * A small, live mini-site rendered in the chosen theme + accent with the host's
 * own name/logo — so picking a theme/colour feels like "this is MY website".
 * Pure presentational: builds the `--site-*` vars from the theme config (same
 * engine the real site uses) and themes a tiny header + hero + room cards off them.
 */
export function WizardThemePreview({
  base,
  slug,
  accent,
  siteName,
  logoUrl,
  compact = false,
}: {
  base: SitePreset | null;
  slug: string;
  accent: string;
  siteName: string;
  logoUrl?: string | null;
  /** Smaller paddings/type for use inside a theme-gallery card. */
  compact?: boolean;
}) {
  const vars = buildSiteVars({
    preset: slug,
    ...(base ? { base } : {}),
    colors: { accent },
  });
  const onAccent = "var(--site-accent-ink, #fff)";

  return (
    <div
      style={{
        ...vars,
        background: "var(--site-bg)",
        color: "var(--site-ink)",
        fontFamily: "var(--site-font-body)",
      }}
      className="overflow-hidden rounded-xl border border-black/5"
    >
      {/* header */}
      <div
        style={{
          background: "var(--site-surface)",
          borderColor: "var(--site-line)",
        }}
        className={`flex items-center justify-between border-b ${compact ? "px-3 py-2" : "px-4 py-3"}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className={
                compact
                  ? "h-4 w-auto object-contain"
                  : "h-6 w-auto object-contain"
              }
            />
          ) : null}
          <span
            style={{
              fontFamily: "var(--site-font-heading)",
              color: "var(--site-ink)",
            }}
            className={`truncate font-semibold ${compact ? "text-[11px]" : "text-sm"}`}
          >
            {siteName || "Your site"}
          </span>
        </div>
        <span
          style={{
            background: "var(--site-accent)",
            color: onAccent,
            borderRadius: "var(--site-radius)",
          }}
          className={`shrink-0 font-semibold ${compact ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[11px]"}`}
        >
          Book now
        </span>
      </div>

      {/* hero */}
      <div className={compact ? "px-3 py-4" : "px-5 py-7"}>
        <div
          style={{
            fontFamily: "var(--site-font-heading)",
            color: "var(--site-ink)",
          }}
          className={compact ? "text-sm font-bold" : "text-xl font-bold"}
        >
          A warm welcome
        </div>
        <p
          style={{ color: "var(--site-mute)" }}
          className={`leading-relaxed ${compact ? "mt-1 text-[10px]" : "mt-1.5 text-xs"}`}
        >
          Direct booking, no commission — guests book straight with you.
        </p>
        <span
          style={{
            background: "var(--site-accent)",
            color: onAccent,
            borderRadius: "var(--site-radius)",
          }}
          className={`inline-block font-semibold ${compact ? "mt-2 px-2.5 py-1 text-[10px]" : "mt-3 px-3.5 py-2 text-xs"}`}
        >
          Check availability
        </span>

        {/* room cards */}
        <div
          className={`grid grid-cols-2 gap-2.5 ${compact ? "mt-3" : "mt-5"}`}
        >
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                background: "var(--site-surface)",
                borderColor: "var(--site-line)",
                borderRadius: "var(--site-radius)",
              }}
              className="border p-2.5"
            >
              <div
                style={{ background: "var(--site-line)" }}
                className={
                  compact ? "h-8 w-full rounded" : "h-12 w-full rounded"
                }
              />
              <div
                style={{ color: "var(--site-ink)" }}
                className="mt-1.5 text-[10px] font-semibold"
              >
                Garden Room
              </div>
              <div
                style={{ color: "var(--site-accent)" }}
                className="text-[10px] font-bold"
              >
                R 1 300 / night
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
