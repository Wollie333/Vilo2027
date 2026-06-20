import "server-only";

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
// The ONE booking validate→price→persist→pay core, shared by both checkout
// surfaces: the app's authenticated guest checkout (createBookingAction) and the
// session-less on-site website checkout (/api/site-booking). The two surfaces
// differ ONLY in how they resolve the actor (a signed-in user vs a passwordless
// website lead) and where payment returns to; everything pricing/availability/
// persistence runs identically here on the service-role admin client, so the
// charged total can never diverge and the client is never trusted on price.
//
// Extracted verbatim from the original createBookingAction body (which now wraps
// this) — same validation order, same engine calls, same persistence tail.
// ─────────────────────────────────────────────────────────────────────────

/** Who the booking is for + how to reach them (resolved by each surface). */
export type BookingActor = { guestId: string; email: string };

/** Payment return context — origin + the post-payment path for this surface. */
export type BookingPaymentCtx = {
  origin: string;
  returnTo: (bookingId: string) => string;
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
 * Validate, re-price (server-authoritative), persist and start payment for a
 * booking. `actor` is already resolved (auth or website lead); `ctx` carries the
 * payment origin + return path. Returns the redirect target instead of issuing
 * the redirect, so a server action can `redirect()` and a route handler can
 * return JSON.
 */
export async function createBookingCore(
  rawInput: CreateBookingInput,
  actor: BookingActor,
  ctx: BookingPaymentCtx,
): Promise<CreateBookingCoreResult> {
  const parsed = createBookingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }
  const d = parsed.data;

  const admin = createAdminClient();

  // 2. Fetch listing — must be published.
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
    return { ok: false, error: "This listing only takes per-room bookings." };
  }

  // 5. Branch by scope and assemble the priceable units.
  let baseAmount = 0;
  let cleaning = 0;
  let totalAmount = 0;
  let discountAmount = 0;
  let couponId: string | null = null;
  let couponDiscount = 0;
  let priceBreakdown: PriceBreakdown | null = null;
  let pricingUnits: PricingUnit[] = [];
  let isWholeCombo = false;
  let roomRowsForBooking: Array<{
    room_id: string;
    base_amount: number;
    cleaning_fee: number;
  }> = [];
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
  let ageLines: AgeExtraLine[] = [];

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

    // 5f. Canonical pricing engine — never trusts a client-sent price.
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

    if (nights < breakdown.effectiveMinNights) {
      return {
        ok: false,
        error: `These dates need a minimum stay of ${breakdown.effectiveMinNights} nights.`,
      };
    }

    // 5g. Coupon — re-validate + re-price server-side.
    let finalBreakdown = breakdown;
    if (d.coupon_code && d.coupon_code.trim().length > 0) {
      const resolution = await resolveCoupon(admin, {
        code: d.coupon_code,
        hostId: listing.host_id,
        listingId: listing.id,
        nights,
        guestId: actor.guestId,
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
      if (finalBreakdown.couponDiscount <= 0) {
        return { ok: false, error: "This coupon doesn’t apply to your order." };
      }
      couponId = resolution.couponId;
      couponDiscount = finalBreakdown.couponDiscount;
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

  const redeem: RedeemStep | undefined = couponId
    ? {
        claim: async (bookingId) => {
          const { data: redeemed, error: redeemErr } = await admin.rpc(
            "redeem_coupon",
            {
              p_coupon_id: couponId,
              p_booking_id: bookingId,
              p_guest_id: actor.guestId,
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

  return persistBookingAndPay({
    admin,
    bookingInsert: {
      property_id: listing.id,
      host_id: listing.host_id,
      guest_id: actor.guestId,
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
      guest_id: actor.guestId,
      property_id: listing.id,
      listing_name: listing.name,
      host_id: listing.host_id,
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
