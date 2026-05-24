"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { initializeTransaction } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  computeAddonSubtotal,
  type PricingModel,
} from "../../../dashboard/addons/schemas";
import { createBookingSchema, type CreateBookingInput } from "./schemas";

export type CreateBookingResult = { ok: true } | { ok: false; error: string };

function nightsBetween(checkIn: string, checkOut: string): number {
  const f = new Date(`${checkIn}T00:00:00Z`).getTime();
  const t = new Date(`${checkOut}T00:00:00Z`).getTime();
  const n = Math.round((t - f) / (1000 * 60 * 60 * 24));
  return n;
}

function daysUntil(date: string): number {
  const target = new Date(`${date}T00:00:00Z`).getTime();
  const today = new Date(
    new Date().toISOString().slice(0, 10) + "T00:00:00Z",
  ).getTime();
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

export async function createBookingAction(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }
  const d = parsed.data;

  // 1. Auth.
  const userClient = createServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user || !user.email) {
    return { ok: false, error: "Sign in to complete your booking." };
  }

  // 2. Fetch listing — public RLS read of a published listing.
  const { data: listing } = await userClient
    .from("listings")
    .select(
      "id, host_id, name, base_price, cleaning_fee, currency, max_guests, min_nights, is_published, booking_mode",
    )
    .eq("id", d.listing_id)
    .maybeSingle();

  if (!listing || !listing.is_published) {
    return { ok: false, error: "This listing isn't available." };
  }

  // 3. Server-side date check (never trust the client per AGENT_RULES §1.2).
  const nights = nightsBetween(d.check_in, d.check_out);
  if (nights <= 0) {
    return { ok: false, error: "Check-out must be after check-in." };
  }
  const minNights = listing.min_nights ?? 1;
  if (nights < minNights) {
    return {
      ok: false,
      error: `Minimum stay is ${minNights} ${minNights === 1 ? "night" : "nights"}.`,
    };
  }

  // 4. Mode compatibility.
  if (d.scope === "whole_listing" && listing.booking_mode === "rooms_only") {
    return {
      ok: false,
      error: "This listing only takes per-room bookings.",
    };
  }
  if (d.scope === "rooms" && listing.booking_mode === "whole_listing") {
    return {
      ok: false,
      error: "This listing books as a whole — no room selection.",
    };
  }

  const admin = createAdminClient();

  // 5. Branch by scope.
  let baseAmount: number;
  let cleaning: number;
  let totalAmount: number;
  let roomRowsForBooking: Array<{
    room_id: string;
    base_amount: number;
    cleaning_fee: number;
  }> = [];

  if (d.scope === "rooms") {
    const roomIds = d.room_ids ?? [];

    // 5a. Validate every room_id belongs to this listing + is bookable.
    const { data: roomRows } = await admin
      .from("listing_rooms")
      .select("id, base_price, cleaning_fee, max_guests")
      .eq("listing_id", listing.id)
      .is("deleted_at", null)
      .eq("is_active", true)
      .in("id", roomIds);

    if (!roomRows || roomRows.length !== roomIds.length) {
      return {
        ok: false,
        error: "One or more rooms aren't available. Refresh and try again.",
      };
    }

    // 5b. Check availability per room.
    for (const r of roomRows) {
      const { data: availResult, error: availErr } = await admin.rpc(
        "room_is_available",
        {
          p_listing_id: listing.id,
          p_room_id: r.id,
          p_check_in: d.check_in,
          p_check_out: d.check_out,
        },
      );
      if (availErr || availResult === false) {
        return {
          ok: false,
          error: "One of your rooms was just booked. Try different dates.",
        };
      }
    }

    // 5c. Guest cap = sum of room capacities.
    const totalCap = roomRows.reduce((acc, r) => acc + r.max_guests, 0);
    if (d.guests > totalCap) {
      return {
        ok: false,
        error: `These rooms sleep up to ${totalCap} guests combined.`,
      };
    }

    // 5d. Server-recalc price per room.
    baseAmount = 0;
    cleaning = 0;
    roomRowsForBooking = roomRows.map((r) => {
      const rBase = Number(r.base_price) * nights;
      const rClean = Number(r.cleaning_fee ?? 0);
      baseAmount += rBase;
      cleaning += rClean;
      return {
        room_id: r.id,
        base_amount: rBase,
        cleaning_fee: rClean,
      };
    });
    totalAmount = baseAmount + cleaning;
  } else {
    // Whole-listing path.
    if (listing.base_price == null) {
      return {
        ok: false,
        error: "This listing has no price set yet — message the host.",
      };
    }
    if (listing.max_guests != null && d.guests > listing.max_guests) {
      return {
        ok: false,
        error: `This listing sleeps up to ${listing.max_guests} guests.`,
      };
    }

    const { data: availResult, error: availErr } = await admin.rpc(
      "listing_is_available_whole",
      {
        p_listing_id: listing.id,
        p_check_in: d.check_in,
        p_check_out: d.check_out,
      },
    );
    if (availErr || availResult === false) {
      return {
        ok: false,
        error: "These dates aren't available. Try different ones.",
      };
    }

    baseAmount = Number(listing.base_price) * nights;
    cleaning = Number(listing.cleaning_fee ?? 0);
    totalAmount = baseAmount + cleaning;
  }

  // 5e. Re-fetch eligible addons server-side and snapshot prices.
  const roomIdScope =
    d.scope === "rooms" ? roomRowsForBooking.map((r) => r.room_id) : [];
  const { data: eligibleAddonRows } = await admin
    .from("listing_addons")
    .select(
      "addon_id, room_id, unit_price_override, addons!inner ( id, name, pricing_model, unit_price, currency, min_quantity, max_quantity, is_required, is_active, lead_time_days )",
    )
    .eq("listing_id", listing.id);

  type AddonJoinRow = {
    addon_id: string;
    room_id: string | null;
    unit_price_override: number | null;
    addons: {
      id: string;
      name: string;
      pricing_model: PricingModel;
      unit_price: number;
      currency: string;
      min_quantity: number;
      max_quantity: number | null;
      is_required: boolean;
      is_active: boolean;
      lead_time_days: number;
    };
  };

  // Dedupe by addon_id — listing-wide row wins over room-scoped; lowest
  // override price wins among room rows. Filter for: active, lead time
  // satisfied, room scope matches (NULL = listing-wide, else in selected
  // rooms).
  const leadDays = daysUntil(d.check_in);
  const eligibleMap = new Map<
    string,
    {
      addon: AddonJoinRow["addons"];
      effectiveUnitPrice: number;
    }
  >();
  for (const raw of (eligibleAddonRows ?? []) as unknown as AddonJoinRow[]) {
    const a = Array.isArray(raw.addons) ? raw.addons[0] : raw.addons;
    if (!a) continue;
    if (!a.is_active) continue;
    if (a.lead_time_days > leadDays) continue;
    if (raw.room_id !== null) {
      if (d.scope !== "rooms") continue;
      if (!roomIdScope.includes(raw.room_id)) continue;
    }
    const effective =
      raw.unit_price_override == null
        ? Number(a.unit_price)
        : Number(raw.unit_price_override);
    const existing = eligibleMap.get(a.id);
    if (!existing || effective < existing.effectiveUnitPrice) {
      eligibleMap.set(a.id, { addon: a, effectiveUnitPrice: effective });
    }
  }

  // Merge guest selection + auto-required addons.
  const selectedQty = new Map<string, number>();
  for (const sel of d.selected_addons ?? []) {
    if (eligibleMap.has(sel.addon_id) && sel.quantity > 0) {
      selectedQty.set(sel.addon_id, sel.quantity);
    }
  }
  for (const [addonId, entry] of eligibleMap.entries()) {
    if (entry.addon.is_required && !selectedQty.has(addonId)) {
      selectedQty.set(addonId, Math.max(entry.addon.min_quantity, 1));
    }
  }

  // Clamp quantities to min/max and compute snapshots.
  const addonInserts: Array<{
    label: string;
    quantity: number;
    unit_price: number;
    pricing_model: PricingModel;
    currency: string;
    is_required: boolean;
    subtotal: number;
    addon_id: string;
    sort_order: number;
  }> = [];
  let addonsTotal = 0;
  let sortOrder = 0;
  for (const [addonId, qty] of selectedQty.entries()) {
    const entry = eligibleMap.get(addonId);
    if (!entry) continue;
    const a = entry.addon;
    let clamped = qty;
    if (clamped < a.min_quantity) clamped = a.min_quantity;
    if (a.max_quantity != null && clamped > a.max_quantity) {
      clamped = a.max_quantity;
    }
    if (clamped <= 0) continue;
    const subtotal = computeAddonSubtotal(
      a.pricing_model,
      entry.effectiveUnitPrice,
      clamped,
      nights,
      d.guests,
    );
    addonsTotal += subtotal;
    addonInserts.push({
      addon_id: a.id,
      label: a.name,
      quantity: clamped,
      unit_price: entry.effectiveUnitPrice,
      pricing_model: a.pricing_model,
      currency: a.currency,
      is_required: a.is_required,
      subtotal,
      sort_order: sortOrder++,
    });
  }
  totalAmount = baseAmount + cleaning + addonsTotal;

  // 6. Insert booking.
  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .insert({
      listing_id: listing.id,
      host_id: listing.host_id,
      guest_id: user.id,
      check_in: d.check_in,
      check_out: d.check_out,
      guests_count: d.guests,
      base_amount: baseAmount,
      cleaning_fee: cleaning,
      total_amount: totalAmount,
      currency: listing.currency,
      payment_method: d.payment_method,
      status: "pending",
      payment_status: "pending",
      scope: d.scope,
    })
    .select("id, reference")
    .single();
  if (bookingErr || !booking) {
    return { ok: false, error: "Could not start your booking. Try again." };
  }

  // 6a. Insert booking_rooms join rows when scope=rooms.
  if (d.scope === "rooms" && roomRowsForBooking.length > 0) {
    const { error: brErr } = await admin.from("booking_rooms").insert(
      roomRowsForBooking.map((r) => ({
        booking_id: booking.id,
        room_id: r.room_id,
        base_amount: r.base_amount,
        cleaning_fee: r.cleaning_fee,
      })),
    );
    if (brErr) {
      await admin.from("bookings").delete().eq("id", booking.id);
      return { ok: false, error: "Could not save room selection. Try again." };
    }
  }

  // 6b. Insert booking_addons rows (catalog-linked + auto-required).
  if (addonInserts.length > 0) {
    const { error: addonErr } = await admin.from("booking_addons").insert(
      addonInserts.map((a) => ({
        booking_id: booking.id,
        addon_id: a.addon_id,
        label: a.label,
        quantity: a.quantity,
        unit_price: a.unit_price,
        pricing_model: a.pricing_model,
        currency: a.currency,
        is_required: a.is_required,
        subtotal: a.subtotal,
        sort_order: a.sort_order,
      })),
    );
    if (addonErr) {
      await admin.from("booking_rooms").delete().eq("booking_id", booking.id);
      await admin.from("bookings").delete().eq("id", booking.id);
      return { ok: false, error: "Could not save add-ons. Try again." };
    }
  }

  // 7. Pending payment row. provider_reference filled after init.
  const { data: payment, error: paymentErr } = await admin
    .from("payments")
    .insert({
      booking_id: booking.id,
      amount: totalAmount,
      currency: listing.currency,
      method: d.payment_method,
      status: "pending",
    })
    .select("id")
    .single();
  if (paymentErr || !payment) {
    await admin.from("booking_rooms").delete().eq("booking_id", booking.id);
    await admin.from("bookings").delete().eq("id", booking.id);
    return { ok: false, error: "Could not prepare payment. Try again." };
  }

  // 8. Initialize Paystack transaction.
  const origin = headers().get("origin") ?? "";
  let initResult;
  try {
    initResult = await initializeTransaction({
      amount: totalAmount,
      currency: listing.currency,
      email: user.email,
      callbackUrl: `${origin}/booking/${booking.id}/success`,
      metadata: {
        booking_id: booking.id,
        payment_id: payment.id,
        listing_id: listing.id,
        listing_name: listing.name,
        guest_id: user.id,
        reference: booking.reference,
        scope: d.scope,
      },
    });
  } catch {
    await admin.from("payments").delete().eq("id", payment.id);
    await admin.from("booking_addons").delete().eq("booking_id", booking.id);
    await admin.from("booking_rooms").delete().eq("booking_id", booking.id);
    await admin.from("bookings").delete().eq("id", booking.id);
    return {
      ok: false,
      error: "Couldn't reach Paystack. Try again in a moment.",
    };
  }

  await admin
    .from("payments")
    .update({ provider_reference: initResult.reference })
    .eq("id", payment.id);

  redirect(initResult.authorization_url);
}
