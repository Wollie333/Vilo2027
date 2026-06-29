import "server-only";

import { getMyHostId } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";
import {
  formFieldsSchema,
  type FormField,
  type FormType,
} from "@/lib/website/forms.schema";

export type ResponseFormMeta = {
  id: string;
  name: string;
  type: FormType;
  fields: FormField[];
};

export type SubmissionSource = "form" | "dock" | "checkout";

export type FormSubmissionRow = {
  id: string;
  /** Null for on-site bookings (dock/checkout) — they have no source form. */
  formId: string | null;
  data: Record<string, string>;
  status: "new" | "read" | "archived" | "spam";
  conversationId: string | null;
  /** Where the entry came from: a form submission, or an on-site booking. */
  source: SubmissionSource;
  /** The booking this entry created, for dock/checkout sources. */
  bookingId: string | null;
  createdAt: string;
};

export type FormResponsesData = {
  websiteId: string;
  forms: ResponseFormMeta[];
  submissions: FormSubmissionRow[];
};

/**
 * Owner-scoped load of a website's form submissions for the responses view
 * (Phase 4 — slice 4). Returns the form definitions (to label/columnise the
 * data) plus the recent submissions across every form. Returns null when the
 * website isn't owned by the signed-in host.
 */
export async function loadFormResponses(
  websiteId: string,
): Promise<FormResponsesData | null> {
  const supabase = createServerClient();
  const hostId = await getMyHostId(supabase);
  if (!hostId) return null;

  const { data: site } = await supabase
    .from("host_websites")
    .select("id")
    .eq("id", websiteId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) return null;

  const [{ data: formRows }, { data: subRows }] = await Promise.all([
    supabase
      .from("website_forms")
      .select("id, name, type, fields")
      .eq("website_id", websiteId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("website_form_submissions")
      .select(
        "id, form_id, data, status, conversation_id, source, booking_id, created_at",
      )
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const forms: ResponseFormMeta[] = (formRows ?? []).map((f) => {
    const fields = formFieldsSchema.safeParse(f.fields);
    return {
      id: f.id,
      name: f.name,
      type: f.type as FormType,
      fields: fields.success ? fields.data : [],
    };
  });

  const submissions: FormSubmissionRow[] = (subRows ?? []).map((s) => ({
    id: s.id,
    formId: s.form_id,
    data: (s.data ?? {}) as Record<string, string>,
    status: s.status as FormSubmissionRow["status"],
    conversationId: s.conversation_id,
    source: (s.source as SubmissionSource) ?? "form",
    bookingId: s.booking_id,
    createdAt: s.created_at,
  }));

  return { websiteId, forms, submissions };
}
