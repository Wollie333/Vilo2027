// Server-side booking-funnel logic for the hosted micro-sites (Phase 6B).
//
// Two public, unauthenticated endpoints back the funnel widgets:
//   • quoteWebsiteStay      — availability + a SERVER-RECALCULATED price
//   • websiteAvailability   — the property's blocked dates for a calendar
//
// SECURITY: tenant sites have no session, so these run on the SERVICE-ROLE admin
// client with EXPLICIT filters. Every call is gated by an anti-tamper membership
// check — the requested property MUST be a *visible* channel member of the given
// website — so a site can only ever quote/inspect its own listings. The price is
// ALWAYS recomputed from the live DB via the canonical engine (`computeStayPricing`,
// the same one the guest checkout uses); nothing the client sends is trusted.
import { z } from "zod";

import { nightsBetween } from "@/lib/pricing";
import { computeStayPricing } from "@/lib/pricing/quote";
import { createAdminClient } from "@/lib/supabase/admin";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");
const localeSchema = z
  .string()
  .regex(/^[a-z]{2}$/)
  .optional();

export const websiteQuoteSchema = z.object({
  website_id: z.string().uuid(),
  property_id: z.string().uuid(),
  check_in: iso,
  check_out: iso,
  guests: z.number().int().min(1).max(50),
  locale: localeSchema,
});
export type WebsiteQuoteInput = z.infer<typeof websiteQuoteSchema>;

export const websiteAvailabilitySchema = z.object({
  website_id: z.string().uuid(),
  property_id: z.string().uuid(),
  room_id: z.string().uuid().optional(),
  start: iso,
  end: iso,
});
export type WebsiteAvailabilityInput = z.infer<
  typeof websiteAvailabilitySchema
>;

export type WebsiteQuoteResult =
  | {
      ok: true;
      available: boolean;
      nights: number;
      /** Server-recalculated total, or null when the property has no whole-stay
       *  price (rooms-only — the guest picks rooms on the checkout page). */
      total: number | null;
      currency: string;
      /** Absolute checkout deep-link with the chosen dates/guests pre-filled. */
      bookHref: string;
    }
  | { ok: false; error: string };

export type WebsiteAvailabilityResult =
  | { ok: true; unavailable: string[] }
  | { ok: false; error: string };

export type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Anti-tamper gate: confirm `propertyId` is a visible channel member of
 * `websiteId`. Returns the property's slug + currency for the deep-link/quote, or
 * null when the property isn't bookable through this site. Shared by the funnel
 * endpoints AND the on-site checkout (lib/website/siteCheckout.ts).
 */
export async function resolveSiteProperty(
  admin: AdminClient,
  websiteId: string,
  propertyId: string,
): Promise<{ slug: string; currency: string } | null> {
  const { data: member } = await admin
    .from("website_properties")
    .select("property_id")
    .eq("website_id", websiteId)
    .eq("property_id", propertyId)
    .eq("is_visible", true)
    .maybeSingle();
  if (!member) return null;

  const { data: property } = await admin
    .from("properties")
    .select("slug, currency, deleted_at")
    .eq("id", propertyId)
    .maybeSingle();
  if (!property || property.deleted_at) return null;
  return {
    slug: (property.slug as string | null) ?? "",
    currency: (property.currency as string | null) ?? "ZAR",
  };
}

/** Absolute checkout deep-link with the chosen stay pre-filled. */
function funnelBookHref(
  locale: string,
  slug: string,
  checkIn: string,
  checkOut: string,
  guests: number,
): string {
  const qs = new URLSearchParams({
    from: checkIn,
    to: checkOut,
    guests: String(guests),
  });
  const path = `/${locale}/property/${slug}/book?${qs.toString()}`;
  return APP_URL ? `${APP_URL}${path}` : path;
}

/**
 * Availability + a server-recalculated whole-stay quote for one of the site's
 * properties. Prices the property as a whole stay (the engine re-prices); when
 * the property is rooms-only (no whole-stay base price) the total comes back
 * null but availability + the deep-link still work. Never throws.
 */
export async function quoteWebsiteStay(
  body: unknown,
): Promise<WebsiteQuoteResult> {
  const parsed = websiteQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Pick valid dates and number of guests." };
  }
  const input = parsed.data;
  const nights = nightsBetween(input.check_in, input.check_out);
  if (nights <= 0) {
    return { ok: false, error: "Check-out must be after check-in." };
  }

  const admin = createAdminClient();
  const property = await resolveSiteProperty(
    admin,
    input.website_id,
    input.property_id,
  );
  if (!property) {
    return { ok: false, error: "That property isn't bookable on this site." };
  }

  // Availability at the property level — counts whole-listing AND room blocks.
  const { data: available, error: availErr } = await admin.rpc(
    "listing_is_available_whole",
    {
      p_listing_id: input.property_id,
      p_check_in: input.check_in,
      p_check_out: input.check_out,
    },
  );
  if (availErr) {
    return { ok: false, error: "Couldn't check availability — try again." };
  }

  const bookHref = funnelBookHref(
    input.locale ?? "en",
    property.slug,
    input.check_in,
    input.check_out,
    input.guests,
  );

  // Server-recalculated whole-stay price. Rooms-only properties have no
  // whole-stay base price → the engine errors; we treat that as "no single
  // total" rather than surfacing an engine error to the guest.
  const priced = await computeStayPricing(admin, {
    property_id: input.property_id,
    check_in: input.check_in,
    check_out: input.check_out,
    scope: "whole_listing",
    guests: input.guests,
    rooms: [],
  });

  return {
    ok: true,
    available: available === true,
    nights,
    total: priced.ok ? priced.data.total : null,
    currency: priced.ok ? priced.data.currency : property.currency,
    bookHref,
  };
}

/**
 * Blocked dates for one of the site's properties over a window, for the calendar
 * widget. A date is unavailable when a whole-listing block exists OR (no specific
 * room asked) every active room is blocked OR (a room asked) that room is blocked.
 * Window is capped so a malicious caller can't scan years of data. Never throws.
 */
export async function websiteAvailability(
  body: unknown,
): Promise<WebsiteAvailabilityResult> {
  const parsed = websiteAvailabilitySchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const input = parsed.data;
  if (nightsBetween(input.start, input.end) > 80) {
    return { ok: false, error: "Date window is too large." };
  }

  const admin = createAdminClient();
  const property = await resolveSiteProperty(
    admin,
    input.website_id,
    input.property_id,
  );
  if (!property) {
    return { ok: false, error: "That property isn't available on this site." };
  }

  const { data: blocks, error } = await admin
    .from("blocked_dates")
    .select("date, room_id")
    .eq("property_id", input.property_id)
    .gte("date", input.start)
    .lte("date", input.end);
  if (error) return { ok: false, error: "Couldn't load availability." };

  const rows = (blocks ?? []) as { date: string; room_id: string | null }[];

  // A specific room: blocked when a whole-listing block OR that room is blocked.
  if (input.room_id) {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.room_id == null || r.room_id === input.room_id) set.add(r.date);
    }
    return { ok: true, unavailable: [...set] };
  }

  // Property level: a whole-listing block (room_id null) blocks the date; a date
  // where EVERY active room is individually blocked is also fully unavailable.
  const { count: activeRooms } = await admin
    .from("property_rooms")
    .select("id", { count: "exact", head: true })
    .eq("property_id", input.property_id)
    .is("deleted_at", null)
    .eq("is_active", true);

  const wholeBlocked = new Set<string>();
  const roomsByDate = new Map<string, Set<string>>();
  for (const r of rows) {
    if (r.room_id == null) {
      wholeBlocked.add(r.date);
    } else {
      const s = roomsByDate.get(r.date) ?? new Set<string>();
      s.add(r.room_id);
      roomsByDate.set(r.date, s);
    }
  }

  const unavailable = new Set<string>(wholeBlocked);
  if (activeRooms && activeRooms > 0) {
    for (const [date, set] of roomsByDate) {
      if (set.size >= activeRooms) unavailable.add(date);
    }
  }
  return { ok: true, unavailable: [...unavailable] };
}
