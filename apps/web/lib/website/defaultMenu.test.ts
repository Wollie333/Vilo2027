import { describe, expect, it, vi } from "vitest";

// defaultMenu is server-only; stub the marker so it imports under node.
vi.mock("server-only", () => ({}));

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

describe("buildDefaultMenu", () => {
  it("lists in-nav pages by order and excludes the room_detail template", () => {
    expect(buildDefaultMenu(pages).map((i) => i.href)).toEqual([
      "/",
      "/rooms",
      "/about",
    ]);
  });

  it("flags the Rooms item as auto-rooms (live dropdown) with an empty hidden set", () => {
    const rooms = buildDefaultMenu(pages).find((i) => i.href === "/rooms");
    expect(rooms?.autoRooms).toBe(true);
    expect(rooms?.hiddenRoomIds).toEqual([]);
    // Only the Rooms item is auto.
    expect(
      buildDefaultMenu(pages).find((i) => i.href === "/")?.autoRooms,
    ).toBeUndefined();
  });
});
