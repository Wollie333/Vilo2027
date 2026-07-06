import "server-only";

import { z } from "zod";

import {
  computeAddonSubtotal,
  defaultAddonQuantity,
  type PricingModel,
} from "@/app/[locale]/dashboard/addons/schemas";
import {
  createBookingCore,
  priceBooking,
  type CreateBookingCoreResult,
} from "@/lib/bookings/createBooking";
import {
  persistBookingAndPay,
  type BookingAddonRow,
} from "@/lib/bookings/persist";
import type { CreateBookingInput } from "@/app/[locale]/property/[slug]/book/schemas";
import { findOrCreateLeadIdentity } from "@/lib/enquiry/lead-identity";
import { getLegalDocuments } from "@/lib/legal";
import { nightsBetween, type PricingUnit, type StayAddon } from "@/lib/pricing";
import { priceSpecialStay } from "@/lib/specials/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSiteProperty } from "@/lib/website/bookingFunnel";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * Notify the host of a new booking made on their own website so they can manage
 * it (confirm a manual EFT, prep the stay…). Shared by BOTH on-site checkout
 * paths — the room checkout and the special (offer) checkout — so neither can
 * silently skip it. Best-effort: a notification failure must NEVER fail the
 * booking or the payment redirect.
 */
async function notifyHostOfSiteBooking(
  admin: ReturnType<typeof createAdminClient>,
  bookingId: string,
): Promise<void> {
  try {
    const { data: bk } = await admin
      .from("bookings")
      .select("host_id")
      .eq("id", bookingId)
      .maybeSingle();
    const hostRecordId = (bk as { host_id: string | null } | null)?.host_id;
    if (!hostRecordId) return;
    const { data: host } = await admin
      .from("hosts")
      .select("user_id")
      .eq("id", hostRecordId)
      .maybeSingle();
    const userId = (host as { user_id: string | null } | null)?.user_id;
    if (!userId) return;
    const { dispatchEvent } = await import("@/lib/notifications/dispatch");
    await dispatchEvent({
      kind: "booking_request_host",
      recipientUserId: userId,
      refs: { booking_id: bookingId },
      supabase: admin,
    });
  } catch {
    // non-blocking
  }
}

// Server-side logic for the ON-SITE website checkout (Phase 6B/c). Two
// session-less, membership-gated entry points used by the tenant-domain checkout:
//   • siteBookingQuote  — a live, server-recalculated price + availability
//   • createSiteBooking — find-or-create a passwordless guest, then run the SAME
//                         booking core the app checkout uses, and start payment.
// Both run on the service-role admin client (tenant hosts have no session) and
// gate every call on the property being a VISIBLE channel member of the website.

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");

export const siteQuoteSchema = z.object({
  website_id: z.string().uuid(),
  property_id: z.string().uuid(),
  scope: z.enum(["whole_listing", "rooms"]).default("whole_listing"),
  room_guests: z
    .array(
      z.object({
        room_id: z.string().uuid(),
        guests: z.number().int().min(1).max(50),
      }),
    )
    .max(50)
    .default([]),
  check_in: iso,
  check_out: iso,
});

export type SiteQuoteResult =
  | {
      ok: true;
      available: boolean;
      nights: number;
      /** Server-recalculated total (stay + cleaning + add-ons − coupon + age
       *  extras), or null when the property can't be priced for this selection. */
      total: number | null;
      currency: string;
      /** True when a supplied coupon code resolved and reduced the total. */
      couponApplied: boolean;
    }
  | { ok: false; error: string };

/**
 * Live price + availability for the on-site checkout's running summary. Prices
 * through the SAME `priceBooking` the create path uses (so add-ons + coupons are
 * reflected exactly), with availability shown separately and an invalid coupon
 * priced soft (ignored) instead of failing the quote.
 */
export async function siteBookingQuote(
  body: unknown,
): Promise<SiteQuoteResult> {
  const parsed = siteQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Pick valid dates and guests." };
  }
  const d = parsed.data;
  const nights = nightsBetween(d.check_in, d.check_out);
  if (nights <= 0) {
    return { ok: false, error: "Check-out must be after check-in." };
  }
  if (d.scope === "rooms" && d.room_guests.length === 0) {
    return { ok: false, error: "Pick at least one room." };
  }

  const admin = createAdminClient();
  const member = await resolveSiteProperty(admin, d.website_id, d.property_id);
  if (!member) {
    return { ok: false, error: "That property isn't bookable on this site." };
  }

  // Availability — the same RPCs the booking core gates on (best-effort here; the
  // create call is authoritative).
  let available = true;
  try {
    if (d.scope === "rooms") {
      const results = await Promise.all(
        d.room_guests.map(async (r) => {
          const { data } = await admin.rpc("room_is_available", {
            p_listing_id: d.property_id,
            p_room_id: r.room_id,
            p_check_in: d.check_in,
            p_check_out: d.check_out,
          });
          return data !== false;
        }),
      );
      available = results.every(Boolean);
    } else {
      const { data } = await admin.rpc("listing_is_available_whole", {
        p_listing_id: d.property_id,
        p_check_in: d.check_in,
        p_check_out: d.check_out,
      });
      available = data !== false;
    }
  } catch {
    available = true;
  }

  // Price via the shared engine — add-ons + coupon (soft) included. Availability
  // is shown above, so the price itself runs with skipAvailability.
  const priced = await priceBooking(body, {
    guestId: null,
    skipAvailability: true,
    couponSoft: true,
  });

  return {
    ok: true,
    available,
    nights,
    total: priced.ok ? priced.priced.totalAmount : null,
    currency: priced.ok ? priced.priced.listing.currency : member.currency,
    couponApplied: priced.ok ? priced.priced.couponApplied : false,
  };
}

const siteBookingExtraSchema = z.object({
  website_id: z.string().uuid(),
  property_id: z.string().uuid(),
  // The PUBLIC path of the thank-you page on the current (tenant) origin; the
  // booking id is appended for the payment callback. Validated as a same-site
  // path to prevent an open-redirect callback.
  return_path: z.string().min(1).max(300),
  guest_name: z.string().trim().min(2, "Enter your name.").max(120),
  guest_email: z.string().trim().email("Enter a valid email.").max(160),
  guest_phone: z.string().trim().max(40).optional(),
});

/**
 * Create an on-site booking session-lessly and start payment. Resolves (or
 * creates) a passwordless guest lead from the supplied contact details, then runs
 * the shared booking core — so the on-site charge is priced and persisted exactly
 * like the app checkout. Returns the payment redirect target.
 */
export async function createSiteBooking(
  body: unknown,
  ctx: { origin: string },
): Promise<CreateBookingCoreResult> {
  const extra = siteBookingExtraSchema.safeParse(body);
  if (!extra.success) {
    return {
      ok: false,
      error: extra.error.issues[0]?.message ?? "Please complete your details.",
    };
  }
  const { website_id, property_id, return_path, guest_name, guest_email } =
    extra.data;

  // Same-site path only (the Paystack callback is origin + return_path).
  if (!return_path.startsWith("/") || return_path.startsWith("//")) {
    return { ok: false, error: "Invalid request." };
  }

  const admin = createAdminClient();
  const member = await resolveSiteProperty(admin, website_id, property_id);
  if (!member) {
    return { ok: false, error: "That property isn't bookable on this site." };
  }

  // Server-side enforcement of the host's per-website payment-method toggles
  // (Settings → Booking payment methods). The checkout UI hides disabled methods;
  // this rejects a crafted request that tries to use a hidden rail. Default-on:
  // a method is only blocked when the host explicitly disabled it.
  const method = (body as { payment_method?: unknown }).payment_method;
  if (method === "paystack" || method === "eft") {
    const { data: site } = await admin
      .from("host_websites")
      .select("settings")
      .eq("id", website_id)
      .maybeSingle();
    const payCfg =
      (
        site?.settings as {
          payments?: { paystack?: boolean; eft?: boolean };
        } | null
      )?.payments ?? {};
    if (method === "paystack" && payCfg.paystack === false) {
      return {
        ok: false,
        error: "Card payment isn't available for this site.",
      };
    }
    if (method === "eft" && payCfg.eft === false) {
      return { ok: false, error: "EFT isn't available for this site." };
    }
  }

  const identity = await findOrCreateLeadIdentity(admin, {
    email: guest_email,
    name: guest_name,
    phone: extra.data.guest_phone || null,
  });
  if (!identity) {
    return { ok: false, error: "Could not start your booking. Try again." };
  }

  const returnTo = (bookingId: string) =>
    `${return_path}${return_path.includes("?") ? "&" : "?"}b=${bookingId}`;

  const result = await createBookingCore(
    body as CreateBookingInput,
    { guestId: identity.guestId, email: guest_email },
    // channel="website" → a booking through the host's own Wielo website (still a
    // direct booking, distinct from the Wielo app/directory for reporting).
    { origin: ctx.origin, returnTo, channel: "website" },
  );

  // Notify the host of the new website booking so they can manage it (confirm a
  // manual EFT, prep the stay…). Best-effort — a notification failure must never
  // fail the booking or the payment redirect.
  if (result.ok) {
    await notifyHostOfSiteBooking(admin, result.bookingId);

    // Log the booking into the Forms submissions area so the host sees website
    // bookings alongside form leads (source 'checkout', form_id null, linked to
    // the booking via booking_id). Best-effort — never fail the booking.
    try {
      const summary = z
        .object({
          check_in: z.string().optional(),
          check_out: z.string().optional(),
          room_guests: z.array(z.object({ guests: z.number() })).optional(),
          guests_breakdown: z
            .object({
              adults: z.number().optional(),
              children: z.number().optional(),
            })
            .optional(),
        })
        .partial()
        .safeParse(body);
      const sd = summary.success ? summary.data : {};
      const guests =
        sd.room_guests?.reduce((n, r) => n + (r.guests ?? 0), 0) ||
        0 ||
        (sd.guests_breakdown?.adults ?? 0) +
          (sd.guests_breakdown?.children ?? 0);
      const data: Record<string, string> = {
        Name: guest_name,
        Email: guest_email,
      };
      if (extra.data.guest_phone) data.Phone = extra.data.guest_phone;
      if (sd.check_in && sd.check_out)
        data.Dates = `${sd.check_in} → ${sd.check_out}`;
      if (guests > 0) data.Guests = String(guests);
      await admin.from("website_form_submissions").insert({
        website_id,
        form_id: null,
        source: "checkout",
        booking_id: result.bookingId,
        data,
        status: "new",
      });
    } catch {
      // non-blocking
    }
  }

  return result;
}

// ── Special (offer) checkout on the host's own website ─────────
// A special card's "Book" now routes to THIS themed checkout with `special_id`.
// This mirrors the proven marketplace deal action (app/[locale]/deal/[slug]/book/
// actions.ts) — same authoritative `priceSpecialStay` + atomic `redeem_special`
// claim via the shared `persistBookingAndPay` — but for a session-less website
// guest, business-scoped to this site, priced ENTIRELY server-side (never trust
// the client on money), and attributed `booked_via:"website"` so reporting sees a
// special sold through the host's site.
export const siteSpecialSchema = z.object({
  website_id: z.string().uuid(),
  special_id: z.string().uuid(),
  return_path: z.string().min(1).max(300),
  guest_name: z.string().trim().min(2, "Enter your name.").max(120),
  guest_email: z.string().trim().email("Enter a valid email.").max(160),
  guest_phone: z.string().trim().max(40).optional(),
  guests: z.number().int().min(1).max(50).default(2),
  // Only used for flexible-date specials; fixed specials force their own dates.
  check_in: iso.optional(),
  check_out: iso.optional(),
  selected_addons: z.array(z.string().uuid()).max(30).default([]),
  payment_method: z.enum(["paystack", "eft"]),
});

export async function createSiteSpecialBooking(
  body: unknown,
  ctx: { origin: string },
): Promise<CreateBookingCoreResult> {
  const parsed = siteSpecialSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please complete your details.",
    };
  }
  const d = parsed.data;
  if (!d.return_path.startsWith("/") || d.return_path.startsWith("//")) {
    return { ok: false, error: "Invalid request." };
  }

  const admin = createAdminClient();

  // The website's business — the special MUST belong to it and be opted-in to the
  // site (mirrors loadSpecialsPreview's business-scoped, show_on_website gate), so
  // a crafted special_id from another host can't be booked through this site.
  const { data: site } = await admin
    .from("host_websites")
    .select("business_id, settings")
    .eq("id", d.website_id)
    .maybeSingle();
  if (!site?.business_id) {
    return { ok: false, error: "That offer isn't bookable on this site." };
  }

  const { data: special } = await admin
    .from("specials")
    .select(
      "id, host_id, business_id, property_id, room_id, currency, status, deleted_at, show_on_website, date_mode, fixed_check_in, fixed_check_out, window_start, window_end, min_nights, max_nights, price_mode, flat_total, per_night_price, max_guests, quantity, redemptions_used, go_live_at, book_by, cancellation_policy_id",
    )
    .eq("id", d.special_id)
    .maybeSingle();
  if (
    !special ||
    special.deleted_at ||
    special.status !== "active" ||
    !special.show_on_website ||
    special.business_id !== site.business_id
  ) {
    return { ok: false, error: "That offer isn't bookable on this site." };
  }
  const now = todayStr();
  if (special.go_live_at && special.go_live_at > now) {
    return { ok: false, error: "This offer isn't available yet." };
  }
  if (special.book_by && special.book_by < now) {
    return { ok: false, error: "Bookings for this offer have closed." };
  }
  if (special.redemptions_used >= special.quantity) {
    return { ok: false, error: "Sorry — this offer is sold out." };
  }

  // The special's property must be a VISIBLE member of this site.
  const member = await resolveSiteProperty(
    admin,
    d.website_id,
    special.property_id,
  );
  if (!member) {
    return { ok: false, error: "That offer isn't bookable on this site." };
  }

  // Server-side payment-method gate (host's per-website toggles).
  const payCfg =
    (
      site.settings as {
        payments?: { paystack?: boolean; eft?: boolean };
      } | null
    )?.payments ?? {};
  if (d.payment_method === "paystack" && payCfg.paystack === false) {
    return { ok: false, error: "Card payment isn't available for this site." };
  }
  if (d.payment_method === "eft" && payCfg.eft === false) {
    return { ok: false, error: "EFT isn't available for this site." };
  }

  const { data: property } = await admin
    .from("properties")
    .select(
      "id, host_id, name, currency, base_price, weekend_price, cleaning_fee, max_guests",
    )
    .eq("id", special.property_id)
    .maybeSingle();
  if (!property) {
    return { ok: false, error: "That offer isn't bookable on this site." };
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
      return { ok: false, error: "That offer isn't bookable on this site." };
    }
    room = data;
  }

  // Dates — fixed specials force their own; flexible validate against the window.
  let checkIn: string;
  let checkOut: string;
  if (special.date_mode === "fixed") {
    if (!special.fixed_check_in || !special.fixed_check_out) {
      return { ok: false, error: "That offer isn't bookable on this site." };
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
        error: `This offer needs at least ${special.min_nights} night${special.min_nights === 1 ? "" : "s"}.`,
      };
    }
    if (special.max_nights && nights > special.max_nights) {
      return {
        ok: false,
        error: `This offer is for at most ${special.max_nights} nights.`,
      };
    }
  }

  const maxGuests =
    special.max_guests ?? room?.max_guests ?? property.max_guests ?? 50;
  if (d.guests > maxGuests) {
    return {
      ok: false,
      error: `This offer sleeps up to ${maxGuests} guest${maxGuests === 1 ? "" : "s"}.`,
    };
  }

  // Availability — authoritative gate (same RPCs as a normal booking).
  if (special.room_id) {
    const { data: avail, error } = await admin.rpc("room_is_available", {
      p_listing_id: property.id,
      p_room_id: special.room_id,
      p_check_in: checkIn,
      p_check_out: checkOut,
    });
    if (error || avail === false) {
      return {
        ok: false,
        error: "These dates were just booked. Try different dates.",
      };
    }
  } else {
    const { data: avail, error } = await admin.rpc(
      "listing_is_available_whole",
      {
        p_listing_id: property.id,
        p_check_in: checkIn,
        p_check_out: checkOut,
      },
    );
    if (error || avail === false) {
      return {
        ok: false,
        error: "These dates aren't available. Try different dates.",
      };
    }
  }

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

  // Bundle add-ons (compulsory + guest-selected), re-priced server-side.
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
    addons: {
      id: string;
      name: string;
      pricing_model: PricingModel;
      unit_price: number;
      currency: string;
      min_quantity: number;
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

  // Authoritative price — flat package or per-night synthetic rule.
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

  // Session-less website guest (passwordless lead), like the room checkout.
  const identity = await findOrCreateLeadIdentity(admin, {
    email: d.guest_email,
    name: d.guest_name,
    phone: d.guest_phone || null,
  });
  if (!identity) {
    return { ok: false, error: "Could not start your booking. Try again." };
  }

  const scope = special.room_id ? "rooms" : "whole_listing";
  const isEft = d.payment_method === "eft";
  const legal = await getLegalDocuments();
  const returnTo = (bookingId: string) =>
    `${d.return_path}${d.return_path.includes("?") ? "&" : "?"}b=${bookingId}`;

  const result = await persistBookingAndPay({
    admin,
    bookingInsert: {
      property_id: property.id,
      host_id: property.host_id,
      guest_id: identity.guestId,
      special_id: special.id,
      booked_via: "website",
      // The dashboard's channel badge reads the `channel` column; without this it
      // defaults to 'direct' and mislabels a website special as a "Wielo" booking.
      // Mirrors the room checkout (createBookingCore channel:"website").
      channel: "website",
      origin: "special_booked",
      check_in: checkIn,
      check_out: checkOut,
      session_date: null,
      guests_count: d.guests,
      guests_breakdown: { adults: d.guests, children: 0, infants: 0, pets: 0 },
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
      guest_name: d.guest_name,
      guest_email: d.guest_email,
      guest_phone: d.guest_phone ?? null,
      special_requests: null,
      additional_guests: [],
      policy_acknowledged: true,
      policy_acknowledged_at: new Date().toISOString(),
      accepted_terms_version: legal.booking_terms.version,
      accepted_privacy_version: legal.privacy.version,
    },
    redeem: {
      claim: async () => {
        const { data: ok, error } = await admin.rpc("redeem_special", {
          p_special_id: special.id,
        });
        if (error || ok !== true) {
          return { ok: false, error: "Sorry — this offer just sold out." };
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
      guest_id: identity.guestId,
      property_id: property.id,
      listing_name: property.name,
      host_id: property.host_id,
    },
    payment: {
      method: d.payment_method,
      amount: "full",
      email: d.guest_email,
      origin: ctx.origin,
      returnTo,
    },
  });

  // Notify the host of the new website special booking (same as the room checkout).
  if (result.ok) {
    await notifyHostOfSiteBooking(admin, result.bookingId);
  }

  return result.ok
    ? { ok: true, bookingId: result.bookingId, redirectTo: result.redirectTo }
    : { ok: false, error: result.error };
}
