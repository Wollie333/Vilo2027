import { describe, expect, it } from "vitest";

import {
  resolveGuestNextAction,
  type GuestNextActionInput,
} from "./next-action";

// A guest with nothing pending — the neutral fallback. Each test overrides only
// the fields that trigger its situation, so the priority ladder is exercised in
// isolation.
function base(): GuestNextActionInput {
  return {
    firstName: "Aisha",
    bookings: [],
    quotes: [],
    unreadFromGuest: 0,
    requestableCount: 0,
    isInhouse: false,
    nextStay: null,
    nextStayInDays: null,
    lastStay: null,
    newBookingHref: "/dashboard/bookings/new?guestName=Aisha",
  };
}

describe("resolveGuestNextAction", () => {
  it("1 · accepted quote → create the booking", () => {
    const a = resolveGuestNextAction({
      ...base(),
      quotes: [{ id: "q1", status: "accepted" }],
    });
    expect(a.key).toBe("quote_accepted");
    expect(a.cta).toMatchObject({
      kind: "route",
      href: "/dashboard/quotes/q1",
    });
  });

  it("2 · draft quote → respond to quote", () => {
    const a = resolveGuestNextAction({
      ...base(),
      quotes: [{ id: "q2", status: "draft" }],
    });
    expect(a.key).toBe("quote_requested");
    expect(a.cta).toMatchObject({
      kind: "route",
      href: "/dashboard/quotes/q2",
    });
  });

  it("3 · unpaid booking → send payment request (soonest stay first)", () => {
    const a = resolveGuestNextAction({
      ...base(),
      bookings: [
        {
          id: "b-late",
          status: "pending",
          checkIn: "2026-09-01",
          balanceDue: 1000,
          listingName: "Garden Cottage",
        },
        {
          id: "b-soon",
          status: "pending",
          checkIn: "2026-06-20",
          balanceDue: 500,
          listingName: "Sea Point Suite",
        },
      ],
    });
    expect(a.key).toBe("payment_due");
    expect(a.cta).toMatchObject({
      kind: "route",
      href: "/dashboard/bookings/b-soon",
    });
  });

  it("3 · ignores cancelled bookings and floating-point dust", () => {
    const a = resolveGuestNextAction({
      ...base(),
      bookings: [
        {
          id: "b-cx",
          status: "cancelled_by_guest",
          checkIn: "2026-06-20",
          balanceDue: 999,
          listingName: "Sea Point Suite",
        },
        {
          id: "b-dust",
          status: "confirmed",
          checkIn: "2026-06-20",
          balanceDue: 0.004,
          listingName: "Sea Point Suite",
        },
      ],
      nextStay: "2026-06-20",
      nextStayInDays: 9,
    });
    // No real balance owing → falls through to pre-arrival, not payment.
    expect(a.key).toBe("pre_arrival");
  });

  it("4 · unread guest message → reply", () => {
    const a = resolveGuestNextAction({ ...base(), unreadFromGuest: 2 });
    expect(a.key).toBe("needs_reply");
    expect(a.body).toContain("2 unread");
    expect(a.cta).toMatchObject({ kind: "tab", tab: "messages" });
  });

  it("5 · in-house → mid-stay message routes to the checked-in booking", () => {
    const a = resolveGuestNextAction({
      ...base(),
      isInhouse: true,
      bookings: [
        {
          id: "b-stay",
          status: "checked_in",
          checkIn: "2026-06-09",
          balanceDue: 0,
          listingName: "Sea Point Suite",
        },
      ],
    });
    expect(a.key).toBe("in_house");
    expect(a.cta).toMatchObject({
      kind: "route",
      href: "/dashboard/bookings/b-stay",
    });
  });

  it("6 · upcoming confirmed → pre-arrival", () => {
    const a = resolveGuestNextAction({
      ...base(),
      nextStay: "2026-06-20",
      nextStayInDays: 1,
      bookings: [
        {
          id: "b-up",
          status: "confirmed",
          checkIn: "2026-06-20",
          balanceDue: 0,
          listingName: "Sea Point Suite",
        },
      ],
    });
    expect(a.key).toBe("pre_arrival");
    expect(a.headline).toContain("tomorrow");
  });

  it("7 · reviewable completed stay → request a review", () => {
    const a = resolveGuestNextAction({ ...base(), requestableCount: 1 });
    expect(a.key).toBe("request_review");
    expect(a.cta).toMatchObject({ kind: "tab", tab: "reviews" });
  });

  it("8 · nothing pending → win-back create-a-booking", () => {
    const a = resolveGuestNextAction({ ...base(), lastStay: "2025-09-15" });
    expect(a.key).toBe("no_upcoming");
    expect(a.cta).toMatchObject({
      kind: "route",
      href: "/dashboard/bookings/new?guestName=Aisha",
    });
  });

  it("priority · accepted quote wins over unpaid booking and unread message", () => {
    const a = resolveGuestNextAction({
      ...base(),
      quotes: [{ id: "q1", status: "accepted" }],
      unreadFromGuest: 5,
      bookings: [
        {
          id: "b1",
          status: "pending",
          checkIn: "2026-06-20",
          balanceDue: 500,
          listingName: "Sea Point Suite",
        },
      ],
    });
    expect(a.key).toBe("quote_accepted");
  });

  it("falls back to 'this guest' when no name is given", () => {
    const a = resolveGuestNextAction({
      ...base(),
      firstName: "  ",
      unreadFromGuest: 1,
    });
    expect(a.body).toContain("this guest");
  });
});
