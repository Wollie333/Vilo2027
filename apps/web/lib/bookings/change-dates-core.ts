import "server-only";

import { revalidatePath } from "next/cache";

import { dispatchEvent } from "@/lib/notifications/dispatch";
import {
  recomputeBookingPaymentState,
  sumCompletedPaid,
} from "@/lib/payments/ledger";
import { nightsBetween } from "@/lib/pricing";
import { computeStayPricing } from "@/lib/pricing/quote";
import type { createAdminClient } from "@/lib/supabase/admin";

// Host-agnostic booking date-change core. Lives OUTSIDE any "use server" file so
// the functions that take a service-role `admin` client are never registered as
// client-callable server actions. Consumed by both the host approve path
// (dashboard/bookings/[id]/change-dates-actions) and the guest counter-offer
// accept path (portal/trips/[id]/actions) — one tested implementation.

type Admin = ReturnType<typeof createAdminClient>;

// Statuses whose dates the host may still move. A checked-in/completed/cancelled
// stay is done — its dates are history.
const EDITABLE = new Set([
  "pending",
  "confirmed",
  "pending_eft",
  "pending_eft_review",
]);

type BookingForEdit = {
  id: string;
  host_id: string;
  property_id: string;
  status: string;
  scope: string;
  guests_count: number;
  currency: string;
  cleaning_fee: number;
  vat_rate: number | null;
  rooms: { room_id: string }[];
  addonsTotal: number;
  check_in: string | null;
  check_out: string | null;
  guest_id: string | null;
};

async function loadBooking(
  admin: Admin,
  bookingId: string,
  hostId: string,
): Promise<BookingForEdit | { error: string }> {
  const { data: b } = await admin
    .from("bookings")
    .select(
      "id, host_id, property_id, status, scope, guests_count, currency, cleaning_fee, vat_rate, check_in, check_out, guest_id, booking_rooms ( room_id ), booking_addons ( subtotal )",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!b || b.host_id !== hostId) return { error: "Booking not found." };
  const rooms = ((b.booking_rooms as { room_id: string }[] | null) ?? []).map(
    (r) => ({ room_id: r.room_id }),
  );
  const addonsTotal = (
    (b.booking_addons as { subtotal: number }[] | null) ?? []
  ).reduce((s, a) => s + Number(a.subtotal), 0);
  return {
    id: b.id as string,
    host_id: b.host_id as string,
    property_id: b.property_id as string,
    status: b.status as string,
    scope: b.scope as string,
    guests_count: b.guests_count as number,
    currency: b.currency as string,
    cleaning_fee: Number(b.cleaning_fee ?? 0),
    vat_rate: b.vat_rate == null ? null : Number(b.vat_rate),
    rooms,
    addonsTotal,
    check_in: (b.check_in as string | null) ?? null,
    check_out: (b.check_out as string | null) ?? null,
    guest_id: (b.guest_id as string | null) ?? null,
  };
}

// Is the new range free for this booking's listing/rooms, IGNORING this booking's
// own blocks (so moving a booking never conflicts with itself)? Manual blocks,
// quote holds and OTHER bookings still count.
async function hasConflict(
  admin: Admin,
  b: BookingForEdit,
  checkIn: string,
  checkOut: string,
): Promise<boolean> {
  let q = admin
    .from("blocked_dates")
    .select("id", { count: "exact", head: true })
    .eq("property_id", b.property_id)
    .gte("date", checkIn)
    .lt("date", checkOut)
    .or(`booking_id.is.null,booking_id.neq.${b.id}`);
  const roomIds = b.rooms.map((r) => r.room_id);
  if (b.scope === "rooms" && roomIds.length > 0) {
    // A whole-listing block (room_id null) blocks any room; else our rooms.
    q = q.or(`room_id.is.null,room_id.in.(${roomIds.join(",")})`);
  }
  const { count } = await q;
  return (count ?? 0) > 0;
}

// Accommodation total (ex-VAT) for the new dates/guests/rooms via the canonical
// pricer, plus the booking's existing add-ons, grossed up by VAT — the SUGGESTED
// total. Seasonal-aware (computeStayPricing loads real property_seasonal_pricing).
// The host can override it before applying.
async function suggestTotalFor(
  admin: Admin,
  b: BookingForEdit,
  checkIn: string,
  checkOut: string,
  guestsCount: number,
  roomIds: string[],
): Promise<number | null> {
  const perRoomGuests = Math.max(
    1,
    Math.round(guestsCount / Math.max(1, roomIds.length)),
  );
  const priced = await computeStayPricing(
    admin,
    {
      property_id: b.property_id,
      check_in: checkIn,
      check_out: checkOut,
      scope: b.scope === "rooms" ? "rooms" : "whole_listing",
      guests: guestsCount,
      rooms: roomIds.map((room_id) => ({ room_id, guests: perRoomGuests })),
    },
    b.host_id,
  );
  if (!priced.ok) return null;
  const exVat = priced.data.total + b.addonsTotal;
  const rate = b.vat_rate ?? 0;
  return rate > 0 ? Math.round(exVat * (1 + rate / 100) * 100) / 100 : exVat;
}

// Same, keeping the booking's current guests + rooms (date-only change).
async function suggestTotal(
  admin: Admin,
  b: BookingForEdit,
  checkIn: string,
  checkOut: string,
): Promise<number | null> {
  return suggestTotalFor(
    admin,
    b,
    checkIn,
    checkOut,
    b.guests_count,
    b.rooms.map((r) => r.room_id),
  );
}

export type ChangeDatesPreview =
  | {
      ok: true;
      available: boolean;
      nights: number;
      suggestedTotal: number | null;
      currency: string;
    }
  | { ok: false; error: string };

export type ActionResult = { ok: true } | { ok: false; error: string };

// Availability + suggested total for a new range on a booking whose host is
// `hostId`. Callable with the service-role `admin` client by both the host
// preview wrapper and the guest counter-offer accept path.
export async function previewDateChangeCore(
  admin: Admin,
  bookingId: string,
  hostId: string,
  checkIn: string,
  checkOut: string,
): Promise<ChangeDatesPreview> {
  if (nightsBetween(checkIn, checkOut) <= 0)
    return { ok: false, error: "Check-out must be after check-in." };
  const b = await loadBooking(admin, bookingId, hostId);
  if ("error" in b) return { ok: false, error: b.error };
  const conflict = await hasConflict(admin, b, checkIn, checkOut);
  const suggestedTotal = conflict
    ? null
    : await suggestTotal(admin, b, checkIn, checkOut);
  return {
    ok: true,
    available: !conflict,
    nights: nightsBetween(checkIn, checkOut),
    suggestedTotal,
    currency: b.currency,
  };
}

// A booking "update" request can move dates, change the headcount and/or add
// rooms — all repriced through the one seasonal engine. `roomIds` (when given)
// is the FULL desired room set for a rooms-scoped booking (so the host can add a
// room for extra capacity); omit to keep the current rooms.
export type BookingUpdatePatch = {
  checkIn?: string;
  checkOut?: string;
  guestsCount?: number;
  roomIds?: string[];
};

export type BookingUpdatePreview =
  | {
      ok: true;
      available: boolean;
      nights: number;
      /** VAT-inclusive total for the whole updated stay, or null if unavailable. */
      newTotal: number | null;
      /** Net already paid (captured − refunded). */
      netPaid: number;
      /** newTotal − netPaid: >0 the guest owes more, <0 a refund/credit is due. */
      delta: number | null;
      currency: string;
    }
  | { ok: false; error: string };

// Price an update (dates/guests/rooms) for a booking and compare it to what's
// already been paid — the basis for the guest's live estimate AND the host's
// quote. Pure: reads + prices only, never mutates. `hostId` scopes the load.
export async function previewBookingUpdateCore(
  admin: Admin,
  bookingId: string,
  hostId: string,
  patch: BookingUpdatePatch,
): Promise<BookingUpdatePreview> {
  const b = await loadBooking(admin, bookingId, hostId);
  if ("error" in b) return { ok: false, error: b.error };

  const checkIn = patch.checkIn ?? b.check_in;
  const checkOut = patch.checkOut ?? b.check_out;
  if (!checkIn || !checkOut)
    return { ok: false, error: "This booking has no dates to change." };
  if (nightsBetween(checkIn, checkOut) <= 0)
    return { ok: false, error: "Check-out must be after check-in." };

  const guestsCount = patch.guestsCount ?? b.guests_count;
  const roomIds =
    patch.roomIds && patch.roomIds.length > 0
      ? patch.roomIds
      : b.rooms.map((r) => r.room_id);

  // Availability for the (possibly enlarged) room set + window, ignoring this
  // booking's own blocks.
  const conflict = await hasConflict(
    admin,
    { ...b, rooms: roomIds.map((room_id) => ({ room_id })) },
    checkIn,
    checkOut,
  );

  const netPaid = await sumCompletedPaid(admin, bookingId);
  const newTotal = conflict
    ? null
    : await suggestTotalFor(admin, b, checkIn, checkOut, guestsCount, roomIds);
  const delta =
    newTotal == null ? null : Math.round((newTotal - netPaid) * 100) / 100;

  return {
    ok: true,
    available: !conflict,
    nights: nightsBetween(checkIn, checkOut),
    newTotal,
    netPaid,
    delta,
    currency: b.currency,
  };
}

// Move a booking's dates + reprice, move calendar blocks, heal the payment
// ledger, refresh the invoice line_items, and notify the guest. `hostId` scopes
// the booking load (must equal the booking's host); `total` is authoritative
// (VAT inclusive) — the caller computes it (host override / suggested total).
export async function applyBookingDateChange(
  admin: Admin,
  input: {
    bookingId: string;
    hostId: string;
    checkIn: string;
    checkOut: string;
    total: number;
  },
): Promise<ActionResult> {
  const { bookingId, hostId, checkIn, checkOut, total } = input;
  if (nightsBetween(checkIn, checkOut) <= 0)
    return { ok: false, error: "Check-out must be after check-in." };

  const b = await loadBooking(admin, bookingId, hostId);
  if ("error" in b) return { ok: false, error: b.error };
  if (!EDITABLE.has(b.status)) {
    return {
      ok: false,
      error: `Can't move the dates of a ${b.status.replace(/_/g, " ")} booking.`,
    };
  }
  if (await hasConflict(admin, b, checkIn, checkOut)) {
    return {
      ok: false,
      error: "Those dates clash with another booking or a block.",
    };
  }

  // Host-controlled total. VAT is inclusive in total_amount (mirrors the
  // apply_booking_vat trigger which grosses up on INSERT but never on UPDATE).
  const rate = b.vat_rate ?? 0;
  const vatAmount =
    rate > 0 ? Math.round(((total * rate) / (100 + rate)) * 100) / 100 : 0;
  const baseAmount =
    Math.round((total - vatAmount - b.cleaning_fee - b.addonsTotal) * 100) /
    100;
  const newNights = nightsBetween(checkIn, checkOut);

  // Refresh the price_breakdown snapshot for the NEW dates — the old one described
  // the old stay (wrong nights / seasonal split). Best-effort: if repricing fails
  // we null it rather than leave a stale, misleading breakdown. The host may still
  // override `total` above; the snapshot records how the stay itself prices out.
  const repriced = await computeStayPricing(
    admin,
    {
      property_id: b.property_id,
      check_in: checkIn,
      check_out: checkOut,
      scope: b.scope === "rooms" ? "rooms" : "whole_listing",
      guests: b.guests_count,
      rooms: b.rooms.map((r) => ({
        room_id: r.room_id,
        guests: Math.max(
          1,
          Math.round(b.guests_count / Math.max(1, b.rooms.length)),
        ),
      })),
    },
    b.host_id,
  );
  const newBreakdown = repriced.ok
    ? {
        nights: repriced.data.nights,
        base_amount: repriced.data.base_amount,
        cleaning_fee: repriced.data.cleaning_fee,
        accommodation_total: repriced.data.total,
        rooms: repriced.data.rooms,
        repriced_at: new Date().toISOString(),
        source: "change_dates",
      }
    : null;

  const { error: upErr } = await admin
    .from("bookings")
    .update({
      check_in: checkIn,
      check_out: checkOut,
      base_amount: baseAmount,
      total_amount: total,
      vat_amount: vatAmount,
      price_breakdown: newBreakdown,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId);
  if (upErr) return { ok: false, error: "Couldn't update the booking." };

  // Move the calendar blocks to the new range (confirmed bookings hold blocks;
  // pending ones don't — the delete is then a harmless no-op).
  await admin.from("blocked_dates").delete().eq("booking_id", bookingId);
  if (b.status === "confirmed") {
    const nightsList: string[] = [];
    let d = checkIn;
    let guard = 0;
    while (d < checkOut && guard < 400) {
      nightsList.push(d);
      const nx = new Date(`${d}T00:00:00Z`);
      nx.setUTCDate(nx.getUTCDate() + 1);
      d = nx.toISOString().slice(0, 10);
      guard++;
    }
    const roomIds = b.rooms.map((r) => r.room_id);
    const blocks =
      b.scope === "rooms" && roomIds.length > 0
        ? roomIds.flatMap((room_id) =>
            nightsList.map((date) => ({
              property_id: b.property_id,
              room_id: room_id as string | null,
              date,
              reason: "booking",
              booking_id: bookingId,
            })),
          )
        : nightsList.map((date) => ({
            property_id: b.property_id,
            room_id: null as string | null,
            date,
            reason: "booking",
            booking_id: bookingId,
          }));
    if (blocks.length > 0) await admin.from("blocked_dates").insert(blocks);
  }

  // Heal balance_due + payment_status from the (unchanged) payment ledger.
  await recomputeBookingPaymentState(admin, bookingId);

  // Keep an existing invoice's figures — AND its itemised line_items — in step with
  // the new dates. The invoice PDF renders line_items.{check_in,check_out,nights,
  // base_amount}, frozen at issue time; without this refresh a moved booking shows
  // the new totals over the OLD dates. Merge only the date-driven fields (cleaning,
  // rooms, addons, discounts are unchanged by a date move).
  const { data: invoice } = await admin
    .from("invoices")
    .select("id, line_items")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (invoice) {
    const mergedLines = {
      ...((invoice.line_items as Record<string, unknown> | null) ?? {}),
      check_in: checkIn,
      check_out: checkOut,
      nights: newNights,
      base_amount: baseAmount,
    };
    await admin
      .from("invoices")
      .update({
        subtotal: Math.round((total - vatAmount) * 100) / 100,
        vat_amount: vatAmount,
        total_amount: total,
        line_items: mergedLines,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);
  }

  // Tell the guest their dates moved (they used to be notified NOTHING). The new
  // dates ride the now-updated booking; b.check_in/out still hold the OLD ones
  // (loaded before the UPDATE). Best-effort — dispatchEvent never throws.
  if (b.guest_id) {
    await dispatchEvent({
      kind: "booking_dates_changed_guest",
      recipientUserId: b.guest_id,
      guestId: b.guest_id,
      refs: {
        booking_id: bookingId,
        old_check_in: b.check_in ?? undefined,
        old_check_out: b.check_out ?? undefined,
        check_in: checkIn,
        check_out: checkOut,
      },
    });
  }

  revalidatePath(`/dashboard/bookings/${bookingId}`);
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}
