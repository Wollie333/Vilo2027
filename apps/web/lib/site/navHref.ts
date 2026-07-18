/**
 * Pure nav-href helpers shared by the generic SiteChrome and the bespoke
 * per-theme chrome (e.g. OceansView). Kept dependency-free so a "use client"
 * component can import them without pulling in server-only chrome modules.
 */

/** Convert an internal href like "/" or "/about" to a page key. */
export function hrefToPageKey(href: string): string {
  if (href === "/" || href === "") return "home";
  // Strip leading slash and hash fragments
  const clean = href.replace(/^\//, "").split("#")[0];
  return clean || "home";
}

/** Build a preview-aware href for navigation links. */
export function buildNavHref(
  href: string,
  preview?: { subdomain: string; themeSlug?: string },
): string {
  // External links pass through unchanged
  if (href.startsWith("http")) return href;
  // No preview mode — use regular href
  if (!preview) return href;

  // In preview mode, build a URL that preserves preview params
  const params = new URLSearchParams();
  params.set("site", preview.subdomain);
  params.set("preview", "1");
  if (preview.themeSlug) params.set("theme", preview.themeSlug);

  // Normalize path: "/" becomes "/site", "/about" becomes "/site/about"
  const cleanPath = href.startsWith("/") ? href : `/${href}`;
  const basePath = cleanPath === "/" ? "/site" : `/site${cleanPath}`;

  return `${basePath}?${params.toString()}`;
}
