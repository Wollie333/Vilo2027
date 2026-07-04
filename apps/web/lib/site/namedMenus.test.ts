import { describe, expect, it } from "vitest";

import {
  MAIN_MENU_ID,
  MAIN_MENU_NAME,
  primaryMenuItems,
  resolveNamedMenus,
  resolvePrimaryMenuId,
  withNamedMenus,
} from "./namedMenus";
import type { SiteMenuItem, SiteNavigation } from "./types";

const item = (id: string): SiteMenuItem => ({ id, label: id, href: `/${id}` });

describe("resolveNamedMenus", () => {
  it("wraps a legacy single menu into a Main menu", () => {
    const nav: SiteNavigation = { menu: [item("home"), item("about")] };
    const menus = resolveNamedMenus(nav);
    expect(menus).toHaveLength(1);
    expect(menus[0].id).toBe(MAIN_MENU_ID);
    expect(menus[0].name).toBe(MAIN_MENU_NAME);
    expect(menus[0].items.map((i) => i.id)).toEqual(["home", "about"]);
  });

  it("returns a Main menu with empty items when nothing is set", () => {
    expect(resolveNamedMenus({})).toEqual([
      { id: MAIN_MENU_ID, name: MAIN_MENU_NAME, items: [] },
    ]);
  });

  it("passes through explicit named menus untouched", () => {
    const nav: SiteNavigation = {
      menus: [
        { id: "a", name: "A", items: [item("x")] },
        { id: "b", name: "B", items: [] },
      ],
    };
    expect(resolveNamedMenus(nav)).toBe(nav.menus);
  });
});

describe("resolvePrimaryMenuId", () => {
  it("uses the stored id when it points at a real menu", () => {
    const nav: SiteNavigation = {
      menus: [
        { id: "a", name: "A", items: [] },
        { id: "b", name: "B", items: [] },
      ],
      primaryMenuId: "b",
    };
    expect(resolvePrimaryMenuId(nav)).toBe("b");
  });

  it("falls back to the first menu when the stored id is stale", () => {
    const nav: SiteNavigation = {
      menus: [{ id: "a", name: "A", items: [] }],
      primaryMenuId: "gone",
    };
    expect(resolvePrimaryMenuId(nav)).toBe("a");
  });

  it("defaults to the Main menu id for a legacy nav", () => {
    expect(resolvePrimaryMenuId({ menu: [item("home")] })).toBe(MAIN_MENU_ID);
  });
});

describe("primaryMenuItems", () => {
  it("returns the primary menu's items", () => {
    const nav: SiteNavigation = {
      menus: [
        { id: "a", name: "A", items: [item("x")] },
        { id: "b", name: "B", items: [item("y"), item("z")] },
      ],
      primaryMenuId: "b",
    };
    expect(primaryMenuItems(nav).map((i) => i.id)).toEqual(["y", "z"]);
  });
});

describe("withNamedMenus", () => {
  it("mirrors the primary menu's items into `menu` (render SSOT)", () => {
    const nav: SiteNavigation = {
      menus: [
        { id: "a", name: "A", items: [item("x")] },
        { id: "b", name: "B", items: [item("y")] },
      ],
      primaryMenuId: "b",
    };
    const out = withNamedMenus(nav);
    expect(out.menu?.map((i) => i.id)).toEqual(["y"]);
    expect(out.primaryMenuId).toBe("b");
    expect(out.menus).toBe(nav.menus);
  });

  it("upgrades a legacy nav in place (menus + primaryMenuId + mirror)", () => {
    const out = withNamedMenus({ menu: [item("home")] });
    expect(out.menus).toHaveLength(1);
    expect(out.menus?.[0].id).toBe(MAIN_MENU_ID);
    expect(out.primaryMenuId).toBe(MAIN_MENU_ID);
    expect(out.menu?.map((i) => i.id)).toEqual(["home"]);
  });
});
