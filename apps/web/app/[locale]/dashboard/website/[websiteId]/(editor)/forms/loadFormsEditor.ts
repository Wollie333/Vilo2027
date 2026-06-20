import "server-only";

import { getMyHostId } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";
import {
  formFieldsSchema,
  formSettingsSchema,
  type FormField,
  type FormSettings,
  type FormType,
} from "@/lib/website/forms.schema";

export type FormEditorRow = {
  id: string;
  name: string;
  type: FormType;
  fields: FormField[];
  settings: FormSettings;
  submissionCount: number;
};

export type FormsEditorData = {
  websiteId: string;
  subdomain: string;
  forms: FormEditorRow[];
};

/**
 * Owner-scoped load of the website's forms for the Forms tab (Phase 4). Parses
 * the stored fields/settings jsonb through the SSOT schemas (dropping anything
 * malformed → safe defaults) and counts non-archived submissions per form for a
 * lightweight "N responses" badge. Returns null when the site isn't owned by
 * the signed-in host.
 */
export async function loadFormsEditor(
  websiteId: string,
): Promise<FormsEditorData | null> {
  const supabase = createServerClient();
  const hostId = await getMyHostId(supabase);
  if (!hostId) return null;

  const { data: site } = await supabase
    .from("host_websites")
    .select("id, subdomain")
    .eq("id", websiteId)
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) return null;

  const { data: formRows } = await supabase
    .from("website_forms")
    .select("id, name, type, fields, settings")
    .eq("website_id", websiteId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const forms = formRows ?? [];

  // One grouped count of live submissions across all this site's forms.
  const counts = new Map<string, number>();
  if (forms.length > 0) {
    const { data: subRows } = await supabase
      .from("website_form_submissions")
      .select("form_id")
      .eq("website_id", websiteId)
      .neq("status", "archived");
    for (const row of subRows ?? []) {
      counts.set(row.form_id, (counts.get(row.form_id) ?? 0) + 1);
    }
  }

  const parsed: FormEditorRow[] = forms.map((f) => {
    const fields = formFieldsSchema.safeParse(f.fields);
    const settings = formSettingsSchema.safeParse(f.settings ?? {});
    return {
      id: f.id,
      name: f.name,
      type: f.type as FormType,
      fields: fields.success ? fields.data : [],
      // safeParse of {} fills the defaults, so this branch always succeeds.
      settings: settings.success ? settings.data : formSettingsSchema.parse({}),
      submissionCount: counts.get(f.id) ?? 0,
    };
  });

  return { websiteId, subdomain: site.subdomain, forms: parsed };
}
