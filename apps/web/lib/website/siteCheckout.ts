import "server-only";

import { z } from "zod";

import {
  createBookingCore,
  priceBooking,
  type CreateBookingCoreResult,
} from "@/lib/bookings/createBooking";
import type { CreateBookingInput } from "@/app/[locale]/property/[slug]/book/schemas";
import { findOrCreateLeadIdentity } from "@/lib/enquiry/lead-identity";
import { nightsBetween } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSiteProperty } from "@/lib/website/bookingFunnel";

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
    // channel="website" → a booking through the host's own Vilo website (still a
    // direct booking, distinct from the Vilo app/directory for reporting).
    { origin: ctx.origin, returnTo, channel: "website" },
  );

  // Notify the host of the new website booking so they can manage it (confirm a
  // manual EFT, prep the stay…). Best-effort — a notification failure must never
  // fail the booking or the payment redirect.
  if (result.ok) {
    try {
      const { data: bk } = await admin
        .from("bookings")
        .select("host_id")
        .eq("id", result.bookingId)
        .maybeSingle();
      const hostRecordId = (bk as { host_id: string | null } | null)?.host_id;
      if (hostRecordId) {
        const { data: host } = await admin
          .from("hosts")
          .select("user_id")
          .eq("id", hostRecordId)
          .maybeSingle();
        const userId = (host as { user_id: string | null } | null)?.user_id;
        if (userId) {
          const { dispatchEvent } =
            await import("@/lib/notifications/dispatch");
          await dispatchEvent({
            kind: "booking_request_host",
            recipientUserId: userId,
            refs: { booking_id: result.bookingId },
            supabase: admin,
          });
        }
      }
    } catch {
      // non-blocking
    }

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
