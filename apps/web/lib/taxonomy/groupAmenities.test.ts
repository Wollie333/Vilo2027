import { describe, expect, it } from "vitest";

import { buildAmenityCategories } from "./groupAmenities";
import type { AmenityGroupWithItems } from "./types";

function group(
  id: string,
  label: string,
  icon: string,
  items: [string, string][],
): AmenityGroupWithItems {
  const base = {
    is_published: true,
    sort_order: 0,
    created_at: "",
    updated_at: "",
    deleted_at: null,
  };
  return {
    id,
    slug: id,
    label,
    icon,
    ...base,
    items: items.map(([slug, l], i) => ({
      id: `${id}-${slug}`,
      group_id: id,
      slug,
      label: l,
      icon: "circle-check",
      ...base,
      sort_order: i,
    })),
  };
}

const catalog: AmenityGroupWithItems[] = [
  group("internet", "Internet", "wifi", [["wifi", "Free WiFi"]]),
  group("rooms", "In the rooms", "bed-double", [
    ["tv", "TV"],
    ["aircon", "Air conditioning"],
  ]),
];

describe("buildAmenityCategories", () => {
  it("groups selected keys by category, dropping empty categories", () => {
    const cats = buildAmenityCategories(catalog, ["wifi", "tv"]);
    expect(cats.map((c) => c.label)).toEqual(["Internet", "In the rooms"]);
    expect(cats[0].items.map((i) => i.key)).toEqual(["wifi"]);
    expect(cats[1].items.map((i) => i.label)).toEqual(["TV"]);
  });

  it("preserves catalog order and only includes selected items", () => {
    const cats = buildAmenityCategories(catalog, ["aircon"]);
    // "internet" has no selected item → dropped; "rooms" shows only aircon.
    expect(cats).toHaveLength(1);
    expect(cats[0].id).toBe("rooms");
    expect(cats[0].items.map((i) => i.key)).toEqual(["aircon"]);
  });

  it("drops keys the admin catalog doesn't define (admin categories only)", () => {
    // A host can only ever select catalog amenities; an off-catalog key
    // (legacy/deactivated) is not rendered — only admin-managed categories show.
    const cats = buildAmenityCategories(catalog, ["wifi", "rooftop_deck"]);
    expect(cats.map((c) => c.id)).toEqual(["internet"]);
    expect(cats.flatMap((c) => c.items.map((i) => i.key))).toEqual(["wifi"]);
  });

  it("returns [] when nothing is selected", () => {
    expect(buildAmenityCategories(catalog, [])).toEqual([]);
  });
});
