import type { ReactNode } from "react";

import { buildSiteVars, type SiteThemeConfig } from "@/lib/site/themes";

import { SiteFontLinks } from "./SiteFontLinks";

/**
 * Scopes the `--site-*` CSS variables to its subtree and sets the base page
 * surface + body font. Everything inside (chrome + sections) themes off these
 * vars, so a tenant site renders identically in the dashboard preview and on the
 * public domain (preview === public) without leaking into the app's own tokens.
 *
 * Pure presentational + server-safe (no hooks).
 */
export function SiteThemeRoot({
  theme,
  children,
  className,
}: {
  theme: SiteThemeConfig | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  const vars = buildSiteVars(theme);
  // Per-theme skin scope. Each built-in theme ships a scoped stylesheet
  // (`.wielo-<slug> { … }` in theme-skins.css) that styles the SAME section
  // blocks into its pixel-perfect design. Purely additive: with no skin rules
  // for a slug, nothing changes; and every rule sits UNDER the builder's inline
  // `--el-*` overrides, so per-element edits still win.
  const slug =
    typeof theme?.preset === "string" && theme.preset.trim()
      ? theme.preset.trim()
      : null;
  const skinClass = slug ? `wielo-${slug}` : "";
  // The global top-loading bar (NextTopLoader, in the root layout) is brand green
  // by default — correct for the Wielo app. On a HOST's themed site, point it at
  // the theme's accent by setting --wielo-toploader on :root (the bar lives at the
  // <body> level, outside this div). Wielo pages never render SiteThemeRoot, so
  // they keep the green fallback.
  const accent =
    (vars as Record<string, string | undefined>)["--site-accent"] || undefined;
  // Content-link styling (Brand Studio → Links). Scoped to CONTENT (`main …`) and
  // excludes booking/CTA buttons, so the header menu + buttons keep their own
  // colours. Only emitted when the host sets a link colour/hover.
  const linkColor = theme?.links?.color?.trim();
  const linkHover = theme?.links?.hoverColor?.trim();
  const linkCss =
    linkColor || linkHover
      ? ".wielo-site-root main a:not([data-wielo-book]):not(.wielo-btn)" +
        (linkColor ? `{color:${linkColor}}` : "{}") +
        (linkHover
          ? ".wielo-site-root main a:not([data-wielo-book]):not(.wielo-btn):hover" +
            `{color:${linkHover}}`
          : "")
      : "";
  return (
    <div
      style={{
        ...vars,
        background: "var(--site-bg)",
        color: "var(--site-ink)",
        fontFamily: "var(--site-font-body)",
        fontWeight: "var(--site-weight-body)" as unknown as number,
        fontSize: "var(--site-text-base)",
        lineHeight: "var(--site-leading-body)" as unknown as number,
        letterSpacing: "var(--site-tracking-body)",
      }}
      className={
        ["wielo-site-root", className, skinClass].filter(Boolean).join(" ") ||
        undefined
      }
    >
      <SiteFontLinks theme={theme} />
      {accent ? <style>{`:root{--wielo-toploader:${accent}}`}</style> : null}
      {linkCss ? <style>{linkCss}</style> : null}
      {children}
    </div>
  );
}
