import type { SiteMenuItem, SiteNamedMenu, SiteNavigation } from "./types";

// Named-menu (multi-menu) model helpers — pure + client-safe, shared by the
// builder overlay (client) and the default-menu seeder (server).
//
// A site holds `navigation.menus` (named menus) and `navigation.primaryMenuId`
// (which one the header uses). For back-compat the header render path still reads
// `navigation.menu`, so we keep that mirrored to the primary menu's items.

export const MAIN_MENU_ID = "main";
export const MAIN_MENU_NAME = "Main menu";

let nmSeq = 0;
/** A fresh menu id. Not called during SSR of the same doc, so Date.now is fine. */
export function newMenuId(): string {
  return `menu-${Date.now().toString(36)}-${++nmSeq}`;
}

/**
 * The site's named menus, synthesising a single "Main menu" from the legacy
 * `navigation.menu` when none exist yet (first upgrade / old sites). Always
 * returns at least one menu.
 */
export function resolveNamedMenus(nav: SiteNavigation): SiteNamedMenu[] {
  if (nav.menus && nav.menus.length > 0) return nav.menus;
  return [{ id: MAIN_MENU_ID, name: MAIN_MENU_NAME, items: nav.menu ?? [] }];
}

/** Id of the primary (header) menu — the stored one when valid, else the first. */
export function resolvePrimaryMenuId(
  nav: SiteNavigation,
  menus: SiteNamedMenu[] = resolveNamedMenus(nav),
): string {
  if (nav.primaryMenuId && menus.some((m) => m.id === nav.primaryMenuId))
    return nav.primaryMenuId;
  return menus[0]?.id ?? MAIN_MENU_ID;
}

/** Items of the primary menu — what the header renders. */
export function primaryMenuItems(nav: SiteNavigation): SiteMenuItem[] {
  const menus = resolveNamedMenus(nav);
  const id = resolvePrimaryMenuId(nav, menus);
  return menus.find((m) => m.id === id)?.items ?? menus[0]?.items ?? [];
}

/**
 * Normalise a navigation object into the named-menu shape with `menu` mirrored
 * from the primary menu, so the existing render path (SiteChrome reads
 * `navigation.menu`) stays correct after any edit.
 */
export function withNamedMenus(nav: SiteNavigation): SiteNavigation {
  const menus = resolveNamedMenus(nav);
  const primaryMenuId = resolvePrimaryMenuId(nav, menus);
  const primary = menus.find((m) => m.id === primaryMenuId) ?? menus[0];
  return { ...nav, menus, primaryMenuId, menu: primary?.items ?? [] };
}
