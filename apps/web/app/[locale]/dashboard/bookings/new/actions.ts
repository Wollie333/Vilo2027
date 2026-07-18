"use server";

import { revalidatePath } from "next/cache";

import { assertFullHost } from "@/lib/host/current";
import { isSelfRecipient, SELF_RECIPIENT_ERROR } from "@/lib/host/self";
import { recordBookingPayment } from "@/lib/payments/ledger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { computeAddonSubtotal, type PricingModel } from "../../addons/schemas";
import {
  manualBookingSchema,
  type ManualBookingInput,
} from "../../quotes/schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// Inclusive list of nights in [check_in, check_out). One date string per night
// the booking occupies — these are the cells we block on the calendar.
function nightsBetween(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  while (cursor < end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

const PRICING_MODELS: ReadonlySet<string> = new Set([
  "per_stay",
  "per_night",
  "per_guest",
  "per_guest_per_night",
  "per_couple",
]);

export async function createManualBookingAction(
  input: ManualBookingInput,
): Promise<ActionResult<{ bookingId: string }>> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const parsed = manualBookingSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }
  const data = parsed.data;

  // Full-host-only: a quotes-only / platform-blocked account is rejected
  // server-side (manual bookings aren't part of the quotes-only shell).
  const h = await assertFullHost();
  if (!h.ok) return { ok: false, error: h.error };
  const host = { id: h.hostId };

  // A host can't book themselves — the guest is someone else.
  if (
    await isSelfRecipient({
      userId: user.id,
      selfEmail: user.email ?? null,
      recipientEmail: data.guest_email,
    })
  ) {
    return { ok: false, error: SELF_RECIPIENT_ERROR };
  }

  const { data: listing } = await supabase
    .from("properties")
    .select("id, host_id, currency")
    .eq("id", data.property_id)
    .maybeSingle();
  if (!listing || listing.host_id !== host.id) {
    return { ok: false, error: "Listing not found." };
  }

  // Currency of record = the listing's settlement currency (Model 2). NEVER the
  // client-supplied value — the server owns money/currency (security-first).
  const currency = listing.currency || "ZAR";
  const nights = nightsBetween(data.check_in, data.check_out);
  if (nights.length === 0) {
    return { ok: false, error: "Check-out must be after check-in." };
  }

  // payment_state controls how the booking lands:
  //  - paid:                status=confirmed,  payment_status=completed
  //  - unpaid:              status=confirmed,  payment_status=pending
  //  - send_paystack_link:  status=pending,    payment_status=pending
  const paymentStatus = data.payment_state === "paid" ? "completed" : "pending";
  const bookingStatus =
    data.payment_state === "send_paystack_link" ? "pending" : "confirmed";

  // Availability guard — only enforced when the booking lands confirmed (a
  // pending payment-link booking doesn't block the calendar yet). The
  // confirmed-booking DB trigger fires on status UPDATE, not on a direct
  // INSERT, so this action both checks availability AND writes the blocks
  // itself below.
  if (bookingStatus === "confirmed") {
    if (data.scope === "rooms" && data.rooms.length > 0) {
      for (const r of data.rooms) {
        const { data: free } = await supabase.rpc("room_is_available", {
          p_listing_id: data.property_id,
          p_room_id: r.room_id,
          p_check_in: data.check_in,
          p_check_out: data.check_out,
        });
        if (free === false) {
          return {
            ok: false,
            error: "One of the selected rooms isn't free for those dates.",
          };
        }
      }
    } else {
      const { data: free } = await supabase.rpc("listing_is_available_whole", {
        p_listing_id: data.property_id,
        p_check_in: data.check_in,
        p_check_out: data.check_out,
      });
      if (free === false) {
        return {
          ok: false,
          error: "Those dates are already blocked or booked.",
        };
      }
    }
  }

  // Re-price configured add-ons server-side from the catalog — never trust the
  // unit_price the client sent. Custom fee lines (addon_id null) keep their
  // host-entered price since the host owns the listing.
  const configuredIds = data.addons
    .map((a) => a.addon_id)
    .filter((id): id is string => Boolean(id));
  const catalog = new Map<
    string,
    { name: string; unit_price: number; pricing_model: string }
  >();
  if (configuredIds.length > 0) {
    const { data: rows } = await supabase
      .from("property_addons")
      .select(
        "addon_id, unit_price_override, addons!inner ( name, unit_price, pricing_model )",
      )
      .eq("property_id", data.property_id)
      .in("addon_id", configuredIds);
    for (const row of rows ?? []) {
      const a = row.addons as unknown as {
        name: string;
        unit_price: number;
        pricing_model: string;
      };
      catalog.set(row.addon_id, {
        name: a.name,
        unit_price: row.unit_price_override ?? a.unit_price,
        pricing_model: a.pricing_model,
      });
    }
  }

  const addonRows = data.addons.map((a, i) => {
    const fromCatalog = a.addon_id ? catalog.get(a.addon_id) : undefined;
    const model: PricingModel = PRICING_MODELS.has(
      fromCatalog?.pricing_model ?? a.pricing_model ?? "",
    )
      ? ((fromCatalog?.pricing_model ?? a.pricing_model) as PricingModel)
      : "per_stay";
    const unitPrice = fromCatalog ? fromCatalog.unit_price : a.unit_price;
    const label = fromCatalog ? fromCatalog.name : a.label;
    // Quantity now carries the night count for per-night add-ons (the host
    // enters how many nights), so there's no separate nights multiplier.
    const subtotal = computeAddonSubtotal(
      model,
      unitPrice,
      a.quantity,
      data.headcount,
    );
    return {
      addon_id: a.addon_id ?? null,
      label,
      quantity: a.quantity,
      unit_price: unitPrice,
      pricing_model: model,
      subtotal,
      currency,
      sort_order: i,
    };
  });

  const addonsTotal = addonRows.reduce((s, a) => s + a.subtotal, 0);
  const total = data.base_amount + data.cleaning_fee + addonsTotal;

  const { data: booking, error: bookErr } = await supabase
    .from("bookings")
    .insert({
      host_id: host.id,
      property_id: data.property_id,
      guest_id: null,
      guest_name: data.guest_name,
      guest_email: data.guest_email,
      guest_phone: data.guest_phone || null,
      origin: "host_manual",
      scope: data.scope,
      check_in: data.check_in,
      check_out: data.check_out,
      guests_count: data.headcount,
      base_amount: data.base_amount,
      cleaning_fee: data.cleaning_fee,
      total_amount: total,
      currency,
      payment_status: paymentStatus,
      // Owed from the start: a paid booking owes nothing; unpaid/pay-link owe
      // the full total until a payment lands. Keeps balance_due correct on
      // creation (the recompute SSOT only runs once a payment is recorded).
      balance_due: paymentStatus === "completed" ? 0 : total,
      host_payment_note:
        data.payment_state === "paid" ? data.payment_note || null : null,
      special_requests: data.notes || null,
      status: bookingStatus,
      confirmed_at:
        bookingStatus === "confirmed" ? new Date().toISOString() : null,
    })
    .select("id, total_amount")
    .single();
  if (bookErr || !booking) {
    return { ok: false, error: "Could not create the booking." };
  }
  // The BEFORE INSERT VAT trigger (apply_booking_vat) grosses total_amount up on
  // a VAT-registered listing, so the pre-insert `total` is ex-VAT. Charge/record
  // against the DB (post-VAT) value so a "paid" booking settles in full.
  const dbTotal = Math.round(Number(booking.total_amount) * 100) / 100;

  if (data.scope === "rooms" && data.rooms.length > 0) {
    await supabase.from("booking_rooms").insert(
      data.rooms.map((r) => ({
        booking_id: booking.id,
        room_id: r.room_id,
        base_amount: r.base_amount,
        cleaning_fee: r.cleaning_fee,
      })),
    );
  }

  if (addonRows.length > 0) {
    await supabase.from("booking_addons").insert(
      addonRows.map((a) => ({
        booking_id: booking.id,
        addon_id: a.addon_id,
        label: a.label,
        quantity: a.quantity,
        unit_price: a.unit_price,
        pricing_model: a.pricing_model,
        subtotal: a.subtotal,
        currency: a.currency,
        sort_order: a.sort_order,
      })),
    );
  }

  // Block the calendar for confirmed bookings (the status-UPDATE trigger won't
  // fire on a direct confirmed INSERT). Room-scoped → one block per room; else
  // a whole-listing block (room_id NULL). The availability guard above already
  // proved the range is free, so a plain insert won't hit the unique-per-scope
  // index; best-effort — a created booking shouldn't fail on calendar blocking.
  if (bookingStatus === "confirmed") {
    // Single shape so the array's element type unifies cleanly — Supabase
    // .insert() can't accept a discriminated union of two row types.
    const blocks: Array<{
      property_id: string;
      room_id: string | null;
      date: string;
      reason: string;
      booking_id: string;
    }> =
      data.scope === "rooms" && data.rooms.length > 0
        ? data.rooms.flatMap((r) =>
            nights.map((date) => ({
              property_id: data.property_id,
              room_id: r.room_id as string | null,
              date,
              reason: "booking",
              booking_id: booking.id,
            })),
          )
        : nights.map((date) => ({
            property_id: data.property_id,
            room_id: null as string | null,
            date,
            reason: "booking",
            booking_id: booking.id,
          }));
    await supabase.from("blocked_dates").insert(blocks);
  }

  if (data.internal_note) {
    await supabase.from("booking_notes").insert({
      booking_id: booking.id,
      author_id: user.id,
      body: data.internal_note,
    });
  }

  // Freeze the listing's assigned policies onto the booking (best-effort) so
  // refund calculations have a snapshot to read, same as guest checkout.
  await supabase.rpc("snapshot_booking_policies", {
    p_booking_id: booking.id,
    p_listing_id: data.property_id,
  });

  // Marked fully paid → record the payment through the ledger SSOT so the
  // Finances ledger has the cash entry that offsets the (paid) invoice the
  // confirm trigger just issued. Without this the guest reads as owing the
  // full total. Best-effort: the booking already exists if this hiccups.
  if (data.payment_state === "paid" && dbTotal > 0) {
    await recordBookingPayment(createAdminClient(), {
      bookingId: booking.id,
      amount: dbTotal,
      kind: "payment",
      method: "eft",
      note: data.payment_note || null,
      recordedBy: user.id,
    });
  }

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  return { ok: true, data: { bookingId: booking.id } };
}
