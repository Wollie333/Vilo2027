import type { ReactNode } from "react";

import { buildSiteVars, type SiteThemeConfig } from "@/lib/site/themes";

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
  // The global top-loading bar (NextTopLoader, in the root layout) is brand green
  // by default — correct for the Wielo app. On a HOST's themed site, point it at
  // the theme's accent by setting --wielo-toploader on :root (the bar lives at the
  // <body> level, outside this div). Wielo pages never render SiteThemeRoot, so
  // they keep the green fallback.
  const accent =
    (vars as Record<string, string | undefined>)["--site-accent"] || undefined;
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
      className={className}
    >
      {accent ? <style>{`:root{--wielo-toploader:${accent}}`}</style> : null}
      {children}
    </div>
  );
}
