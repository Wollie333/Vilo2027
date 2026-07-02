import { describe, expect, it } from "vitest";

import {
  DEMO_BOOKING,
  DEMO_ROOM_DETAIL,
  DEMO_ROOMS,
  sampleDataForDoc,
} from "@/lib/site/sampleSite";
import type { RenderableWidgetType } from "@/lib/website/pageDoc.schema";
import {
  newPageDoc,
  newSection,
  newWidget,
} from "@/lib/website/widgets/factories";
import { dataFor } from "@/lib/site/types";
import type { WidgetNode } from "@/lib/website/pageDoc.schema";

// A single-column section holding the given widgets.
function docWith(...widgets: WidgetNode[]) {
  const section = newSection([12]);
  section.kids[0].kids = widgets;
  return newPageDoc([section]);
}

describe("sampleDataForDoc", () => {
  it("keys rooms grid + gallery sample data by node id", () => {
    const rooms = newWidget("rooms_preview");
    const gallery = newWidget("gallery");
    const data = sampleDataForDoc(docWith(rooms, gallery));

    expect(dataFor(data, rooms.id, "rooms_preview")).toBe(DEMO_ROOMS);
    expect(dataFor(data, gallery.id, "gallery")?.images.length).toBe(6);
  });

  it("room card with no room_id resolves to the first room", () => {
    const card = newWidget("el_room_card");
    const data = sampleDataForDoc(docWith(card));
    expect(dataFor(data, card.id, "el_room_card")?.id).toBe(
      DEMO_ROOMS.rooms[0].id,
    );
  });

  it("room card with a room_id resolves that room", () => {
    const target = DEMO_ROOMS.rooms[1];
    const card = newWidget("el_room_card", { room_id: target.id });
    const data = sampleDataForDoc(docWith(card));
    expect(dataFor(data, card.id, "el_room_card")?.name).toBe(target.name);
  });

  it("keys booking-funnel sample data for booking widgets", () => {
    const bar = newWidget("booking_search");
    const cal = newWidget("availability_calendar");
    const data = sampleDataForDoc(docWith(bar, cal));
    expect(dataFor(data, bar.id, "booking_search")).toBe(DEMO_BOOKING);
    expect(
      dataFor(data, cal.id, "availability_calendar")?.properties.length,
    ).toBe(2);
  });

  it("keys the sample RoomDetail for every room-scoped widget", () => {
    // Room-scoped types live outside the curated registry — build raw nodes.
    const raw = (type: RenderableWidgetType): WidgetNode => ({
      id: `n-${type}`,
      type,
      props: {},
    });
    const gallery = raw("room_gallery");
    const rate = raw("room_rate");
    const data = sampleDataForDoc(docWith(gallery, rate));
    expect(dataFor(data, gallery.id, "room_gallery")).toBe(DEMO_ROOM_DETAIL);
    expect(dataFor(data, rate.id, "room_rate")?.name).toBe("Garden Suite");
  });

  it("ignores non-auto-populate widgets", () => {
    const heading = newWidget("el_heading");
    const data = sampleDataForDoc(docWith(heading));
    expect(data[heading.id]).toBeUndefined();
  });
});
