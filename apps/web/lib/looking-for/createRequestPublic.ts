import { headers } from "next/headers";
import { z } from "zod";

import { getConsentVersion } from "@/lib/auth/consent";
import { checkRateLimit } from "@/lib/auth/rateLimit";
import { findOrCreateLeadIdentity } from "@/lib/enquiry/lead-identity";
import { clientIpFromHeaders } from "@/lib/security/turnstile";
import {
  countryFromHeaders,
  deviceFromUa,
  funnelSessionId,
  recordFunnelEvent,
} from "@/lib/funnel/track";
import { guestCan } from "@/lib/guests/permissions";
import {
  CAP_REACHED_MESSAGE,
  insertLookingForPost,
  type LookingForPostInput,
} from "@/lib/looking-for/insertPost";
import { MAX_ACTIVE_LOOKING_FOR_POSTS } from "@/lib/looking-for/limits";
import { createAdminClient } from "@/lib/supabase/admin";

// Core logic for the PUBLIC "post a request" funnel (WS-2b): a signed-out
// visitor completes the Looking-For wizard, and we silently mint a passwordless
// guest identity, create the post, and hand back a magic-link redirect that
// signs them in and lands them on their new request. Kept as a PLAIN server
// module (no "use server") — invoked from a Route Handler so the real error
// reaches the client instead of an opaque 500 (mirrors lib/enquiry/create-enquiry).
//
// Security posture (mirrors the enquiry template):
//   • POPIA: consent is validated BEFORE any write — a false/absent consent is
//     rejected, so the checkbox gates the INSERT, not just the UI.
//   • Honeypot + per-email hourly rate-limit + the DB 3-active cap.
//   • A magic link is minted ONLY for a passwordless LEAD. An existing (claimed)
//     account is sent to /login — we never auto-sign-in someone who has a
//     password from a form anyone could submit with their email.

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const publicRequestSchema = z.object({
  // Contact + consent (public-only fields).
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: z.string().trim().email("Enter a valid email.").max(200),
  consent: z.literal(true, {
    message: "Please accept the terms to post.",
  }),
  // Honeypot — a real user never fills this.
  hp: z.string().optional().default(""),

  // Post payload (mirrors LookingForPostInput; the writer null-guards the rest).
  title: z.string().trim().min(5, "Give your request a short title.").max(100),
  description: z.string().max(20000).optional(),
  category: z.string().trim().max(60).default("accommodation"),
  check_in_date: DATE.optional(),
  check_out_date: DATE.optional(),
  date_flexibility_days: z.coerce.number().int().min(0).max(60).optional(),
  adults: z.coerce.number().int().min(1).max(100),
  children: z.coerce.number().int().min(0).max(100).default(0),
  infants: z.coerce.number().int().min(0).max(100).default(0),
  child_ages: z
    .array(z.coerce.number().int().min(0).max(17))
    .max(20)
    .optional(),
  pets: z.coerce.number().int().min(0).max(50).optional(),
  location_text: z.string().trim().max(200).optional(),
  location_region: z.string().trim().max(80).optional(),
  location_lat: z.coerce.number().min(-90).max(90).optional(),
  location_lng: z.coerce.number().min(-180).max(180).optional(),
  search_radius_km: z.coerce.number().min(0).max(1000).optional(),
  destination_flexible: z.boolean().optional().default(false),
  budget_min: z.coerce.number().min(0).max(100_000_000).optional(),
  budget_max: z.coerce.number().min(0).max(100_000_000).optional(),
  budget_per: z.enum(["night", "total", "person"]).optional(),
  is_urgent: z.boolean().optional().default(false),
  // Public funnel posts are public by default (that's the point — appear in the
  // directory + fan out to matching hosts).
  is_public: z.boolean().optional().default(true),
  quote_deadline: DATE.optional(),
  min_host_rating: z.coerce.number().min(1).max(5).optional(),
  image_url: z.string().url().max(1000).nullish(),
  requirement_keys: z.array(z.string().max(120)).max(100).optional(),
});

export type PublicRequestInput = z.input<typeof publicRequestSchema>;

export type CreateRequestPublicResult =
  | {
      ok: true;
      data: { postId: string; redirectTo: string; isLead: boolean };
    }
  | { ok: false; error: string };

export async function createRequestPublic(
  input: unknown,
): Promise<CreateRequestPublicResult> {
  // Anonymous account creation + email. Generous ceiling: SA mobile carriers
  // share NAT addresses across many real users. Fails open.
  const rate = await checkRateLimit(
    clientIpFromHeaders(headers()),
    "lf-request",
    15,
    60,
  );
  if (!rate.ok) {
    return {
      ok: false,
      error: "Too many requests from this network. Please try again later.",
    };
  }

  const parsed = publicRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Some fields look wrong.",
    };
  }
  const d = parsed.data;

  // Honeypot tripped → pretend success, create nothing.
  if (d.hp.trim().length > 0) {
    return {
      ok: true,
      data: { postId: "", redirectTo: "/looking-for", isLead: false },
    };
  }

  // Global guest permission gate (admin-controlled). Off = posting disabled.
  if (!(await guestCan("looking_for_post"))) {
    return { ok: false, error: "Posting requests is currently unavailable." };
  }

  const email = d.email.trim().toLowerCase();
  const admin = createAdminClient();

  // Find-or-create the passwordless guest identity (also affiliate-attributes a
  // brand-new lead). Consent has already passed validation above, so no write
  // has happened for a non-consenting submission.
  const identity = await findOrCreateLeadIdentity(admin, {
    email,
    name: d.name,
  });
  if (!identity) {
    return { ok: false, error: "Could not start your account. Try again." };
  }
  const { guestId, isLead, created } = identity;

  // Record THIS consent event for an account that hasn't consented yet (fresh
  // lead, or an older one created before consent capture). Never overwrite an
  // existing acceptance.
  await admin
    .from("user_profiles")
    .update({
      terms_accepted_at: new Date().toISOString(),
      terms_version: await getConsentVersion(),
    })
    .eq("id", guestId)
    .is("terms_accepted_at", null);

  // Light anti-abuse: cap posts from one identity per hour. The DB trigger caps
  // ACTIVE posts at 3; this additionally throttles rapid-fire creation. Silently
  // absorb extras (don't hand an attacker a signal).
  const { count: recentCount } = await admin
    .from("looking_for_posts")
    .select("id", { count: "exact", head: true })
    .eq("guest_id", guestId)
    .gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
  if ((recentCount ?? 0) >= MAX_ACTIVE_LOOKING_FOR_POSTS) {
    return { ok: false, error: CAP_REACHED_MESSAGE };
  }

  // Build the writer payload (drop the public-only contact/consent fields).
  const payload: LookingForPostInput = {
    title: d.title,
    description: d.description,
    category: d.category,
    check_in_date: d.check_in_date,
    check_out_date: d.check_out_date,
    date_flexibility_days: d.date_flexibility_days,
    adults: d.adults,
    children: d.children,
    infants: d.infants,
    child_ages: d.child_ages,
    pets: d.pets,
    location_text: d.location_text,
    location_region: d.location_region,
    location_lat: d.location_lat,
    location_lng: d.location_lng,
    search_radius_km: d.search_radius_km,
    destination_flexible: d.destination_flexible,
    budget_min: d.budget_min,
    budget_max: d.budget_max,
    budget_per: d.budget_per,
    is_urgent: d.is_urgent,
    is_public: d.is_public,
    quote_deadline: d.quote_deadline,
    min_host_rating: d.min_host_rating,
    image_url: d.image_url ?? null,
    requirement_keys: d.requirement_keys,
  };

  const result = await insertLookingForPost(admin, guestId, payload);
  if (result.id === null) {
    return { ok: false, error: result.error };
  }
  const postId = result.id;

  // Where the guest goes next. A magic link is minted ONLY when this request
  // just created the account — it holds nothing but the post they wrote, so
  // signing them straight in is safe and is the point of the post-first funnel.
  //
  // An account that ALREADY existed is sent to /login, even a passwordless lead:
  // anyone can submit this form with someone else's address, and a lead owns
  // real bookings, conversations and PII. Two links per email would invalidate
  // the first, so we mint exactly one, reused by the redirect.
  const nextPath = `/portal/looking-for/${postId}`;
  let redirectTo = `/login?next=${encodeURIComponent(nextPath)}`;
  if (created) {
    try {
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      const tokenHash = linkData?.properties?.hashed_token ?? null;
      if (tokenHash) {
        redirectTo = `/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=${encodeURIComponent(
          nextPath,
        )}`;
      }
    } catch {
      // Couldn't mint — fall back to /login (they can sign in to see it).
    }
  }

  // WS-7 — the two conversion events, recorded SERVER-side (a browser beacon
  // could be forged, and these are the numbers ad spend is judged on). The
  // session hash uses the same formula the beacon does, so a published request
  // joins the steps the visitor walked. Never allowed to fail the publish.
  try {
    const h = headers();
    const sessionId = funnelSessionId(h);
    const device = deviceFromUa(h.get("user-agent") ?? "");
    const country = countryFromHeaders(h);
    if (isLead) {
      await recordFunnelEvent(admin, {
        event: "account_created",
        sessionId,
        isLead,
        device,
        country,
      });
    }
    await recordFunnelEvent(admin, {
      event: "published",
      sessionId,
      postId,
      isLead,
      device,
      country,
    });
  } catch {
    // Instrumentation must never cost a published request.
  }

  return { ok: true, data: { postId, redirectTo, isLead } };
}
