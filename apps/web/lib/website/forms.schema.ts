// Shared Zod contract for Website CMS forms (Phase 4 — form builder).
//
// Single source of truth for the form field unit. Imported by the dashboard
// (validate the builder's edits before save) AND the public render + submit
// route (slice 2 — render the fields and validate a submission against them).
// One schema, no divergence — mirrors lib/website/sections.schema.ts.
//
// CURATED, not free-form: the host picks from a fixed catalogue of field types
// and only edits label / placeholder / required / (select) options. The dev
// owns the layout and styling; the host never authors raw markup.
import { z } from "zod";

// ── Field type catalogue ──────────────────────────────────────
export const FORM_FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "phone",
  "select",
  "checkbox",
  "date",
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** Form purpose — drives routing (slice 2/3). */
export const FORM_TYPES = ["contact", "custom", "newsletter"] as const;
export type FormType = (typeof FORM_TYPES)[number];

// A single curated field. `id` is a stable key (uuid) used as the submission
// data key ({ [field.id]: value }); never reused once data exists.
export const formFieldSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(FORM_FIELD_TYPES),
  label: z.string().trim().min(1, "Give the field a label.").max(120),
  placeholder: z.string().max(160).optional(),
  required: z.boolean().default(false),
  // Choices for `select` only; ignored (and trimmed away) for other types.
  options: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
});
export type FormField = z.infer<typeof formFieldSchema>;

export const formFieldsSchema = z.array(formFieldSchema).max(30);

// Form-level settings (stored in website_forms.settings jsonb).
export const formSettingsSchema = z.object({
  submitLabel: z.string().trim().max(60).default("Send"),
  successMessage: z
    .string()
    .trim()
    .max(300)
    .default("Thanks — your message is on its way. We'll be in touch soon."),
  // Email-bearing forms open a "Website Enquiry" in the inbox (slice 2). Newsletter
  // forms ignore this (they upsert a CRM contact instead — slice 3).
  notifyInbox: z.boolean().default(true),
});
export type FormSettings = z.infer<typeof formSettingsSchema>;

/** Field types whose value is an email address (used for inbox routing in slice 2). */
export const EMAIL_FIELD_TYPE: FormFieldType = "email";
