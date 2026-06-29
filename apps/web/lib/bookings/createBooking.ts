import "server-only";

import { z } from "zod";

import {
  clampAddonQuantity,
  computeAddonSubtotal,
  defaultAddonQuantity,
  type PricingModel,
} from "@/app/[locale]/dashboard/addons/schemas";
import {
  createBookingSchema,
  type CreateBookingInput,
} from "@/app/[locale]/property/[slug]/book/schemas";
import {
  persistBookingAndPay,
  type BookingAddonRow,
  type RedeemStep,
} from "@/lib/bookings/persist";
import { resolveCoupon } from "@/lib/coupons";
import { getLegalDocuments } from "@/lib/legal";
import {
  computeAgeExtras,
  nightsBetween,
  priceStay,
  type AgeExtraLine,
  type PriceBreakdown,
  type PricingUnit,
  type SeasonalRule,
} from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// The ONE booking pricing + persistence path, shared by every surface so a
// quoted total can NEVER diverge from the charged total and the client is never
// trusted on price.
//
//   priceBooking()      — validate + re-price a stay (rooms/whole + add-ons +
//                         coupon + age extras) on the service-role admin client.
//                         No writes. Used by the live quote AND by:
//   createBookingCore() — price, then persist + start payment. The app's
//                         authenticated checkout (createBookingAction) and the
//                         session-less on-site checkout (/api/site-booking) both
//                         call it; they differ only in actor + payment return.
// ─────────────────────────────────────────────────────────────────────────

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Pricing-only subset of the booking input (no payment/contact fields), so a
 *  quote can be priced before the guest has entered their details. */
const priceBookingSchema = z
  .object({
    property_id: z.string().uuid(),
    scope: z.enum(["whole_listing", "rooms"]).default("whole_listing"),
    room_ids: z.array(z.string().uuid()).optional(),
    room_guests: z
      .array(
        z.object({
          room_id: z.string().uuid(),
          guests: z.number().int().min(1).max(50),
        }),
      )
      .optional(),
    check_in: z.string().regex(ISO).optional(),
    check_out: z.string().regex(ISO).optional(),
    guests: z.coerce.number().int().min(1).max(50),
    children: z.coerce.number().int().min(0).max(50).optional().default(0),
    infants: z.coerce.number().int().min(0).max(50).optional().default(0),
    pets: z.coerce.number().int().min(0).max(50).optional().default(0),
    selected_addons: z
      .array(
        z.object({
          addon_id: z.string().uuid(),
          quantity: z.number().int().min(0).max(99),
        }),
      )
      .optional()
      .default([]),
    coupon_code: z.string().trim().max(40).optional(),
  })
  .refine(
    (d) =>
      d.scope === "whole_listing" ||
      (Array.isArray(d.room_ids) && d.room_ids.length > 0),
    { message: "Select at least one room.", path: ["room_ids"] },
  )
  .refine(
    (d) => typeof d.check_in === "string" && typeof d.check_out === "string",
    { message: "Missing dates for this booking.", path: ["check_in"] },
  );
export type PriceBookingInput = z.infer<typeof priceBookingSchema>;

type AddonInsert = {
  label: string;
  quantity: number;
  unit_price: number;
  pricing_model: PricingModel;
  currency: string;
  is_required: boolean;
  subtotal: number;
  addon_id: string;
  sort_order: number;
};

export type PricedBooking = {
  listing: { id: string; host_id: string; name: string; currency: string };
  baseAmount: number;
  cleaning: number;
  totalAmount: number;
  discountAmount: number;
  couponId: string | null;
  couponDiscount: number;
  /** True when a supplied coupon resolved and reduced the total. */
  couponApplied: boolean;
  priceBreakdown: PriceBreakdown | null;
  roomRowsForBooking: {
    room_id: string;
    base_amount: number;
    cleaning_fee: number;
  }[];
  ageLines: AgeExtraLine[];
  ageAllow: { children: boolean; infants: boolean; pets: boolean };
  addonInserts: AddonInsert[];
};

export type PriceBookingResult =
  | { ok: true; priced: PricedBooking }
  | { ok: false; error: string };

/** Who the booking is for + how to reach them (resolved by each surface). */
export type BookingActor = { guestId: string; email: string };

/** Payment return context — origin + the post-payment path for this surface. */
export type BookingPaymentCtx = {
  origin: string;
  returnTo: (bookingId: string) => string;
  /** Sales channel this booking came through — stored for reporting. Defaults to
   *  "vilo" (the Vilo app/directory). The on-site checkout passes "website";
   *  OTA/iCal imports set their own (airbnb, lekkerslaap, web-referred, …). */
  channel?: string;
};

export type CreateBookingCoreResult =
  | { ok: true; redirectTo: string; bookingId: string }
  | { ok: false; error: string };

// PostgREST returns numeric columns as strings — coerce to number | null.
function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function daysUntil(date: string): number {
  const target = new Date(`${date}T00:00:00Z`).getTime();
  const today = new Date(
    new Date().toISOString().slice(0, 10) + "T00:00:00Z",
  ).getTime();
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

/**
 * Validate + re-price a stay (server-authoritative). No writes. `opts.guestId`
 * lets a coupon's per-guest cap be pre-checked (pass null for an anonymous
 * quote). `opts.skipAvailability` skips the date-conflict RPCs (the quote shows
 * availability separately; the create path always checks). `opts.couponSoft`
 * prices WITHOUT a coupon that doesn't apply instead of erroring (for quotes).
 */
export async function priceBooking(
  rawInput: unknown,
  opts: {
    guestId: string | null;
    skipAvailability?: boolean;
    couponSoft?: boolean;
  },
): Promise<PriceBookingResult> {
  const parsed = priceBookingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check your selection.",
    };
  }
  const d = parsed.data;

  const admin = createAdminClient();

  const { data: listing } = await admin
    .from("properties")
    .select(
      "id, host_id, name, base_price, weekend_price, cleaning_fee, currency, max_guests, min_nights, is_published, booking_mode, whole_property_discount_pct, weekly_discount_pct, monthly_discount_pct, child_price, infant_price, pet_fee, allow_children, allow_infants, allow_pets",
    )
    .eq("id", d.property_id)
    .maybeSingle();

  if (!listing || !listing.is_published) {
    return { ok: false, error: "This listing isn't available." };
  }

  const nights = nightsBetween(d.check_in!, d.check_out!);
  if (nights <= 0) {
    return { ok: false, error: "Check-out must be after check-in." };
  }
  // Reject stays that start in the past (stale/edited deep-links) so a guest can
  // never pay for dates that have already gone.
  if (daysUntil(d.check_in!) < 0) {
    return { ok: false, error: "Check-in can’t be in the past." };
  }
  const minNights = listing.min_nights ?? 1;
  if (nights < minNights) {
    return {
      ok: false,
      error: `Minimum stay is ${minNights} ${minNights === 1 ? "night" : "nights"}.`,
    };
  }

  if (d.scope === "whole_listing" && listing.booking_mode === "rooms_only") {
    return { ok: false, error: "This listing only takes per-room bookings." };
  }

  let pricingUnits: PricingUnit[] = [];
  let isWholeCombo = false;
  let ageRates = {
    childPrice: Number(listing.child_price ?? 0),
    infantPrice: Number(listing.infant_price ?? 0),
    petFee: Number(listing.pet_fee ?? 0),
  };
  let ageAllow = {
    children: listing.allow_children ?? true,
    infants: listing.allow_infants ?? true,
    pets: listing.allow_pets ?? true,
  };

  if (d.scope === "rooms") {
    const roomIds = d.room_ids ?? [];

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

    const guestsByRoom = new Map<string, number>();
    for (const rg of d.room_guests ?? []) {
      guestsByRoom.set(rg.room_id, rg.guests);
    }
    const guestsForRoom = (roomId: string) =>
      Math.max(1, guestsByRoom.get(roomId) ?? 1);

    if (!opts.skipAvailability) {
      for (const r of roomRows) {
        const { data: availResult, error: availErr } = await admin.rpc(
          "room_is_available",
          {
            p_listing_id: listing.id,
            p_room_id: r.id,
            p_check_in: d.check_in!,
            p_check_out: d.check_out!,
          },
        );
        if (availErr || availResult === false) {
          return {
            ok: false,
            error: "One of your rooms was just booked. Try different dates.",
          };
        }
      }
    }

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
    if (d.guests + (d.children ?? 0) > totalCap) {
      return {
        ok: false,
        error: `These rooms sleep up to ${totalCap} guests combined (adults + children).`,
      };
    }

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

    if (!opts.skipAvailability) {
      const { data: availResult, error: availErr } = await admin.rpc(
        "listing_is_available_whole",
        {
          p_listing_id: listing.id,
          p_check_in: d.check_in!,
          p_check_out: d.check_out!,
        },
      );
      if (availErr || availResult === false) {
        return {
          ok: false,
          error: "These dates aren't available. Try different ones.",
        };
      }
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

  // Eligible add-ons — re-fetched + clamped server-side (never trust client qty).
  const addonInserts: AddonInsert[] = [];
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
      { addon: AddonJoinRow["addons"]; effectiveUnitPrice: number }
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
  }

  // Canonical pricing engine.
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

  const engineInput = {
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
  };

  const breakdown = priceStay(engineInput);

  if (nights < breakdown.effectiveMinNights) {
    return {
      ok: false,
      error: `These dates need a minimum stay of ${breakdown.effectiveMinNights} nights.`,
    };
  }

  // Coupon — re-validate + re-price server-side.
  let finalBreakdown = breakdown;
  let couponId: string | null = null;
  let couponDiscount = 0;
  let couponApplied = false;
  if (d.coupon_code && d.coupon_code.trim().length > 0) {
    const resolution = await resolveCoupon(admin, {
      code: d.coupon_code,
      hostId: listing.host_id,
      listingId: listing.id,
      nights,
      guestId: opts.guestId,
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
      if (!opts.couponSoft) return { ok: false, error: resolution.error };
    } else {
      const withCoupon = priceStay({
        ...engineInput,
        coupon: resolution.resolved,
      });
      if (withCoupon.couponDiscount <= 0) {
        if (!opts.couponSoft) {
          return {
            ok: false,
            error: "This coupon doesn’t apply to your order.",
          };
        }
      } else {
        finalBreakdown = withCoupon;
        couponId = resolution.couponId;
        couponDiscount = withCoupon.couponDiscount;
        couponApplied = true;
      }
    }
  }

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

  return {
    ok: true,
    priced: {
      listing: {
        id: listing.id,
        host_id: listing.host_id,
        name: listing.name,
        currency: listing.currency,
      },
      baseAmount: finalBreakdown.baseSubtotal,
      cleaning: finalBreakdown.cleaningTotal,
      discountAmount: finalBreakdown.discount.discountTotal,
      totalAmount: finalBreakdown.total + ageExtras.total,
      couponId,
      couponDiscount,
      couponApplied,
      priceBreakdown: finalBreakdown,
      roomRowsForBooking: finalBreakdown.units
        .filter((u) => u.roomId !== null)
        .map((u) => ({
          room_id: u.roomId as string,
          base_amount: u.baseSubtotal,
          cleaning_fee: u.cleaningFee,
        })),
      ageLines: ageExtras.lines,
      ageAllow,
      addonInserts,
    },
  };
}

/**
 * Price a booking, then persist it + start payment. `actor` is already resolved
 * (auth user or website lead); `ctx` carries the payment origin + return path.
 * Returns the redirect target instead of issuing the redirect, so a server
 * action can `redirect()` and a route handler can return JSON.
 */
export async function createBookingCore(
  rawInput: CreateBookingInput,
  actor: BookingActor,
  ctx: BookingPaymentCtx,
): Promise<CreateBookingCoreResult> {
  // Price first (authoritative — runs availability + a hard coupon check).
  const priceResult = await priceBooking(rawInput, { guestId: actor.guestId });
  if (!priceResult.ok) return priceResult;
  const p = priceResult.priced;

  // Parse the full input for the persist-only fields (payment + contact).
  const full = createBookingSchema.safeParse(rawInput);
  if (!full.success) {
    return { ok: false, error: "Please check the form and try again." };
  }
  const d = full.data;

  const admin = createAdminClient();
  const isEft = d.payment_method === "eft";

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

  const legal = await getLegalDocuments();

  const redeem: RedeemStep | undefined = p.couponId
    ? {
        claim: async (bookingId) => {
          const { data: redeemed, error: redeemErr } = await admin.rpc(
            "redeem_coupon",
            {
              p_coupon_id: p.couponId,
              p_booking_id: bookingId,
              p_guest_id: actor.guestId,
              p_amount: p.couponDiscount,
              p_currency: p.listing.currency,
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

  const addons: BookingAddonRow[] = [
    ...p.ageLines.map((a, i) => ({
      addon_id: null,
      label: a.label,
      quantity: a.quantity,
      unit_price: a.unitPrice,
      currency: p.listing.currency,
      is_required: false,
      subtotal: a.subtotal,
      sort_order: 100 + i,
    })),
    ...p.addonInserts.map((a) => ({
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

  return persistBookingAndPay({
    admin,
    bookingInsert: {
      property_id: p.listing.id,
      host_id: p.listing.host_id,
      guest_id: actor.guestId,
      check_in: d.check_in,
      check_out: d.check_out,
      session_date: null,
      guests_count: d.guests,
      guests_breakdown: {
        adults: Math.max(
          0,
          d.guests - (p.ageAllow.children ? (d.children ?? 0) : 0),
        ),
        children: p.ageAllow.children ? (d.children ?? 0) : 0,
        infants: p.ageAllow.infants ? (d.infants ?? 0) : 0,
        pets: p.ageAllow.pets ? (d.pets ?? 0) : 0,
      },
      base_amount: p.baseAmount,
      cleaning_fee: p.cleaning,
      discount_amount: p.discountAmount,
      coupon_id: p.couponId,
      coupon_discount: p.couponDiscount,
      total_amount: p.totalAmount,
      price_breakdown: p.priceBreakdown,
      currency: p.listing.currency,
      payment_method: d.payment_method,
      status: isEft ? "pending_eft" : "pending",
      payment_status: "pending",
      channel: ctx.channel ?? "vilo",
      scope: d.scope,
      guest_name: d.guest_name ?? null,
      guest_email: d.guest_email ?? actor.email,
      guest_phone: d.guest_phone ?? null,
      special_requests: d.special_requests ?? null,
      additional_guests: additionalGuests,
      policy_acknowledged: true,
      policy_acknowledged_at: new Date().toISOString(),
      accepted_terms_version: legal.booking_terms.version,
      accepted_privacy_version: legal.privacy.version,
    },
    redeem,
    bookingRooms: d.scope === "rooms" ? p.roomRowsForBooking : [],
    addons,
    policy: { listingId: p.listing.id },
    payable: {
      scope: d.scope,
      status: isEft ? "pending_eft" : "pending",
      payment_status: "pending",
      total_amount: p.totalAmount,
      deposit_amount: null,
      currency: p.listing.currency,
      guest_id: actor.guestId,
      property_id: p.listing.id,
      listing_name: p.listing.name,
      host_id: p.listing.host_id,
    },
    payment: {
      method: d.payment_method,
      amount: "full",
      email: actor.email,
      origin: ctx.origin,
      returnTo: ctx.returnTo,
    },
  });
}
