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
  return (
    <div
      style={{
        ...buildSiteVars(theme),
        background: "var(--site-bg)",
        color: "var(--site-ink)",
        fontFamily: "var(--site-font-body)",
      }}
      className={className}
    >
      {children}
    </div>
  );
}
