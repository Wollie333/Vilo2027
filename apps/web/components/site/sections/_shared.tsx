import type { CSSProperties, ReactNode } from "react";

import type { SectionTone } from "@/lib/website/sections.schema";

// Shared presentational primitives for site sections. All colour/radius/font
// come from the scoped `--site-*` CSS vars (set by <SiteThemeRoot>), never the
// app's brand-* tokens, so each tenant site themes independently.

// Shared styling for standalone site images (gallery, host photo, property
// hero) — driven by the Brand Studio "Images" controls via `--site-img-*`.
export const siteImageStyle: CSSProperties = {
  borderRadius: "var(--site-img-radius)",
  border: "var(--site-img-border)",
  boxShadow: "var(--site-img-shadow)",
};

/**
 * Per-section colour scheme ("tone"). Returns a style that paints the band
 * background and re-points the scoped `--site-*` text vars for the section
 * subtree, so any section can be recoloured in one tap and stay on-brand.
 * Returns undefined for "default" (inherit the page theme). `color-mix` and
 * literal alpha keep it readable across any theme palette.
 */
export function sectionToneStyle(
  tone?: SectionTone,
): CSSProperties | undefined {
  switch (tone) {
    case "accent":
      return {
        background: "var(--site-accent)",
        "--site-bg": "var(--site-accent)",
        "--site-surface": "color-mix(in srgb, #fff 14%, var(--site-accent))",
        "--site-ink": "var(--site-accent-ink)",
        "--site-mute":
          "color-mix(in srgb, var(--site-accent-ink) 70%, transparent)",
        "--site-line":
          "color-mix(in srgb, var(--site-accent-ink) 24%, transparent)",
      } as CSSProperties;
    case "dark":
      return {
        background: "var(--site-ink)",
        "--site-bg": "var(--site-ink)",
        "--site-surface": "rgba(255,255,255,0.08)",
        "--site-ink": "#ffffff",
        "--site-mute": "rgba(255,255,255,0.68)",
        "--site-line": "rgba(255,255,255,0.18)",
      } as CSSProperties;
    case "muted":
      return {
        background: "color-mix(in srgb, var(--site-ink) 5%, var(--site-bg))",
        "--site-surface": "var(--site-bg)",
      } as CSSProperties;
    default:
      return undefined;
  }
}

export function SectionShell({
  children,
  surface = false,
  width = "wide",
  id,
}: {
  children: ReactNode;
  /** Paint a raised surface background instead of the page background. */
  surface?: boolean;
  width?: "wide" | "narrow";
  id?: string;
}) {
  return (
    <section
      id={id}
      style={surface ? { background: "var(--site-surface)" } : undefined}
      className="px-5 py-16 md:py-20"
    >
      <div
        className={`mx-auto w-full ${width === "narrow" ? "max-w-2xl" : "max-w-5xl"}`}
      >
        {children}
      </div>
    </section>
  );
}

export function SectionHeading({
  children,
  centered = true,
  className = "",
}: {
  children: ReactNode;
  centered?: boolean;
  className?: string;
}) {
  return (
    <h2
      style={{
        fontFamily: "var(--site-font-heading)",
        fontWeight: "var(--site-weight-heading)" as unknown as number,
        fontSize: "var(--site-h2)",
        lineHeight: "var(--site-leading-heading)" as unknown as number,
        letterSpacing: "var(--site-tracking-heading)",
        color: "var(--site-ink)",
      }}
      className={`${centered ? "text-center" : ""} ${className}`}
    >
      {children}
    </h2>
  );
}

export function Muted({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <p style={{ color: "var(--site-mute)", ...style }} className={className}>
      {children}
    </p>
  );
}

export function SiteButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const prefix = `--site-btn-${variant}`;
  const style: CSSProperties = {
    background: `var(${prefix}-bg)`,
    color: `var(${prefix}-color)`,
    border: `var(${prefix}-border)`,
    borderRadius: `var(${prefix}-radius)`,
  };
  return (
    <a
      href={href}
      style={style}
      className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
    >
      {children}
    </a>
  );
}

export function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--site-surface)",
        border: "var(--site-card-border)",
        borderRadius: "var(--site-card-radius)",
        boxShadow: "var(--site-card-shadow)",
        ...style,
      }}
      className={`overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

export function Stars({ rating }: { rating: number }) {
  const r = Math.max(0, Math.min(5, rating));
  const pct = (r / 5) * 100;
  // Overlay technique: a clipped accent layer over a muted track gives precise
  // fractional fill (e.g. 4.4 → 88%) instead of rounding to whole stars.
  return (
    <span
      aria-label={`${r.toFixed(1)} out of 5`}
      className="relative inline-block whitespace-nowrap"
      style={{ color: "var(--site-line)" }}
    >
      {"★★★★★"}
      <span
        aria-hidden
        className="absolute left-0 top-0 overflow-hidden"
        style={{ width: `${pct}%`, color: "var(--site-accent)" }}
      >
        {"★★★★★"}
      </span>
    </span>
  );
}
