// Pure host classifier for the middleware (no Next imports, so it's unit-testable).
//
// The middleware runs on EVERY request and is the single guard protecting the
// whole app. This module decides — from the Host header alone — whether a request
// belongs to the app (vilo.site / app.vilo.site / localhost / *.vercel.app /
// reserved subdomains) or to a tenant micro-site (<sub>.vilo.site or a connected
// custom domain). It is deliberately FAIL-SAFE: with no NEXT_PUBLIC_ROOT_DOMAIN
// configured, EVERYTHING classifies as "app", so the feature is opt-in by env and
// the app's existing routing can never regress.

// Subdomains that must never be claimed as a tenant site (enforced here AND at
// claim time). Includes the app's own hostnames + the locale codes so a tenant
// can't shadow /en, /af, … .
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  "app",
  "www",
  "api",
  "admin",
  "mail",
  "smtp",
  "ftp",
  "ns1",
  "ns2",
  "staging",
  "dev",
  "blog",
  "help",
  "docs",
  "status",
  "assets",
  "cdn",
  "static",
  "vilo",
  // locale codes
  "en",
  "af",
  "fr",
  "de",
  "pt",
]);

export type HostClass = { kind: "app" } | { kind: "site"; ref: string };

/**
 * Classify a Host header into app vs tenant-site. `ref` is the subdomain label
 * (e.g. "stillwater") or the full custom-domain host. Port + case are normalised.
 */
export function classifyHost(
  host: string | null | undefined,
  rootDomain: string | null | undefined,
): HostClass {
  if (!host) return { kind: "app" };
  const h = host.split(":")[0].trim().toLowerCase();
  if (!h) return { kind: "app" };

  // Always-app: loopback + Vercel preview/deploy URLs.
  if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") {
    return { kind: "app" };
  }
  if (h.endsWith(".vercel.app")) return { kind: "app" };

  const root = rootDomain?.split(":")[0].trim().toLowerCase();
  // Feature opt-in: without a root domain, nothing is ever a tenant.
  if (!root) return { kind: "app" };

  if (h === root || h === `www.${root}` || h === `app.${root}`) {
    return { kind: "app" };
  }

  // Subdomain of the root (or of localhost, for `foo.localhost` dev).
  for (const base of [root, "localhost"]) {
    if (h.endsWith(`.${base}`)) {
      const sub = h.slice(0, -(base.length + 1));
      // No empty, no multi-level (a.b.root), no reserved labels → treat as app.
      if (!sub || sub.includes(".") || RESERVED_SUBDOMAINS.has(sub)) {
        return { kind: "app" };
      }
      return { kind: "site", ref: sub };
    }
  }

  // A different apex domain → a connected custom domain. The loader resolves it
  // to a website row or 404s (unknown Host = 404, never a passthrough).
  return { kind: "site", ref: h };
}

/** Internal rewrite target for a tenant request: /{locale}/site{pathname}. */
export function siteRewritePath(pathname: string, locale: string): string {
  const p = pathname === "/" ? "" : pathname;
  return `/${locale}/site${p}`;
}

/** Bare-host SEO files that tenant sites serve from their per-site routes. */
export function isSeoFile(pathname: string): boolean {
  return (
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/feed.xml"
  );
}
