import type { SiteMenuItem } from "./types";

// Per-page menu rules — the small shared helpers for "show/hide a link on
// specific pages". A page is identified by a stable KEY: "home" for the home
// page, otherwise the page slug. The nav editor's backdrop switcher uses the same
// key, so the canvas preview (which page sits behind the menu) and the live site
// filter identically.

/** The page key for per-page menu rules (home → "home", else the slug). */
export function pageKeyFor(kind: string, slug: string): string {
  return kind === "home" ? "home" : slug;
}

/** Page key from a site-relative nav href ("/" → "home", "/about" → "about"). */
export function pageKeyFromHref(href: string): string {
  const h = (href || "").trim();
  if (h === "/" || h === "") return "home";
  return h.replace(/^\//, "").split(/[?#]/)[0];
}

/**
 * Drop menu items the host hid on the given page (recursively, so a hidden parent
 * removes its dropdown too). Pure — returns the same array when nothing is hidden
 * or no page key is supplied (so the live site without a page context is unaffected).
 */
export function filterMenuForPage(
  menu: SiteMenuItem[],
  pageKey?: string | null,
): SiteMenuItem[] {
  if (!pageKey) return menu;
  if (!menu.some((i) => i.hiddenOnPages?.length || i.children?.length))
    return menu;
  return menu
    .filter((i) => !(i.hiddenOnPages ?? []).includes(pageKey))
    .map((i) =>
      i.children?.length
        ? { ...i, children: filterMenuForPage(i.children, pageKey) }
        : i,
    );
}
