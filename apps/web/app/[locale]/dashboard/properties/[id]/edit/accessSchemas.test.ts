import { describe, expect, it } from "vitest";

import {
  ACCESS_LEAD_DEFAULT,
  ACCESS_LEAD_MAX,
  ACCESS_LEAD_MIN,
  listingAccessSchema,
  roomAccessSchema,
} from "./schemas";

// The six access fields both forms share. `send_lead_minutes` is deliberately
// absent — it is what the room form actually submits.
const sharedFields = {
  check_in_method: "Lockbox",
  check_in_instructions: "Code is on the door.",
  gate_code: "1234",
  door_code: "5678",
  wifi_network: "Wielo",
  wifi_password: "hunter2",
};

describe("listingAccessSchema (property-level)", () => {
  it("requires send_lead_minutes", () => {
    // The regression this file exists for: the ROOM form submits exactly
    // `sharedFields` and used to be validated against THIS schema, so
    // handleSubmit failed on a field the form never rendered — no onSubmit, no
    // <FormMessage/>, and a Save button that silently did nothing.
    expect(listingAccessSchema.safeParse(sharedFields).success).toBe(false);
  });

  it("accepts the property form's payload", () => {
    const r = listingAccessSchema.safeParse({
      ...sharedFields,
      send_lead_minutes: ACCESS_LEAD_DEFAULT,
    });
    expect(r.success).toBe(true);
  });

  it.each([ACCESS_LEAD_MIN, ACCESS_LEAD_MAX])("accepts %i minutes", (m) => {
    expect(
      listingAccessSchema.safeParse({ ...sharedFields, send_lead_minutes: m })
        .success,
    ).toBe(true);
  });

  it.each([ACCESS_LEAD_MIN - 1, ACCESS_LEAD_MAX + 1, 1.5])(
    "rejects %s minutes",
    (m) => {
      expect(
        listingAccessSchema.safeParse({ ...sharedFields, send_lead_minutes: m })
          .success,
      ).toBe(false);
    },
  );
});

describe("roomAccessSchema (room-level)", () => {
  it("accepts the room form's payload — no send_lead_minutes", () => {
    // A room has no lead time of its own: the access card + email are scheduled
    // per PROPERTY (property_access.send_lead_minutes), and
    // property_room_access has no such column.
    const r = roomAccessSchema.safeParse(sharedFields);
    expect(r.success).toBe(true);
  });

  it("still validates the shared fields", () => {
    expect(
      roomAccessSchema.safeParse({ ...sharedFields, gate_code: "x".repeat(61) })
        .success,
    ).toBe(false);
  });

  it("allows every field to be blank (all access is optional)", () => {
    expect(roomAccessSchema.safeParse({}).success).toBe(true);
  });

  it("does not carry send_lead_minutes through", () => {
    const r = roomAccessSchema.safeParse({
      ...sharedFields,
      send_lead_minutes: 999,
    });
    expect(r.success).toBe(true);
    // omit() strips it, so a room can never silently set a property-wide lead.
    expect(r.success && "send_lead_minutes" in r.data).toBe(false);
  });
});
