"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { initializeTransaction } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  computeAddonSubtotal,
  type PricingModel,
} from "../../../dashboard/addons/schemas";
import { roomNightlyBase } from "../roomDisplay";
import { createBookingSchema, type CreateBookingInput } from "./schemas";

export type CreateBookingResult = { ok: true } | { ok: false; error: string };

// ─── Guest account creation at checkout ──────────────────────────
// Lets an unauthenticated visitor create a guest account inline on the
// checkout page (mirrors app/signup/guest createGuestAccountAction): the
// admin client creates an auto-confirmed user, then we sign them in
// server-side so the very next createBookingAction call sees the session.
const checkoutAccountSchema = z.object({
  full_name: z.string().trim().min(2, "Tell us your name.").max(120),
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters."),
});
export type CheckoutAccountInput = z.infer<typeof checkoutAccountSchema>;

export async function createCheckoutGuestAccountAction(
  input: CheckoutAccountInput,
): Promise<CreateBookingResult> {
  const parsed = checkoutAccountSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }
  const { full_name, email, password } = parsed.data;

  // If they're already signed in, nothing to do.
  const existing = createServerClient();
  const {
    data: { user: already },
  } = await existing.auth.getUser();
  if (already) return { ok: true };

  const admin = createAdminClient();
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (createErr) {
    const msg = createErr.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      return {
        ok: false,
        error:
          "An account with this email already exists — sign in to finish booking.",
      };
    }
    return { ok: false, error: "Could not create your account. Try again." };
  }

  const supabase = createServerClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) {
    return {
      ok: false,
      error: "Account created, but sign-in failed. Try signing in manually.",
    };
  }

  // Seed the name + guest role onto the (trigger-created) profile row.
  const {
    data: { user: newUser },
  } = await supabase.auth.getUser();
  if (newUser) {
    await supabase
      .from("user_profiles")
      .update({ full_name, role: "guest" })
      .eq("id", newUser.id);
  }

  return { ok: true };
}

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
      "id, host_id, name, base_price, cleaning_fee, currency, max_guests, min_nights, is_published, booking_mode, listing_type, max_participants, min_participants, private_group_price",
    )
    .eq("id", d.listing_id)
    .maybeSingle();

  if (!listing || !listing.is_published) {
    return { ok: false, error: "This listing isn't available." };
  }

  // 3. Listing-type vs scope sanity. Experience and accommodation paths share
  // the same action but diverge on validation + pricing math.
  const isExperience = listing.listing_type === "experience";
  if (isExperience && d.scope !== "experience") {
    return { ok: false, error: "This is an experience — pick a session slot." };
  }
  if (!isExperience && d.scope === "experience") {
    return {
      ok: false,
      error: "This listing isn't an experience.",
    };
  }

  // 4. Path-specific date / mode validation.
  let nights = 0;
  if (!isExperience) {
    nights = nightsBetween(d.check_in!, d.check_out!);
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

    if (d.scope === "whole_listing" && listing.booking_mode === "rooms_only") {
      return {
        ok: false,
        error: "This listing only takes per-room bookings.",
      };
    }
    // Per-room booking is allowed whenever the listing actually has rooms — even
    // for whole_listing mode (a guesthouse can be booked by room or whole). The
    // room-ownership/availability checks below guard against invalid room_ids.
  } else {
    if (!d.session_date) {
      return { ok: false, error: "Pick a session date and time." };
    }
    const sessionAt = new Date(`${d.session_date}:00`);
    if (Number.isNaN(sessionAt.getTime()) || sessionAt < new Date()) {
      return { ok: false, error: "That session is in the past." };
    }
    const min = Math.max(1, listing.min_participants ?? 1);
    const max = listing.max_participants ?? 50;
    if (d.guests < min) {
      return {
        ok: false,
        error: `This experience needs at least ${min} ${min === 1 ? "person" : "people"}.`,
      };
    }
    if (d.guests > max) {
      return {
        ok: false,
        error: `This experience tops out at ${max} ${max === 1 ? "person" : "people"}.`,
      };
    }
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

  if (d.scope === "experience") {
    if (listing.base_price == null) {
      return {
        ok: false,
        error: "This experience has no price set yet — message the host.",
      };
    }

    // Capacity check: sum participants across existing pending/confirmed
    // bookings for this listing at the same session_date, refuse if the new
    // booking would push past max_participants. When max_participants is
    // null, we treat the session as unlimited.
    if (listing.max_participants != null) {
      const sessionAtIso = `${d.session_date}:00`;
      const { data: existing } = await admin
        .from("bookings")
        .select("guests_count")
        .eq("listing_id", listing.id)
        .eq("session_date", sessionAtIso)
        .in("status", ["pending", "pending_eft", "confirmed", "checked_in"])
        .is("deleted_at", null);
      const filled = (existing ?? []).reduce(
        (acc, b) => acc + (b.guests_count ?? 0),
        0,
      );
      const remaining = listing.max_participants - filled;
      if (remaining <= 0) {
        return {
          ok: false,
          error: "This session is fully booked. Pick another date.",
        };
      }
      if (d.guests > remaining) {
        return {
          ok: false,
          error: `Only ${remaining} ${
            remaining === 1 ? "spot" : "spots"
          } left on that session.`,
        };
      }
    }

    const perPerson = Number(listing.base_price);
    const headcountTotal = perPerson * d.guests;
    const groupPrice =
      listing.private_group_price != null
        ? Number(listing.private_group_price)
        : null;
    // If the host set a private-group rate and the guest fills the session,
    // honour the lower of (per-person * cap) vs the group rate.
    const useGroupRate =
      groupPrice != null &&
      groupPrice > 0 &&
      listing.max_participants != null &&
      d.guests === listing.max_participants &&
      groupPrice < headcountTotal;
    baseAmount = useGroupRate ? groupPrice : headcountTotal;
    cleaning = 0;
    totalAmount = baseAmount;
  } else if (d.scope === "rooms") {
    const roomIds = d.room_ids ?? [];

    // 5a. Validate every room_id belongs to this listing + is bookable.
    const { data: roomRows } = await admin
      .from("listing_rooms")
      .select(
        "id, base_price, cleaning_fee, max_guests, pricing_mode, price_per_person, base_occupancy, extra_guest_price",
      )
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

    // Per-room guest counts (default 1 when a room wasn't sent one).
    const guestsByRoom = new Map<string, number>();
    for (const rg of d.room_guests ?? []) {
      guestsByRoom.set(rg.room_id, rg.guests);
    }
    const guestsForRoom = (roomId: string) =>
      Math.max(1, guestsByRoom.get(roomId) ?? 1);

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

    // 5c. Per-room capacity check (capacity is bed-derived) + combined cap.
    for (const r of roomRows) {
      if (guestsForRoom(r.id) > r.max_guests) {
        return {
          ok: false,
          error: `One room only sleeps ${r.max_guests} — reduce its guests.`,
        };
      }
    }
    const totalCap = roomRows.reduce((acc, r) => acc + r.max_guests, 0);
    if (d.guests > totalCap) {
      return {
        ok: false,
        error: `These rooms sleep up to ${totalCap} guests combined.`,
      };
    }

    // 5d. Server-recalc price per room by its pricing mode (source of truth).
    baseAmount = 0;
    cleaning = 0;
    roomRowsForBooking = roomRows.map((r) => {
      const rBase =
        roomNightlyBase(
          {
            pricing_mode: (r.pricing_mode ?? "per_room") as
              | "per_room"
              | "per_person"
              | "per_room_plus_extra",
            base_price: Number(r.base_price),
            price_per_person:
              r.price_per_person == null ? null : Number(r.price_per_person),
            base_occupancy: r.base_occupancy ?? null,
            extra_guest_price:
              r.extra_guest_price == null ? null : Number(r.extra_guest_price),
          },
          guestsForRoom(r.id),
        ) * nights;
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
  // Experience bookings skip the addon catalog for MVP — addon pricing models
  // (per_night, per_guest_per_night) assume an accommodation stay.
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

  if (d.scope !== "experience") {
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

    const leadDays = daysUntil(d.check_in!);
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
  }

  // 6. Insert booking. Experience bookings use session_date and leave
  // check_in/check_out NULL; the `nights` column on bookings is GENERATED and
  // resolves to NULL when both dates are absent.
  // Manual EFT lands the booking in pending_eft (host verifies the transfer);
  // card payments stay "pending" until Paystack confirms via webhook.
  const isEft = d.payment_method === "eft";
  // Optional party manifest — keep only named rows, cap to the guest count,
  // and drop blank contact fields.
  const additionalGuests = (d.additional_guests ?? [])
    .map((g) => ({
      name: g.name.trim(),
      email: (g.email ?? "").trim(),
      phone: (g.phone ?? "").trim(),
    }))
    .filter((g) => g.name.length > 0)
    .slice(0, Math.max(0, d.guests))
    .map((g) => ({
      name: g.name,
      ...(g.email ? { email: g.email } : {}),
      ...(g.phone ? { phone: g.phone } : {}),
    }));

  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .insert({
      listing_id: listing.id,
      host_id: listing.host_id,
      guest_id: user.id,
      check_in: isExperience ? null : d.check_in,
      check_out: isExperience ? null : d.check_out,
      session_date: isExperience ? `${d.session_date}:00` : null,
      guests_count: d.guests,
      base_amount: baseAmount,
      cleaning_fee: cleaning,
      total_amount: totalAmount,
      currency: listing.currency,
      payment_method: d.payment_method,
      status: isEft ? "pending_eft" : "pending",
      payment_status: "pending",
      scope: d.scope,
      // Contact snapshot so the host's booking card is fully populated even for
      // a freshly-created guest account.
      guest_name: d.guest_name ?? null,
      guest_email: d.guest_email ?? user.email,
      guest_phone: d.guest_phone ?? null,
      special_requests: d.special_requests ?? null,
      additional_guests: additionalGuests,
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

  // 6c. Freeze the listing's assigned policies onto the booking so later edits
  // never change the guest's agreed terms. calculate_policy_refund_amount reads
  // these snapshots. Best-effort — a missing snapshot shouldn't block payment.
  await admin.rpc("snapshot_booking_policies", {
    p_booking_id: booking.id,
    p_listing_id: listing.id,
  });

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

  // 7b. Manual EFT — no payment provider. The booking sits in pending_eft; the
  // guest gets the host's banking details + reference on their trip page and
  // uploads proof there. Skip the Paystack hop entirely.
  if (isEft) {
    redirect(`/my-trips/${booking.id}`);
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
