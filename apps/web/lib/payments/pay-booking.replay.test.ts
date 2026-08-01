// PayPal free-stay replay — the security regression proof for the guard in
// capturePayPalOrderForBooking (commit "fix(payments): close PayPal order-id
// replay + host-key platform fallback").
//
// THE BUG (BLOCKER): the capture helper resolved the payment row by
// provider_reference ALONE and then confirmed the booking unconditionally. So a
// guest who had ever completed one PayPal order could reuse that COMPLETED order
// id on a second, unpaid booking's pay link — /pay/<tokenB>?token=<orderIdA> —
// and the foreign completed row skipped capture while the target booking was
// flipped to `confirmed` with paid=0. A free confirmed stay.
//
// THE FIX: scope the payment lookup with .eq("booking_id", …) (mirrors the
// Paystack twin) so a replayed order id finds no row for THIS booking, plus gate
// the confirm on the recomputed payment_status.
//
// This drives the REAL capturePayPalOrderForBooking with a mocked admin client
// and resolvable PayPal creds. The mock is shaped so that on the OLD (vulnerable)
// code it would return true AND update the booking, and on the fixed code it
// returns false and touches nothing — so the assertions genuinely distinguish
// fixed from broken, not just "the mock returned null".

import { beforeEach, describe, expect, it, vi } from "vitest";

// Everything the hoisted vi.mock factories reference must itself be hoisted, or
// it is in the temporal dead zone when the factory runs at import time.
const h = vi.hoisted(() => {
  const ORDER_A = "PAYPAL-ORDER-THAT-BELONGS-TO-A";
  const BOOKING_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const BOOKING_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  // In-memory `payments` table: exactly ONE completed row, belonging to booking
  // A. The victim booking B has no paid payment of its own.
  const paymentsRows: Record<string, unknown>[] = [
    {
      id: "pay-A",
      status: "completed",
      provider_reference: ORDER_A,
      booking_id: BOOKING_A,
    },
  ];

  // Flips true if anything ever issues a bookings UPDATE (a confirm). On the
  // fixed code the replay returns before any write, so this stays false.
  const state = { bookingUpdated: false };

  // The PayPal API must NEVER be touched on a replay — the guard returns first.
  const capturePayPalOrder = vi.fn(async () => {
    throw new Error("capturePayPalOrder must not be called on a replay");
  });
  const getPayPalOrder = vi.fn(async () => {
    throw new Error("getPayPalOrder must not be called on a replay");
  });

  function selectQuery(rows: Record<string, unknown>[]) {
    const filters: [string, unknown][] = [];
    const match = () =>
      rows.find((r) => filters.every(([c, v]) => r[c] === v)) ?? null;
    const q = {
      select: () => q,
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        return q;
      },
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: match(), error: null }),
      single: async () => ({ data: match(), error: null }),
    };
    return q;
  }

  function bookingsQuery() {
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
      update: () => {
        state.bookingUpdated = true; // a confirm would land here — must NOT happen
        return {
          eq: () => ({
            eq: () => ({ select: async () => ({ data: [], error: null }) }),
          }),
        };
      },
    };
    return q;
  }

  const adminMock = {
    rpc: async (fn: string) =>
      fn === "booking_business_id"
        ? { data: "biz-1", error: null }
        : { data: null, error: null },
    from: (table: string) =>
      table === "payments"
        ? selectQuery(paymentsRows)
        : table === "bookings"
          ? bookingsQuery()
          : selectQuery([]),
  };

  return {
    ORDER_A,
    BOOKING_B,
    state,
    capturePayPalOrder,
    getPayPalOrder,
    adminMock,
  };
});

// Host PayPal creds ALWAYS resolve — this is essential: it proves a `false`
// result can only come from the booking_id guard, never from the "no connected
// gateway" early return at the top of the function.
vi.mock("@/lib/payments/host-paypal", () => {
  const creds = { clientId: "c", secret: "s", env: "test" as const };
  return {
    getHostPayPalForBusiness: vi.fn(async () => creds),
    getHostPayPal: vi.fn(async () => creds),
  };
});

vi.mock("@/lib/paypal", () => ({
  createPayPalOrder: vi.fn(),
  capturePayPalOrder: h.capturePayPalOrder,
  getPayPalOrder: h.getPayPalOrder,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => h.adminMock,
}));

// Side-effect modules pay-booking imports but the replay path never calls. They
// transitively pull lib/brand.ts (React `cache()`), which isn't available in the
// node test env — stub them so the module graph loads.
vi.mock("@/lib/notifications/dispatch", () => ({ dispatchEvent: vi.fn() }));
vi.mock("@/lib/messaging/system-card", () => ({
  postPaymentConfirmedCard: vi.fn(),
}));
vi.mock("@/lib/admin/notify", () => ({ notifyAdmins: vi.fn() }));

import { capturePayPalOrderForBooking } from "./pay-booking";

beforeEach(() => {
  h.state.bookingUpdated = false;
  h.capturePayPalOrder.mockClear();
  h.getPayPalOrder.mockClear();
});

describe("capturePayPalOrderForBooking — free-stay replay guard", () => {
  it("refuses a COMPLETED order id replayed onto a different unpaid booking", async () => {
    const result = await capturePayPalOrderForBooking({
      orderId: h.ORDER_A, // a genuinely completed order — but it belongs to booking A
      hostId: "host-1",
      bookingId: h.BOOKING_B, // the victim: a second, unpaid booking
    });

    expect(result).toBe(false); // NOT confirmed for free
    expect(h.state.bookingUpdated).toBe(false); // booking B never flipped to confirmed
    expect(h.capturePayPalOrder).not.toHaveBeenCalled(); // never touched the PayPal API
    expect(h.getPayPalOrder).not.toHaveBeenCalled();
  });

  it("refuses a fabricated / unknown order id", async () => {
    const result = await capturePayPalOrderForBooking({
      orderId: "TOTALLY-MADE-UP-ORDER-ID",
      hostId: "host-1",
      bookingId: h.BOOKING_B,
    });

    expect(result).toBe(false);
    expect(h.state.bookingUpdated).toBe(false);
    expect(h.capturePayPalOrder).not.toHaveBeenCalled();
  });
});
