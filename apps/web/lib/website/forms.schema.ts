// Shared Zod contract for Website CMS forms (Phase 4 — form builder).
//
// Single source of truth for the form field unit. Imported by the dashboard
// (validate the builder's edits before save) AND the public render + submit
// route (render the fields and validate a submission against them). One schema,
// no divergence — mirrors lib/website/sections.schema.ts.
//
// CURATED, not free-form: the host picks from a fixed catalogue of field types
// and edits label / placeholder / help / required / width / (choice) options.
// The dev owns the layout and styling; the host never authors raw markup.
import { z } from "zod";

// ── Field type catalogue ──────────────────────────────────────
// Order keeps the original seven first for back-compat with stored data; the
// rest are additive (jsonb, no migration). `checkbox` is the legacy single
// consent box; `consent` is its richer successor. `checkboxes` is multi-select.
export const FORM_FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "phone",
  "select",
  "checkbox",
  "date",
  "number",
  "radio",
  "checkboxes",
  "consent",
  "dates",
  "guests",
  "rooms",
  "heading",
  "paragraph",
  "divider",
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** Display-only blocks — they carry no submitted value. */
export const LAYOUT_FIELD_TYPES = ["heading", "paragraph", "divider"] as const;
export function isLayoutField(type: FormFieldType): boolean {
  return (LAYOUT_FIELD_TYPES as readonly string[]).includes(type);
}

/** Field types that carry a list of choices. */
export const CHOICE_FIELD_TYPES = [
  "select",
  "radio",
  "checkboxes",
  "rooms",
] as const;
export function isChoiceField(type: FormFieldType): boolean {
  return (CHOICE_FIELD_TYPES as readonly string[]).includes(type);
}

/** Form purpose — drives routing (slice 2/3). */
export const FORM_TYPES = ["contact", "custom", "newsletter"] as const;
export type FormType = (typeof FORM_TYPES)[number];

// A single curated field. `id` is a stable key (uuid) used as the submission
// data key ({ [field.id]: value }); never reused once data exists.
export const formFieldSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(FORM_FIELD_TYPES),
  // Optional so layout blocks (divider) and consent fields can omit it; the
  // builder enforces a label for ordinary inputs in the UI.
  label: z.string().trim().max(160).default(""),
  placeholder: z.string().max(160).optional(),
  required: z.boolean().default(false),
  // Half lays two fields side-by-side; full spans the row.
  width: z.enum(["full", "half"]).default("full"),
  // Optional hint shown beneath the field.
  help: z.string().max(300).optional(),
  // Inline label for a `consent` checkbox (the text beside the box).
  optLabel: z.string().max(300).optional(),
  // Consent fields only — an optional link rendered inside the consent label
  // (e.g. the host's Terms & Conditions or privacy policy). `linkLabel` is the
  // clickable text; `linkUrl` the destination (http(s)/mailto/relative only —
  // enforced at render). Ignored for every other field type.
  linkUrl: z.string().trim().max(500).optional(),
  linkLabel: z.string().trim().max(120).optional(),
  // Consent fields only — when true, ticking the box opts the guest into the
  // host's marketing email (write-once email consent on their contact record).
  marketing: z.boolean().optional(),
  // Choices for select/radio/checkboxes/rooms; ignored for other types.
  options: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
});
export type FormField = z.infer<typeof formFieldSchema>;

export const formFieldsSchema = z.array(formFieldSchema).max(40);

// Form-level settings (stored in website_forms.settings jsonb).
export const formSettingsSchema = z.object({
  // Optional intro shown under the form title on the public site.
  description: z.string().trim().max(600).default(""),
  submitLabel: z.string().trim().max(60).default("Send"),
  successMessage: z
    .string()
    .trim()
    .max(300)
    .default("Thanks — your message is on its way. We'll be in touch soon."),
  // What happens after a successful submit:
  //  - "page"    → redirect to the themed thank-you page for this form's GOAL
  //                (the default — frictionless, on-theme, pixel-trackable)
  //  - "message" → show the inline success message in place
  //  - "url"     → redirect to a host-specified URL
  afterSubmit: z.enum(["message", "page", "url"]).default("page"),
  // The conversion this form represents — picks the thank-you destination
  // (/thank-you/<goal>), its default copy, and (later) its Meta Pixel event.
  goal: z.enum(["general", "enquiry", "quote", "subscribe"]).default("general"),
  // Custom redirect target (afterSubmit === "url" only).
  redirectUrl: z.string().trim().max(500).default(""),
  // Optional heading override on the thank-you page (afterSubmit === "page").
  thankYouHeading: z.string().trim().max(120).default(""),
  // Email-bearing forms open a "Website Enquiry" in the inbox (slice 2). Newsletter
  // forms ignore this (they upsert a CRM contact instead — slice 3).
  notifyInbox: z.boolean().default(true),
  // Show the Cloudflare Turnstile challenge on this form and verify it server-side
  // (inert unless the TURNSTILE_* keys are configured). The honeypot always runs;
  // this is the second, stronger gate. Defaults on; a host can turn it off for a
  // low-friction form (e.g. a short newsletter signup) where the captcha hurts
  // conversion more than spam costs.
  spamProtection: z.boolean().default(true),
});
export type FormSettings = z.infer<typeof formSettingsSchema>;

/** Field types whose value is an email address (used for inbox routing in slice 2). */
export const EMAIL_FIELD_TYPE: FormFieldType = "email";
