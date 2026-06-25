import { describe, expect, it, vi } from "vitest";

// defaultMenu is server-only and imports the heavy loadSitePage module; stub both
// so we can unit-test the pure buildDefaultMenu.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/site/loadSitePage", () => ({ roomSlugMap: () => new Map() }));

import { buildDefaultMenu } from "./defaultMenu";

const pages = [
  {
    kind: "home",
    slug: "home",
    nav_label: null,
    title: "Home",
    nav_order: 0,
    show_in_nav: true,
  },
  {
    kind: "rooms",
    slug: "rooms",
    nav_label: null,
    title: "Rooms",
    nav_order: 1,
    show_in_nav: true,
  },
  {
    kind: "custom",
    slug: "about",
    nav_label: null,
    title: "About",
    nav_order: 2,
    show_in_nav: true,
  },
  // The room-detail template must never appear in the menu.
  {
    kind: "room_detail",
    slug: "room-detail",
    nav_label: null,
    title: "Room details",
    nav_order: 9,
    show_in_nav: true,
  },
];

const roomLinks = [
  { id: "room-1", label: "Olive Room", href: "/rooms/olive-room" },
  { id: "room-2", label: "Vineyard Suite", href: "/rooms/vineyard-suite" },
];

describe("buildDefaultMenu", () => {
  it("lists in-nav pages by order and excludes the room_detail template", () => {
    expect(buildDefaultMenu(pages).map((i) => i.href)).toEqual([
      "/",
      "/rooms",
      "/about",
    ]);
  });

  it("nests room links as a sub-menu under the Rooms item", () => {
    const menu = buildDefaultMenu(pages, roomLinks);
    const rooms = menu.find((i) => i.href === "/rooms");
    expect(rooms?.children?.map((c) => c.href)).toEqual([
      "/rooms/olive-room",
      "/rooms/vineyard-suite",
    ]);
    // Only the Rooms item gets the children.
    expect(menu.find((i) => i.href === "/")?.children).toBeUndefined();
    expect(menu.find((i) => i.href === "/about")?.children).toBeUndefined();
  });

  it("adds no children when there are no room links (single/zero rooms)", () => {
    const rooms = buildDefaultMenu(pages, []).find((i) => i.href === "/rooms");
    expect(rooms?.children).toBeUndefined();
  });
});
