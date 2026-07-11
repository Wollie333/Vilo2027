"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  computeAddonSubtotal,
  defaultAddonQuantity,
  type PricingModel,
} from "@/app/[locale]/dashboard/addons/schemas";
import {
  persistBookingAndPay,
  type BookingAddonRow,
} from "@/lib/bookings/persist";
import { getLegalDocuments } from "@/lib/legal";
import { nightsBetween, type PricingUnit, type StayAddon } from "@/lib/pricing";
import { priceSpecialStay } from "@/lib/specials/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  createSpecialBookingSchema,
  type CreateSpecialBookingInput,
} from "./schemas";

export type CreateSpecialBookingResult =
  | { ok: true }
  | { ok: false; error: string };

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function createSpecialBookingAction(
  input: CreateSpecialBookingInput,
): Promise<CreateSpecialBookingResult> {
  const parsed = createSpecialBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }
  const d = parsed.data;

  // 1. Auth — the form creates a guest account inline before submitting.
  const userClient = createServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user || !user.email) {
    return { ok: false, error: "Sign in to complete your booking." };
  }

  const admin = createAdminClient();

  // 2. Load the special (admin read — bypasses RLS, so guard explicitly).
  const { data: special } = await admin
    .from("specials")
    .select(
      "id, host_id, property_id, room_id, currency, status, deleted_at, date_mode, fixed_check_in, fixed_check_out, window_start, window_end, min_nights, max_nights, price_mode, flat_total, per_night_price, max_guests, quantity, redemptions_used, go_live_at, book_by, cancellation_policy_id",
    )
    .eq("id", d.special_id)
    .maybeSingle();

  if (!special || special.deleted_at || special.status !== "active") {
    return { ok: false, error: "This special isn’t available." };
  }
  // Runtime date guards (never depend solely on the expiry cron).
  const now = today();
  if (special.go_live_at && special.go_live_at > now) {
    return { ok: false, error: "This special isn’t available yet." };
  }
  if (special.book_by && special.book_by < now) {
    return { ok: false, error: "Bookings for this special have closed." };
  }
  if (special.redemptions_used >= special.quantity) {
    return { ok: false, error: "Sorry — this special is sold out." };
  }

  // 3. Load the property (+ room) the deal sells.
  const { data: property } = await admin
    .from("properties")
    .select(
      "id, host_id, name, currency, base_price, weekend_price, cleaning_fee, max_guests",
    )
    .eq("id", special.property_id)
    .maybeSingle();
  if (!property) {
    return { ok: false, error: "This special isn’t available." };
  }

  type RoomRow = {
    base_price: number | null;
    weekend_price: number | null;
    cleaning_fee: number | null;
    max_guests: number;
    pricing_mode: string | null;
    price_per_person: number | null;
    base_occupancy: number | null;
    extra_guest_price: number | null;
  };
  let room: RoomRow | null = null;
  if (special.room_id) {
    const { data } = await admin
      .from("property_rooms")
      .select(
        "base_price, weekend_price, cleaning_fee, max_guests, pricing_mode, price_per_person, base_occupancy, extra_guest_price",
      )
      .eq("id", special.room_id)
      .maybeSingle();
    if (!data) {
      return { ok: false, error: "This special isn’t available." };
    }
    room = data;
  }

  // 4. Resolve dates: fixed → forced; flexible → validate the guest's pick.
  let checkIn: string;
  let checkOut: string;
  if (special.date_mode === "fixed") {
    if (!special.fixed_check_in || !special.fixed_check_out) {
      return { ok: false, error: "This special isn’t available." };
    }
    checkIn = special.fixed_check_in;
    checkOut = special.fixed_check_out;
  } else {
    if (!d.check_in || !d.check_out) {
      return { ok: false, error: "Pick your check-in and check-out dates." };
    }
    checkIn = d.check_in;
    checkOut = d.check_out;
    if (
      !special.window_start ||
      !special.window_end ||
      checkIn < special.window_start ||
      checkOut > special.window_end
    ) {
      return { ok: false, error: "Choose dates inside the offer window." };
    }
  }
  const nights = nightsBetween(checkIn, checkOut);
  if (nights <= 0) {
    return { ok: false, error: "Check-out must be after check-in." };
  }
  if (special.date_mode === "flexible") {
    if (special.min_nights && nights < special.min_nights) {
      return {
        ok: false,
        error: `This deal needs at least ${special.min_nights} ${
          special.min_nights === 1 ? "night" : "nights"
        }.`,
      };
    }
    if (special.max_nights && nights > special.max_nights) {
      return {
        ok: false,
        error: `This deal is for at most ${special.max_nights} nights.`,
      };
    }
  }

  // 5. Guest cap — special override, else room/property max.
  const maxGuests =
    special.max_guests ?? room?.max_guests ?? property.max_guests ?? 50;
  if (d.guests > maxGuests) {
    return {
      ok: false,
      error: `This deal sleeps up to ${maxGuests} ${
        maxGuests === 1 ? "guest" : "guests"
      }.`,
    };
  }

  // 6. Availability — the authoritative gate (same RPCs as a normal booking).
  // Availability check that EXCLUDES this special's own calendar hold. An active
  // fixed-date special blocks its dates (blocked_dates.source='special',
  // special_id=<this special>) to reserve them — so the generic availability
  // RPCs (which count every block) would wrongly report the special's own dates
  // as unavailable and make the deal unbookable. We query blocked_dates directly
  // and ignore rows belonging to THIS special; every other block (real bookings,
  // manual holds, iCal, other specials) still counts.
  {
    let q = admin
      .from("blocked_dates")
      .select("id", { count: "exact", head: true })
      .eq("property_id", property.id)
      .gte("date", checkIn)
      .lt("date", checkOut)
      // keep this special's own hold out of the conflict check
      .or(`special_id.is.null,special_id.neq.${special.id}`);
    // whole-property special: any room-scoped or whole-listing block conflicts.
    // room-scoped special: only that room's block or a whole-listing block.
    if (special.room_id) {
      q = q.or(`room_id.is.null,room_id.eq.${special.room_id}`);
    }
    const { count, error: availErr } = await q;
    if (availErr || (count ?? 0) > 0) {
      return {
        ok: false,
        error: "These dates aren’t available. Try different dates.",
      };
    }
  }

  // 7. The priceable unit (room or whole-property) at the deal's guest count.
  const unit: PricingUnit = special.room_id
    ? {
        roomId: special.room_id,
        pricing_mode: (room?.pricing_mode ??
          "per_room") as PricingUnit["pricing_mode"],
        base_price: num(room?.base_price),
        price_per_person: numOrNull(room?.price_per_person),
        base_occupancy: room?.base_occupancy ?? null,
        extra_guest_price: numOrNull(room?.extra_guest_price),
        weekend_price: numOrNull(room?.weekend_price),
        cleaning_fee: num(room?.cleaning_fee),
        guests: d.guests,
      }
    : {
        roomId: null,
        pricing_mode: "per_room",
        base_price: num(property.base_price),
        price_per_person: null,
        base_occupancy: null,
        extra_guest_price: null,
        weekend_price: numOrNull(property.weekend_price),
        cleaning_fee: num(property.cleaning_fee),
        guests: d.guests,
      };

  // 8. Bundle add-ons: every compulsory add-on + any guest-selected optional one.
  // Re-priced server-side off the catalog (+ the special's per-deal override),
  // never trusting client amounts.
  const { data: specialAddonRows } = await admin
    .from("special_addons")
    .select(
      "addon_id, is_required, unit_price_override, sort_order, addons!inner ( id, name, pricing_model, unit_price, currency, min_quantity, stock_quantity, is_active )",
    )
    .eq("special_id", special.id)
    .order("sort_order", { ascending: true });

  type AddonJoin = {
    addon_id: string;
    is_required: boolean;
    unit_price_override: number | null;
    sort_order: number;
    addons: {
      id: string;
      name: string;
      pricing_model: PricingModel;
      unit_price: number;
      currency: string;
      min_quantity: number;
      stock_quantity: number | null;
      is_active: boolean;
    };
  };

  const selectedOptional = new Set(d.selected_addons);
  const stayAddons: StayAddon[] = [];
  const bookingAddons: BookingAddonRow[] = [];
  let sortOrder = 0;
  for (const raw of (specialAddonRows ?? []) as unknown as AddonJoin[]) {
    const a = Array.isArray(raw.addons) ? raw.addons[0] : raw.addons;
    if (!a || !a.is_active) continue;
    // Compulsory add-ons are always bundled; optional ones only when chosen.
    if (!raw.is_required && !selectedOptional.has(raw.addon_id)) continue;

    const model = a.pricing_model;
    const unitPrice =
      raw.unit_price_override == null
        ? num(a.unit_price)
        : num(raw.unit_price_override);
    const quantity = defaultAddonQuantity(model, a.min_quantity ?? 1, nights);
    if (quantity <= 0) continue;
    const subtotal = computeAddonSubtotal(model, unitPrice, quantity, d.guests);

    stayAddons.push({
      label: a.name,
      pricingModel: model,
      unitPrice,
      quantity,
      addonId: a.id,
    });
    bookingAddons.push({
      addon_id: a.id,
      label: a.name,
      quantity,
      unit_price: unitPrice,
      pricing_model: model,
      currency: a.currency,
      is_required: raw.is_required,
      subtotal,
      sort_order: sortOrder++,
      reserve: true,
    });
  }

  // 9. Price the stay — the authoritative total (flat package or per-night
  // synthetic-rule override; seasonal never applies). Client estimate is advisory.
  const breakdown = priceSpecialStay({
    priceMode: special.price_mode as "flat" | "per_night",
    flatTotal: numOrNull(special.flat_total),
    perNightPrice: numOrNull(special.per_night_price),
    currency: special.currency,
    checkIn,
    checkOut,
    unit,
    totalGuests: d.guests,
    addons: stayAddons,
  });

  // 10. Persist + pay through the shared tail.
  const scope = special.room_id ? "rooms" : "whole_listing";
  const isEft = d.payment_method === "eft";
  const legal = await getLegalDocuments();

  const result = await persistBookingAndPay({
    admin,
    bookingInsert: {
      property_id: property.id,
      host_id: property.host_id,
      guest_id: user.id,
      special_id: special.id,
      booked_via: d.booked_via,
      origin: "special_booked",
      check_in: checkIn,
      check_out: checkOut,
      session_date: null,
      guests_count: d.guests,
      guests_breakdown: {
        adults: d.guests,
        children: 0,
        infants: 0,
        pets: 0,
      },
      base_amount: breakdown.baseSubtotal,
      cleaning_fee: breakdown.cleaningTotal,
      discount_amount: breakdown.discount.discountTotal,
      total_amount: breakdown.total,
      price_breakdown: breakdown,
      currency: special.currency,
      payment_method: d.payment_method,
      status: isEft ? "pending_eft" : "pending",
      payment_status: "pending",
      scope,
      guest_name: d.guest_name ?? null,
      guest_email: d.guest_email ?? user.email,
      guest_phone: d.guest_phone ?? null,
      special_requests: d.special_requests ?? null,
      additional_guests: [],
      policy_acknowledged: true,
      policy_acknowledged_at: new Date().toISOString(),
      accepted_terms_version: legal.booking_terms.version,
      accepted_privacy_version: legal.privacy.version,
    },
    // Atomic quantity-cap claim; released on the rollback ladder (a bare DELETE
    // does not fire on_booking_cancelled).
    redeem: {
      claim: async () => {
        const { data: ok, error } = await admin.rpc("redeem_special", {
          p_special_id: special.id,
        });
        if (error || ok !== true) {
          return { ok: false, error: "Sorry — this special just sold out." };
        }
        return { ok: true };
      },
      rollback: async () => {
        await admin.rpc("release_special", { p_special_id: special.id });
      },
    },
    bookingRooms: special.room_id
      ? [
          {
            room_id: special.room_id,
            base_amount: breakdown.units[0]?.baseSubtotal ?? 0,
            cleaning_fee: breakdown.units[0]?.cleaningFee ?? 0,
          },
        ]
      : [],
    addons: bookingAddons,
    policy: {
      listingId: property.id,
      specialCancellationPolicyId: special.cancellation_policy_id,
    },
    payable: {
      scope,
      status: isEft ? "pending_eft" : "pending",
      payment_status: "pending",
      total_amount: breakdown.total,
      deposit_amount: null,
      currency: special.currency,
      guest_id: user.id,
      property_id: property.id,
      listing_name: property.name,
      host_id: property.host_id,
    },
    payment: {
      method: d.payment_method,
      amount: "full",
      email: user.email,
      origin: headers().get("origin") ?? "",
      returnTo: (bookingId) => `/booking/${bookingId}/success`,
    },
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  redirect(result.redirectTo);
}
