import { z } from "zod";

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
  | { ok: true; data: { conversationId?: string } }
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

export async function submitWebsiteForm(
  input: unknown,
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

  // Best-guess sender name/phone from the submitted fields (shared by both the
  // inbox and newsletter routes below).
  const nameField = fields.data.find(
    (f) => f.type === "text" && validated.clean[f.id],
  );
  const phoneField = fields.data.find((f) => f.type === "phone");
  const phone = phoneField ? validated.clean[phoneField.id] : undefined;

  // NEWSLETTER — add the email to the host's CRM contacts (tag `newsletter` +
  // marketing consent), no inbox conversation. Respects a blocked contact.
  if (formType === "newsletter" && email) {
    const { data: site } = await admin
      .from("host_websites")
      .select("host_id")
      .eq("id", d.website_id)
      .maybeSingle();
    if (site?.host_id) {
      const { data: existing } = await admin
        .from("host_contacts")
        .select("blocked")
        .eq("host_id", site.host_id)
        .ilike("email", email)
        .maybeSingle();
      if (!existing?.blocked) {
        await upsertHostContact(admin, {
          hostId: site.host_id,
          email,
          name: nameField ? validated.clean[nameField.id] : null,
          phone: phone ?? null,
          emailConsent: true,
          addTags: ["newsletter"],
        });
      }
    }
    return { ok: true, data: {} };
  }

  const wantsInbox =
    formType !== "newsletter" && settings.notifyInbox && Boolean(email);

  let conversationId: string | undefined;
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
