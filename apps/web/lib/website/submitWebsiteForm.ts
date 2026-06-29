import { z } from "zod";

import { verifyTurnstile } from "@/lib/security/turnstile";
import { createWebsiteEnquiry } from "@/lib/website/createWebsiteEnquiry";
import { upsertHostContact } from "@/lib/guests/contacts";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  formFieldsSchema,
  formSettingsSchema,
  type FormField,
  type FormType,
} from "@/lib/website/forms.schema";

// Core logic for a public host-built form submission (Phase 4 — slice 2). A
// PLAIN server module (no "use server") invoked from a Route Handler that owns
// its own JSON response — mirrors lib/website/createWebsiteEnquiry.ts.
//
// Every submission is persisted to website_form_submissions (the host's
// structured, exportable record — slice 4 reads it). For email-bearing forms
// (and unless the host turned inbox routing off) we ALSO reuse the contact-form
// pipeline (createWebsiteEnquiry) to open a "Website Enquiry" in the inbox and
// store the conversation_id on the submission. Newsletter routing → CRM contacts
// is slice 3; newsletter forms here just persist. Runs with the service role
// (the visitor is anonymous).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const websiteFormSubmitSchema = z.object({
  website_id: z.string().uuid(),
  form_id: z.string().uuid(),
  // Raw field values keyed by field id; coerced + validated against the form
  // definition server-side (never trusted).
  values: z.record(z.string(), z.union([z.string(), z.boolean()])).default({}),
  hp: z.string().optional(),
});

export type WebsiteFormSubmitResult =
  | {
      ok: true;
      data: {
        conversationId?: string;
        // For booking forms: the query string for the on-site checkout
        // (`property=…&room=…&from=…&to=…&guests=…`). FormSection resolves the
        // site-relative `/book` base on the client (tenant vs app-domain) and
        // sends the guest there — the shared Wielo booking handoff.
        bookingQuery?: string;
      };
    }
  | { ok: false; error: string };

/** Coerce a stored value to a trimmed display string. */
function asString(v: string | boolean | undefined): string {
  if (typeof v === "boolean") return v ? "Yes" : "";
  return (v ?? "").toString().trim();
}

/**
 * Validate the submitted values against the form's curated fields. Returns a
 * clean { [fieldId]: string } record or a user-facing error.
 */
function validateAgainstFields(
  fields: FormField[],
  values: Record<string, string | boolean>,
): { ok: true; clean: Record<string, string> } | { ok: false; error: string } {
  const clean: Record<string, string> = {};
  for (const field of fields) {
    const raw = asString(values[field.id]);
    if (field.required && raw.length === 0) {
      return { ok: false, error: `${field.label} is required.` };
    }
    if (field.type === "email" && raw.length > 0 && !EMAIL_RE.test(raw)) {
      return {
        ok: false,
        error: `Enter a valid ${field.label.toLowerCase()}.`,
      };
    }
    if (raw.length > 0) clean[field.id] = raw.slice(0, 2000);
  }
  return { ok: true, clean };
}

/** Parse a `dates` field value ("YYYY-MM-DD → YYYY-MM-DD") into a valid range. */
function parseDateRange(
  raw: string | undefined,
): { checkIn: string; checkOut: string } | null {
  if (!raw) return null;
  const [ci, co] = raw.split("→").map((s) => s.trim());
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!ci || !co || !re.test(ci) || !re.test(co) || co <= ci) return null;
  return { checkIn: ci, checkOut: co };
}

type BookingTarget = {
  propertyId: string;
  scope: "whole_listing" | "rooms";
  roomIds: string[];
};

/**
 * Resolve which property (and optional room) a booking-form submission targets,
 * for the auto-draft-quote path. Uses the site's visible rooms: a chosen room
 * name pins its room + property; otherwise, when every visible room belongs to
 * ONE property, that property (whole-listing). Returns null when it can't be
 * resolved unambiguously (e.g. rooms across multiple properties, no choice) —
 * the caller then falls back to a plain website enquiry.
 */
async function resolveBookingTarget(
  admin: ReturnType<typeof createAdminClient>,
  websiteId: string,
  roomName: string | undefined,
): Promise<BookingTarget | null> {
  const { data: wr } = await admin
    .from("website_rooms")
    .select("room_id, display_name")
    .eq("website_id", websiteId)
    .eq("is_visible", true);
  const ids = (wr ?? []).map((r) => r.room_id).filter(Boolean);
  if (ids.length === 0) return null;

  const { data: pr } = await admin
    .from("property_rooms")
    .select("id, name, property_id, is_active, deleted_at")
    .in("id", ids);
  const active = (pr ?? []).filter(
    (r) =>
      (r as { is_active: boolean | null }).is_active !== false &&
      !(r as { deleted_at: string | null }).deleted_at,
  ) as Array<{ id: string; name: string; property_id: string }>;
  if (active.length === 0) return null;

  // A chosen room pins the property exactly.
  const want = roomName?.trim().toLowerCase();
  if (want) {
    const displayByRoom = new Map(
      (wr ?? []).map((r) => [
        r.room_id,
        (r as { display_name: string | null }).display_name,
      ]),
    );
    const match = active.find(
      (r) => (displayByRoom.get(r.id)?.trim() || r.name).toLowerCase() === want,
    );
    if (match)
      return {
        propertyId: match.property_id,
        scope: "rooms",
        roomIds: [match.id],
      };
  }

  // No specific room → only resolvable when all rooms are one property.
  const props = [...new Set(active.map((r) => r.property_id))];
  if (props.length === 1)
    return { propertyId: props[0], scope: "whole_listing", roomIds: [] };
  return null;
}

export async function submitWebsiteForm(
  input: unknown,
  opts: { turnstileToken?: string; clientIp?: string } = {},
): Promise<WebsiteFormSubmitResult> {
  const parsed = websiteFormSubmitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Some fields look wrong." };
  }
  const d = parsed.data;
  // Honeypot tripped → pretend success, create nothing.
  if (d.hp && d.hp.trim().length > 0) return { ok: true, data: {} };

  const admin = createAdminClient();

  // Resolve the form (must belong to this website + not deleted).
  const { data: formRow } = await admin
    .from("website_forms")
    .select("id, type, fields, settings")
    .eq("id", d.form_id)
    .eq("website_id", d.website_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!formRow) {
    return { ok: false, error: "This form isn't available right now." };
  }

  const fields = formFieldsSchema.safeParse(formRow.fields);
  const settings = formSettingsSchema.parse(formRow.settings ?? {});
  const formType = formRow.type as FormType;
  if (!fields.success || fields.data.length === 0) {
    return { ok: false, error: "This form isn't available right now." };
  }

  // Bot-hardening — verify the Cloudflare Turnstile token unless this form has
  // spam protection turned off (per-form). Inert until the TURNSTILE_* keys are
  // configured (verifyTurnstile then resolves ok). The honeypot above always runs.
  if (settings.spamProtection !== false) {
    const human = await verifyTurnstile(opts.turnstileToken, opts.clientIp);
    if (!human.ok) {
      return {
        ok: false,
        error: "Couldn't verify you're human. Please try again.",
      };
    }
  }

  const validated = validateAgainstFields(fields.data, d.values);
  if (!validated.ok) return { ok: false, error: validated.error };

  // Persist the submission first — the host's canonical record, regardless of
  // any inbox routing below.
  const { data: subRow, error: subErr } = await admin
    .from("website_form_submissions")
    .insert({
      form_id: d.form_id,
      website_id: d.website_id,
      data: validated.clean,
      status: "new",
    })
    .select("id")
    .single();
  if (subErr || !subRow) {
    return { ok: false, error: "Couldn't submit the form. Please try again." };
  }

  // Inbox routing — email-bearing, non-newsletter forms with inbox on. Reuses
  // the shared enquiry pipeline (identity → Guests CRM, website-source thread,
  // host notify + optional email). Newsletter → CRM contacts is slice 3.
  const emailField = fields.data.find((f) => f.type === "email");
  const email = emailField ? validated.clean[emailField.id] : undefined;

  // Best-guess sender name/phone from the submitted fields (shared by the contact,
  // inbox and booking routes below).
  const nameField = fields.data.find(
    (f) => f.type === "text" && validated.clean[f.id],
  );
  const phoneField = fields.data.find((f) => f.type === "phone");
  const phone = phoneField ? validated.clean[phoneField.id] : undefined;
  const senderName = nameField ? validated.clean[nameField.id] : null;

  // Resolve the host once + check the contact isn't blocked (reused by every
  // CRM-contact write below).
  const { data: site } = await admin
    .from("host_websites")
    .select("host_id")
    .eq("id", d.website_id)
    .maybeSingle();
  const hostId = (site?.host_id as string | undefined) ?? undefined;
  let canContact = false;
  if (hostId && email) {
    const { data: existing } = await admin
      .from("host_contacts")
      .select("blocked")
      .eq("host_id", hostId)
      .ilike("email", email)
      .maybeSingle();
    canContact = !existing?.blocked;
  }

  // GUEST-ON-EVERY-SUBMIT — every email-bearing entry creates/updates a contact in
  // the host's CRM (a record Wielo owns + shares with the host), tagged `website`,
  // so the host ALWAYS gets the lead regardless of the newsletter / inbox / booking
  // routing below. emailConsent stays false here (a lead, not a marketing
  // subscriber) — the newsletter / opt-in routes add consent on top.
  if (canContact) {
    await upsertHostContact(admin, {
      hostId: hostId!,
      email: email!,
      name: senderName,
      phone: phone ?? null,
      addTags: ["website"],
    });
  }

  // NEWSLETTER — additionally flag marketing consent + a `newsletter` tag; no inbox
  // conversation (the universal contact above already captured the lead).
  if (formType === "newsletter" && email) {
    if (canContact) {
      await upsertHostContact(admin, {
        hostId: hostId!,
        email,
        name: senderName,
        phone: phone ?? null,
        emailConsent: true,
        addTags: ["newsletter"],
      });
    }
    return { ok: true, data: {} };
  }

  // MARKETING OPT-IN — a ticked consent field flagged `marketing` adds write-once
  // marketing consent + a `website-optin` tag, on top of the `website` contact.
  const marketingTicked = fields.data.some(
    (f) => f.marketing && Boolean(validated.clean[f.id]),
  );
  if (marketingTicked && canContact) {
    await upsertHostContact(admin, {
      hostId: hostId!,
      email: email!,
      name: senderName,
      phone: phone ?? null,
      emailConsent: true,
      addTags: ["website-optin"],
    });
  }

  let conversationId: string | undefined;

  // BOOKING HAND-OFF — a form whose goal is "booking" sends the guest into the
  // themed on-site checkout (the same flow as every other booking) instead of
  // creating a quote. The contact has already been captured above (so the host
  // gets the lead even if checkout is abandoned). We resolve the property/room +
  // dates and return the checkout query; FormSection redirects to `/book`.
  if (settings.goal === "booking") {
    const dF = fields.data.find((f) => f.type === "dates");
    const rng = dF ? parseDateRange(validated.clean[dF.id]) : null;
    const rF = fields.data.find((f) => f.type === "rooms");
    const target = await resolveBookingTarget(
      admin,
      d.website_id,
      rF ? validated.clean[rF.id] : undefined,
    );
    // A booking form must reach the checkout — never silently degrade to an
    // enquiry. If we can't resolve a single property/room (e.g. a multi-property
    // site with no room chosen), tell the guest what to do.
    if (!target) {
      return {
        ok: false,
        error: "Please choose a room or property to continue to booking.",
      };
    }
    const gF = fields.data.find(
      (f) => f.type === "guests" || f.type === "number",
    );
    const guests = Math.max(
      1,
      parseInt(gF ? (validated.clean[gF.id] ?? "") : "", 10) || 1,
    );
    const qs = new URLSearchParams();
    qs.set("property", target.propertyId);
    if (target.scope === "whole_listing") qs.set("scope", "whole_listing");
    else if (target.roomIds[0]) qs.set("room", target.roomIds[0]);
    if (rng) {
      qs.set("from", rng.checkIn);
      qs.set("to", rng.checkOut);
    }
    qs.set("guests", String(guests));
    return { ok: true, data: { bookingQuery: qs.toString() } };
  }

  // QUOTE REQUEST — a QUOTE form (goal "quote", with a `dates` field filled)
  // routes to the real quote pipeline so the host gets a DRAFT quote to complete
  // & send, not just an enquiry. Two distinct logics: goal "booking" hands off to
  // checkout (above); goal "quote" creates a quote here. Other forms (contact,
  // newsletter) never create a quote — they fall through to the plain enquiry.
  let bookingQuoted = false;
  const datesField = fields.data.find((f) => f.type === "dates");
  const range = datesField
    ? parseDateRange(validated.clean[datesField.id])
    : null;
  if (email && range && settings.notifyInbox && settings.goal === "quote") {
    const roomsField = fields.data.find((f) => f.type === "rooms");
    const roomName = roomsField ? validated.clean[roomsField.id] : undefined;
    const target = await resolveBookingTarget(admin, d.website_id, roomName);
    if (target) {
      const guestsField = fields.data.find(
        (f) => f.type === "guests" || f.type === "number",
      );
      const adults = Math.max(
        1,
        parseInt(
          guestsField ? (validated.clean[guestsField.id] ?? "") : "",
          10,
        ) || 1,
      );
      const guessedName = (
        nameField ? validated.clean[nameField.id] : email.split("@")[0]
      ).trim();
      const message =
        fields.data
          .map((f) => {
            const v = validated.clean[f.id];
            return v ? `${f.label}: ${v}` : null;
          })
          .filter(Boolean)
          .join("\n") ||
        `Booking request (${range.checkIn} → ${range.checkOut}).`;

      const { createEnquiry } = await import("@/lib/enquiry/create-enquiry");
      const quoted = await createEnquiry(
        {
          property_id: target.propertyId,
          scope: target.scope,
          room_ids: target.roomIds,
          check_in: range.checkIn,
          check_out: range.checkOut,
          guests_breakdown: { adults, children: 0, infants: 0, pets: 0 },
          message,
          guest_name: guessedName.length >= 2 ? guessedName : "Website visitor",
          guest_email: email,
          guest_phone: phone ?? "",
        },
        { source: "website" },
      );
      if (quoted.ok) {
        bookingQuoted = true;
        conversationId = quoted.data.conversationId;
        if (conversationId) {
          await admin
            .from("website_form_submissions")
            .update({ conversation_id: conversationId })
            .eq("id", subRow.id);
        }
      }
      // quoted not ok (e.g. listing unpublished, rate-limited) → fall through.
    }
  }

  const wantsInbox =
    !bookingQuoted &&
    formType !== "newsletter" &&
    settings.notifyInbox &&
    Boolean(email);

  if (wantsInbox && email) {
    // Sender name: first text field value, else the email local part.
    const guessedName = (
      nameField ? validated.clean[nameField.id] : email.split("@")[0]
    ).trim();
    const name = guessedName.length >= 2 ? guessedName : "Website visitor";

    // Readable message = every answered field as "Label: value" lines, so the
    // host sees the whole submission in the inbox thread.
    const message =
      fields.data
        .map((f) => {
          const v = validated.clean[f.id];
          return v ? `${f.label}: ${v}` : null;
        })
        .filter(Boolean)
        .join("\n") || "(no message)";

    const enquiry = await createWebsiteEnquiry({
      website_id: d.website_id,
      name,
      email,
      phone,
      message,
    });
    if (enquiry.ok) {
      conversationId = enquiry.data.conversationId;
      if (conversationId) {
        await admin
          .from("website_form_submissions")
          .update({ conversation_id: conversationId })
          .eq("id", subRow.id);
      }
    }
    // If the enquiry pipeline declines (e.g. blocked sender), the submission is
    // still persisted — the host sees it in the Forms responses view.
  }

  return { ok: true, data: { conversationId } };
}
