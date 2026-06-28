// Starter form templates (Phase 4 — form builder). Picking a template in the
// New-form modal seeds a form that's already populated with sensible fields +
// settings, so the host edits a working form instead of building every field by
// hand. Per-website (the created form is an ordinary website_forms row); no
// system table. The catalogue is curated here and consumed by
// createWebsiteFormAction, which assigns a fresh uuid to each field.
import type {
  FormField,
  FormSettings,
  FormType,
} from "@/lib/website/forms.schema";

/** A field spec without its id — the action assigns a uuid per field at create. */
export type TemplateField = Omit<FormField, "id">;

export type FormTemplate = {
  type: FormType;
  fields: TemplateField[];
  settings: Partial<FormSettings>;
};

// Small builders keep the specs terse and type-safe.
const text = (
  label: string,
  opts: Partial<TemplateField> = {},
): TemplateField => ({
  type: "text",
  label,
  required: false,
  width: "full",
  ...opts,
});
const field = (
  type: FormField["type"],
  label: string,
  opts: Partial<TemplateField> = {},
): TemplateField => ({ type, label, required: false, width: "full", ...opts });

export const FORM_TEMPLATES: Record<string, FormTemplate> = {
  // Empty form — the host builds it from scratch (current behaviour).
  blank: { type: "custom", fields: [], settings: {} },

  // General enquiry → opens a "Website enquiry" in the inbox.
  contact: {
    type: "contact",
    fields: [
      text("Name", { required: true, width: "half" }),
      field("email", "Email", { required: true, width: "half" }),
      field("phone", "Phone", { width: "half" }),
      field("textarea", "Message", { required: true }),
    ],
    settings: { goal: "enquiry" },
  },

  // Booking enquiry → a dates+room form routes to the draft-quote pipeline.
  booking: {
    type: "contact",
    fields: [
      text("Name", { required: true, width: "half" }),
      field("email", "Email", { required: true, width: "half" }),
      field("phone", "Phone", { width: "half" }),
      field("dates", "Check-in / out", { required: true }),
      field("guests", "Guests", { width: "half" }),
      field("rooms", "Room", { width: "half" }),
      field("textarea", "Message"),
    ],
    settings: { goal: "quote" },
  },

  // Quote enquiry → a general "request a quote" form (dates + party, no specific
  // room). Routes to the draft-quote pipeline when a property resolves.
  quote: {
    type: "contact",
    fields: [
      text("Name", { required: true, width: "half" }),
      field("email", "Email", { required: true, width: "half" }),
      field("phone", "Phone", { width: "half" }),
      field("dates", "Preferred dates", { width: "half" }),
      field("guests", "Guests", { width: "half" }),
      field("textarea", "What are you looking for?", { required: true }),
    ],
    settings: { goal: "quote" },
  },

  // Newsletter → CRM contact + marketing consent, no inbox thread.
  newsletter: {
    type: "newsletter",
    fields: [
      field("email", "Email", { required: true }),
      field("consent", "Consent", {
        optLabel: "Yes, send me occasional news and offers.",
        marketing: true,
      }),
    ],
    settings: { goal: "subscribe", notifyInbox: false },
  },

  // Review request → light feedback form.
  review: {
    type: "contact",
    fields: [
      text("Name", { required: true, width: "half" }),
      field("email", "Email", { width: "half" }),
      field("select", "Rating", {
        required: true,
        options: [
          "5 — Excellent",
          "4 — Good",
          "3 — Okay",
          "2 — Poor",
          "1 — Bad",
        ],
      }),
      field("textarea", "Your review", { required: true }),
    ],
    settings: { goal: "general" },
  },
};

/** A template key whose definition exists. */
export function isFormTemplateKey(key: string | undefined): key is string {
  return Boolean(key && key in FORM_TEMPLATES);
}

/** The 4 forms every new site is seeded with so it works out of the box: a
 *  contact form (→ contact page), a quote enquiry (→ get-a-quote page), a booking
 *  request (→ room template), and a newsletter signup (→ footer). `key` is the
 *  stable slot used for auto-placement; `name` is the host-visible form name. */
export const DEFAULT_FORM_SEEDS = [
  { key: "contact", name: "Contact us", template: "contact" },
  { key: "quote", name: "Get a quote", template: "quote" },
  { key: "booking", name: "Booking request", template: "booking" },
  { key: "subscribe", name: "Newsletter signup", template: "newsletter" },
] as const;

export type DefaultFormKey = (typeof DEFAULT_FORM_SEEDS)[number]["key"];
