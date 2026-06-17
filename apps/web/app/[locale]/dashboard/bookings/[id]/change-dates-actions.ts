"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireHost } from "@/lib/host/current";
import { recomputeBookingPaymentState } from "@/lib/payments/ledger";
import { nightsBetween } from "@/lib/pricing";
import { computeStayPricing } from "@/lib/pricing/quote";
import { createAdminClient } from "@/lib/supabase/admin";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

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
};

async function loadBooking(
  admin: ReturnType<typeof createAdminClient>,
  bookingId: string,
  hostId: string,
): Promise<BookingForEdit | { error: string }> {
  const { data: b } = await admin
    .from("bookings")
    .select(
      "id, host_id, property_id, status, scope, guests_count, currency, cleaning_fee, vat_rate, booking_rooms ( room_id ), booking_addons ( subtotal )",
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
  };
}

// Is the new range free for this booking's listing/rooms, IGNORING this booking's
// own blocks (so moving a booking never conflicts with itself)? Manual blocks,
// quote holds and OTHER bookings still count.
async function hasConflict(
  admin: ReturnType<typeof createAdminClient>,
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

// Accommodation total (ex-VAT) for the new dates via the canonical pricer, plus
// the booking's existing add-ons, grossed up by VAT — the SUGGESTED total. The
// host can override it before applying.
async function suggestTotal(
  admin: ReturnType<typeof createAdminClient>,
  b: BookingForEdit,
  checkIn: string,
  checkOut: string,
): Promise<number | null> {
  const roomIds = b.rooms.map((r) => r.room_id);
  const perRoomGuests = Math.max(
    1,
    Math.round(b.guests_count / Math.max(1, roomIds.length)),
  );
  const priced = await computeStayPricing(
    admin,
    {
      property_id: b.property_id,
      check_in: checkIn,
      check_out: checkOut,
      scope: b.scope === "rooms" ? "rooms" : "whole_listing",
      guests: b.guests_count,
      rooms: roomIds.map((room_id) => ({ room_id, guests: perRoomGuests })),
    },
    b.host_id,
  );
  if (!priced.ok) return null;
  const exVat = priced.data.total + b.addonsTotal;
  const rate = b.vat_rate ?? 0;
  return rate > 0 ? Math.round(exVat * (1 + rate / 100) * 100) / 100 : exVat;
}

const previewSchema = z.object({
  bookingId: z.string().uuid(),
  checkIn: z.string().regex(ISO),
  checkOut: z.string().regex(ISO),
});

export type ChangeDatesPreview =
  | {
      ok: true;
      available: boolean;
      nights: number;
      suggestedTotal: number | null;
      currency: string;
    }
  | { ok: false; error: string };

export async function previewChangeDatesAction(input: {
  bookingId: string;
  checkIn: string;
  checkOut: string;
}): Promise<ChangeDatesPreview> {
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bad request." };
  const { bookingId, checkIn, checkOut } = parsed.data;
  if (nightsBetween(checkIn, checkOut) <= 0)
    return { ok: false, error: "Check-out must be after check-in." };

  const host = await requireHost();
  if (!host.ok) return { ok: false, error: host.error };

  const admin = createAdminClient();
  const b = await loadBooking(admin, bookingId, host.hostId);
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

const applySchema = z.object({
  bookingId: z.string().uuid(),
  checkIn: z.string().regex(ISO),
  checkOut: z.string().regex(ISO),
  total: z.number().min(0).max(100_000_000),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function changeBookingDatesAction(input: {
  bookingId: string;
  checkIn: string;
  checkOut: string;
  total: number;
}): Promise<ActionResult> {
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bad request." };
  const { bookingId, checkIn, checkOut, total } = parsed.data;
  if (nightsBetween(checkIn, checkOut) <= 0)
    return { ok: false, error: "Check-out must be after check-in." };

  const host = await requireHost();
  if (!host.ok) return { ok: false, error: host.error };

  const admin = createAdminClient();
  const b = await loadBooking(admin, bookingId, host.hostId);
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

  const { error: upErr } = await admin
    .from("bookings")
    .update({
      check_in: checkIn,
      check_out: checkOut,
      base_amount: baseAmount,
      total_amount: total,
      vat_amount: vatAmount,
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

  // Keep an existing invoice's figures in step with the new total.
  const { data: invoice } = await admin
    .from("invoices")
    .select("id")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (invoice) {
    await admin
      .from("invoices")
      .update({
        subtotal: Math.round((total - vatAmount) * 100) / 100,
        vat_amount: vatAmount,
        total_amount: total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);
  }

  revalidatePath(`/dashboard/bookings/${bookingId}`);
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}
