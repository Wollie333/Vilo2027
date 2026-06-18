"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  persistBookingAndPay,
  type BookingAddonRow,
  type RedeemStep,
} from "@/lib/bookings/persist";
import { getLegalDocuments } from "@/lib/legal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  clampAddonQuantity,
  computeAddonSubtotal,
  defaultAddonQuantity,
  type PricingModel,
} from "../../../dashboard/addons/schemas";
import { resolveCoupon } from "@/lib/coupons";
import {
  computeAgeExtras,
  nightsBetween,
  priceStay,
  type AgeExtraLine,
  type PriceBreakdown,
  type PricingUnit,
  type ResolvedCoupon,
  type SeasonalRule,
} from "@/lib/pricing";

import { createBookingSchema, type CreateBookingInput } from "./schemas";

export type CreateBookingResult = { ok: true } | { ok: false; error: string };

// ─── Live availability for the in-flow room picker (step 1) ───────
// Calls the SAME RPCs the booking action enforces with, via the admin client
// so anonymous visitors can check before creating an account. Read-only and
// non-sensitive (just which rooms are free for these dates).
const availabilitySchema = z.object({
  property_id: z.string().uuid(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  room_ids: z.array(z.string().uuid()).max(50).default([]),
});
export type CheckAvailabilityInput = z.infer<typeof availabilitySchema>;
export type CheckAvailabilityResult =
  | { ok: true; whole: boolean; rooms: Record<string, boolean> }
  | { ok: false; error: string };

export async function checkAvailabilityAction(
  input: CheckAvailabilityInput,
): Promise<CheckAvailabilityResult> {
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid dates." };
  const { property_id, check_in, check_out, room_ids } = parsed.data;
  if (check_out <= check_in) return { ok: false, error: "Invalid dates." };

  const admin = createAdminClient();
  try {
    const [{ data: wholeData }, roomResults] = await Promise.all([
      admin.rpc("listing_is_available_whole", {
        p_listing_id: property_id,
        p_check_in: check_in,
        p_check_out: check_out,
      }),
      Promise.all(
        room_ids.map(async (rid) => {
          const { data } = await admin.rpc("room_is_available", {
            p_listing_id: property_id,
            p_room_id: rid,
            p_check_in: check_in,
            p_check_out: check_out,
          });
          return [rid, data !== false] as const;
        }),
      ),
    ]);
    return {
      ok: true,
      whole: wholeData !== false,
      rooms: Object.fromEntries(roomResults),
    };
  } catch {
    // On any error, don't block the guest — the booking action re-checks and is
    // the authoritative gate.
    return { ok: true, whole: true, rooms: {} };
  }
}

// PostgREST returns numeric columns as strings — coerce to number | null.
function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

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

// ─── Guest coupon preview ─────────────────────────────────────────
// Validates a code against the current stay so the checkout can show the
// discount before submitting. The booking action re-validates + re-prices
// authoritatively, so this is advisory only (never the source of the charge).
const validateCouponSchema = z.object({
  code: z.string().trim().min(1, "Enter a code.").max(40),
  property_id: z.string().uuid(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  room_ids: z.array(z.string().uuid()).optional().default([]),
  addon_ids: z.array(z.string().uuid()).optional().default([]),
  accommodation_amount: z.number().min(0),
  addons_amount: z.number().min(0),
});
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;

export type ValidateCouponResult =
  | { ok: true; coupon: ResolvedCoupon; label: string }
  | { ok: false; error: string };

export async function validateCouponAction(
  input: ValidateCouponInput,
): Promise<ValidateCouponResult> {
  const parsed = validateCouponSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid coupon code." };
  }
  const v = parsed.data;
  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("properties")
    .select("id, host_id")
    .eq("id", v.property_id)
    .maybeSingle();
  if (!listing) return { ok: false, error: "This listing isn’t available." };

  // Signed-in guest (if any) so the per-guest cap can be pre-checked.
  const {
    data: { user },
  } = await createServerClient().auth.getUser();

  const res = await resolveCoupon(admin, {
    code: v.code,
    hostId: listing.host_id,
    listingId: listing.id,
    nights: nightsBetween(v.check_in, v.check_out),
    guestId: user?.id ?? null,
    roomIds: v.room_ids,
    addonIds: v.addon_ids,
    accommodationAmount: v.accommodation_amount,
    addonsAmount: v.addons_amount,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, coupon: res.resolved, label: res.label };
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
    .from("properties")
    .select(
      "id, host_id, name, base_price, weekend_price, cleaning_fee, currency, max_guests, min_nights, is_published, booking_mode, whole_property_discount_pct, weekly_discount_pct, monthly_discount_pct, child_price, infant_price, pet_fee, allow_children, allow_infants, allow_pets",
    )
    .eq("id", d.property_id)
    .maybeSingle();

  if (!listing || !listing.is_published) {
    return { ok: false, error: "This listing isn't available." };
  }

  // 3. Date / mode validation.
  const nights = nightsBetween(d.check_in!, d.check_out!);
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

  const admin = createAdminClient();

  // 5. Branch by scope. Each branch validates the stay and assembles the
  // priceable units; the canonical pricing engine then prices everything below
  // (§5f) so client + server + preview never disagree.
  let baseAmount = 0;
  let cleaning = 0;
  let totalAmount = 0;
  let discountAmount = 0;
  let couponId: string | null = null;
  let couponDiscount = 0;
  let priceBreakdown: PriceBreakdown | null = null;
  let pricingUnits: PricingUnit[] = [];
  // True when the guest booked every active room together — unlocks the
  // whole-listing combo discount. Whole-listing-scope bookings price off the
  // listing base_price directly and don't stack this discount.
  let isWholeCombo = false;
  let roomRowsForBooking: Array<{
    room_id: string;
    base_amount: number;
    cleaning_fee: number;
  }> = [];
  // Age/pet rates — listing-level by default; the rooms branch overrides from
  // the first booked room. Used to price children/infants/pets below.
  let ageRates = {
    childPrice: Number(listing.child_price ?? 0),
    infantPrice: Number(listing.infant_price ?? 0),
    petFee: Number(listing.pet_fee ?? 0),
  };
  // Disallowed categories can't be booked — clamped to 0 server-side even if a
  // crafted request sends them.
  let ageAllow = {
    children: listing.allow_children ?? true,
    infants: listing.allow_infants ?? true,
    pets: listing.allow_pets ?? true,
  };
  // Child/infant/pet line items — computed once the rates + nights are known.
  let ageLines: AgeExtraLine[] = [];

  if (d.scope === "rooms") {
    const roomIds = d.room_ids ?? [];

    // 5a. Validate every room_id belongs to this listing + is bookable.
    const { data: roomRows } = await admin
      .from("property_rooms")
      .select(
        "id, base_price, weekend_price, cleaning_fee, max_guests, min_guests, min_nights, pricing_mode, price_per_person, base_occupancy, extra_guest_price, child_price, infant_price, pet_fee, allow_children, allow_infants, allow_pets",
      )
      .eq("property_id", listing.id)
      .is("deleted_at", null)
      .eq("is_active", true)
      .in("id", roomIds);

    if (!roomRows || roomRows.length !== roomIds.length) {
      return {
        ok: false,
        error: "One or more rooms aren't available. Refresh and try again.",
      };
    }
    // Age/pet rates for a per-room booking come from the first booked room; a
    // category is allowed only if EVERY booked room allows it.
    ageRates = {
      childPrice: Number(roomRows[0]?.child_price ?? 0),
      infantPrice: Number(roomRows[0]?.infant_price ?? 0),
      petFee: Number(roomRows[0]?.pet_fee ?? 0),
    };
    ageAllow = {
      children: roomRows.every((r) => r.allow_children ?? true),
      infants: roomRows.every((r) => r.allow_infants ?? true),
      pets: roomRows.every((r) => r.allow_pets ?? true),
    };

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

    // 5c. Per-room capacity + minimum-occupancy + minimum-nights checks.
    for (const r of roomRows) {
      if (guestsForRoom(r.id) > r.max_guests) {
        return {
          ok: false,
          error: `One room only sleeps ${r.max_guests} — reduce its guests.`,
        };
      }
      const minG = r.min_guests ?? 1;
      if (guestsForRoom(r.id) < minG) {
        return {
          ok: false,
          error: `One room needs at least ${minG} ${minG === 1 ? "guest" : "guests"}.`,
        };
      }
    }
    const roomsMinNights = Math.max(
      1,
      ...roomRows.map((r) => r.min_nights ?? 1),
    );
    if (nights < roomsMinNights) {
      return {
        ok: false,
        error: `One of these rooms needs a minimum stay of ${roomsMinNights} ${
          roomsMinNights === 1 ? "night" : "nights"
        }.`,
      };
    }
    const totalCap = roomRows.reduce((acc, r) => acc + r.max_guests, 0);
    // Adults + children count toward sleeping capacity (infants + pets don't).
    if (d.guests + (d.children ?? 0) > totalCap) {
      return {
        ok: false,
        error: `These rooms sleep up to ${totalCap} guests combined (adults + children).`,
      };
    }

    // 5d. Assemble the priceable units — the engine prices them in §5f.
    pricingUnits = roomRows.map((r) => ({
      roomId: r.id,
      pricing_mode: (r.pricing_mode ??
        "per_room") as PricingUnit["pricing_mode"],
      base_price: Number(r.base_price),
      price_per_person:
        r.price_per_person == null ? null : Number(r.price_per_person),
      base_occupancy: r.base_occupancy ?? null,
      extra_guest_price:
        r.extra_guest_price == null ? null : Number(r.extra_guest_price),
      weekend_price: r.weekend_price == null ? null : Number(r.weekend_price),
      cleaning_fee: Number(r.cleaning_fee ?? 0),
      guests: guestsForRoom(r.id),
    }));

    // Whole-listing combo: did the guest take every active room? Compare the
    // selection against the listing's full active-room count.
    const { count: activeRoomCount } = await admin
      .from("property_rooms")
      .select("id", { count: "exact", head: true })
      .eq("property_id", listing.id)
      .is("deleted_at", null)
      .eq("is_active", true);
    isWholeCombo =
      activeRoomCount != null &&
      activeRoomCount > 1 &&
      roomRows.length === activeRoomCount;
  } else {
    // Whole-listing path.
    if (listing.base_price == null) {
      return {
        ok: false,
        error: "This listing has no price set yet — message the host.",
      };
    }
    if (
      listing.max_guests != null &&
      d.guests + (d.children ?? 0) > listing.max_guests
    ) {
      return {
        ok: false,
        error: `This listing sleeps up to ${listing.max_guests} guests (adults + children).`,
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

    pricingUnits = [
      {
        roomId: null,
        pricing_mode: "per_room",
        base_price: Number(listing.base_price),
        price_per_person: null,
        base_occupancy: null,
        extra_guest_price: null,
        weekend_price:
          listing.weekend_price == null ? null : Number(listing.weekend_price),
        cleaning_fee: Number(listing.cleaning_fee ?? 0),
        guests: d.guests,
      },
    ];
  }

  // 5e. Re-fetch eligible addons server-side and snapshot prices.
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
  {
    const roomIdScope =
      d.scope === "rooms"
        ? pricingUnits
            .map((u) => u.roomId)
            .filter((id): id is string => id !== null)
        : [];
    const { data: eligibleAddonRows } = await admin
      .from("property_addons")
      .select(
        "addon_id, room_id, unit_price_override, addons!inner ( id, name, pricing_model, unit_price, currency, min_quantity, max_quantity, allow_custom_quantity, stock_quantity, is_required, is_active, lead_time_days )",
      )
      .eq("property_id", listing.id);

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
        allow_custom_quantity: boolean;
        stock_quantity: number | null;
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
        selectedQty.set(
          addonId,
          defaultAddonQuantity(
            entry.addon.pricing_model,
            entry.addon.min_quantity,
            nights,
          ),
        );
      }
    }

    let sortOrder = 0;
    for (const [addonId, qty] of selectedQty.entries()) {
      const entry = eligibleMap.get(addonId);
      if (!entry) continue;
      const a = entry.addon;
      // Never trust the client quantity: re-apply the same min/max/nights/stock
      // rules + the fixed pin the UI uses.
      const clamped = clampAddonQuantity(a.pricing_model, qty, {
        minQuantity: a.min_quantity,
        maxQuantity: a.max_quantity,
        nights,
        stock: a.stock_quantity,
        allowCustom: a.allow_custom_quantity,
      });
      if (clamped <= 0) continue;
      const subtotal = computeAddonSubtotal(
        a.pricing_model,
        entry.effectiveUnitPrice,
        clamped,
        d.guests,
      );
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

    // 5f. Price the whole stay through the canonical engine — per-night
    // seasonal/weekend resolution, occupancy, combo + length-of-stay discounts,
    // cleaning, and add-ons. This is the SAME engine the checkout sidebar uses,
    // so the charged total matches the quoted total to the cent, and it never
    // trusts a client-sent price.
    const { data: seasonalRows } = await admin
      .from("property_seasonal_pricing")
      .select(
        "room_id, start_date, end_date, adjustment_type, adjustment_value, label, priority, min_nights, is_active, created_at",
      )
      .eq("property_id", listing.id)
      .eq("is_active", true)
      .lte("start_date", d.check_out!)
      .gte("end_date", d.check_in!);

    const seasonalRules: SeasonalRule[] = (seasonalRows ?? []).map((s) => ({
      roomId: s.room_id,
      startDate: s.start_date,
      endDate: s.end_date,
      adjustmentType: s.adjustment_type === "percent" ? "percent" : "absolute",
      adjustmentValue: Number(s.adjustment_value),
      label: s.label,
      priority: s.priority ?? 0,
      minNights: s.min_nights ?? null,
      isActive: s.is_active,
      createdAt: s.created_at,
    }));

    const breakdown = priceStay({
      checkIn: d.check_in!,
      checkOut: d.check_out!,
      units: pricingUnits,
      seasonalRules,
      currency: listing.currency,
      totalGuests: d.guests,
      listingMinNights: listing.min_nights ?? 1,
      isWholeCombo,
      wholePct: numOrNull(listing.whole_property_discount_pct),
      weeklyPct: numOrNull(listing.weekly_discount_pct),
      monthlyPct: numOrNull(listing.monthly_discount_pct),
      addons: addonInserts.map((a) => ({
        label: a.label,
        pricingModel: a.pricing_model,
        unitPrice: a.unit_price,
        quantity: a.quantity,
        addonId: a.addon_id,
      })),
    });

    // Enforce peak-season minimum nights (max of listing + overlapping rules).
    // Nothing is persisted yet, so a bare return is a clean bail-out.
    if (nights < breakdown.effectiveMinNights) {
      return {
        ok: false,
        error: `These dates need a minimum stay of ${breakdown.effectiveMinNights} nights.`,
      };
    }

    // 5g. Coupon — re-validate server-side (never trust the client) and re-price.
    let finalBreakdown = breakdown;
    if (d.coupon_code && d.coupon_code.trim().length > 0) {
      const resolution = await resolveCoupon(admin, {
        code: d.coupon_code,
        hostId: listing.host_id,
        listingId: listing.id,
        nights,
        guestId: user.id,
        roomIds:
          d.scope === "rooms"
            ? pricingUnits
                .map((u) => u.roomId)
                .filter((id): id is string => id !== null)
            : [],
        addonIds: addonInserts.map((a) => a.addon_id),
        accommodationAmount:
          breakdown.baseSubtotal - breakdown.discount.discountTotal,
        addonsAmount: breakdown.addonsTotal,
      });
      if (!resolution.ok) {
        return { ok: false, error: resolution.error };
      }
      // Re-price with the coupon so the charged total includes it exactly.
      finalBreakdown = priceStay({
        checkIn: d.check_in!,
        checkOut: d.check_out!,
        units: pricingUnits,
        seasonalRules,
        currency: listing.currency,
        totalGuests: d.guests,
        listingMinNights: listing.min_nights ?? 1,
        isWholeCombo,
        wholePct: numOrNull(listing.whole_property_discount_pct),
        weeklyPct: numOrNull(listing.weekly_discount_pct),
        monthlyPct: numOrNull(listing.monthly_discount_pct),
        addons: addonInserts.map((a) => ({
          label: a.label,
          pricingModel: a.pricing_model,
          unitPrice: a.unit_price,
          quantity: a.quantity,
        })),
        coupon: resolution.resolved,
      });
      // A coupon that resolves to zero off (e.g. nothing eligible) is rejected.
      if (finalBreakdown.couponDiscount <= 0) {
        return { ok: false, error: "This coupon doesn’t apply to your order." };
      }
      couponId = resolution.couponId;
      couponDiscount = finalBreakdown.couponDiscount;
    }

    // Age/pet extras (children, infants, pets) priced per the room/listing
    // rates and added to the charged total.
    const ageExtras = computeAgeExtras(
      {
        adults: 0,
        children: ageAllow.children ? (d.children ?? 0) : 0,
        infants: ageAllow.infants ? (d.infants ?? 0) : 0,
        pets: ageAllow.pets ? (d.pets ?? 0) : 0,
      },
      ageRates,
      nights,
    );
    ageLines = ageExtras.lines;

    baseAmount = finalBreakdown.baseSubtotal;
    cleaning = finalBreakdown.cleaningTotal;
    discountAmount = finalBreakdown.discount.discountTotal;
    totalAmount = finalBreakdown.total + ageExtras.total;
    priceBreakdown = finalBreakdown;
    roomRowsForBooking = finalBreakdown.units
      .filter((u) => u.roomId !== null)
      .map((u) => ({
        room_id: u.roomId as string,
        base_amount: u.baseSubtotal,
        cleaning_fee: u.cleaningFee,
      }));
  }

  // 6. Insert booking.
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

  // Record exactly which platform legal versions the guest accepted (legal
  // record), alongside the explicit acknowledgement.
  const legal = await getLegalDocuments();

  // Coupon redemption is run atomically right after the booking row is created
  // (enforces total + per-guest caps); a race that exhausts the coupon rolls the
  // booking back. No rollback callback — coupon_redemptions FK the booking and
  // cascade on delete.
  const redeem: RedeemStep | undefined = couponId
    ? {
        claim: async (bookingId) => {
          const { data: redeemed, error: redeemErr } = await admin.rpc(
            "redeem_coupon",
            {
              p_coupon_id: couponId,
              p_booking_id: bookingId,
              p_guest_id: user.id,
              p_amount: couponDiscount,
              p_currency: listing.currency,
            },
          );
          if (redeemErr || redeemed !== true) {
            return {
              ok: false,
              error:
                "Sorry — that coupon was just fully redeemed. Try without it.",
            };
          }
          return { ok: true };
        },
      }
    : undefined;

  // Age/pet charges are non-catalog booking_addons (no stock); catalog add-ons
  // reserve live inventory.
  const addons: BookingAddonRow[] = [
    ...ageLines.map((a, i) => ({
      addon_id: null,
      label: a.label,
      quantity: a.quantity,
      unit_price: a.unitPrice,
      currency: listing.currency,
      is_required: false,
      subtotal: a.subtotal,
      sort_order: 100 + i,
    })),
    ...addonInserts.map((a) => ({
      addon_id: a.addon_id,
      label: a.label,
      quantity: a.quantity,
      unit_price: a.unit_price,
      pricing_model: a.pricing_model,
      currency: a.currency,
      is_required: a.is_required,
      subtotal: a.subtotal,
      sort_order: a.sort_order,
      reserve: true,
    })),
  ];

  const result = await persistBookingAndPay({
    admin,
    bookingInsert: {
      property_id: listing.id,
      host_id: listing.host_id,
      guest_id: user.id,
      check_in: d.check_in,
      check_out: d.check_out,
      session_date: null,
      guests_count: d.guests,
      guests_breakdown: {
        adults: Math.max(
          0,
          d.guests - (ageAllow.children ? (d.children ?? 0) : 0),
        ),
        children: ageAllow.children ? (d.children ?? 0) : 0,
        infants: ageAllow.infants ? (d.infants ?? 0) : 0,
        pets: ageAllow.pets ? (d.pets ?? 0) : 0,
      },
      base_amount: baseAmount,
      cleaning_fee: cleaning,
      discount_amount: discountAmount,
      coupon_id: couponId,
      coupon_discount: couponDiscount,
      total_amount: totalAmount,
      price_breakdown: priceBreakdown,
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
      policy_acknowledged: true,
      policy_acknowledged_at: new Date().toISOString(),
      accepted_terms_version: legal.booking_terms.version,
      accepted_privacy_version: legal.privacy.version,
    },
    redeem,
    bookingRooms: d.scope === "rooms" ? roomRowsForBooking : [],
    addons,
    policy: { listingId: listing.id },
    payable: {
      scope: d.scope,
      status: isEft ? "pending_eft" : "pending",
      payment_status: "pending",
      total_amount: totalAmount,
      deposit_amount: null,
      currency: listing.currency,
      guest_id: user.id,
      property_id: listing.id,
      listing_name: listing.name,
      host_id: listing.host_id,
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

  // Card → Paystack checkout URL; EFT (chosen or fallback) → the success page,
  // which shows the awaiting-transfer state + the host's banking details.
  redirect(result.redirectTo);
}
