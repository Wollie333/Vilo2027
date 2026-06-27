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
  // Derived tracking (no per-form status column — see below).
  status: "live" | "draft";
  embedLabels: string[];
  submissionsThisMonth: number;
  lastSubmissionAt: string | null;
};

export type FormsEditorData = {
  websiteId: string;
  subdomain: string;
  forms: FormEditorRow[];
};

/**
 * The website's visible rooms as display names, in builder order — what a
 * `rooms` form field auto-populates with. Owner-scoped is enforced by the
 * caller (the form editor already verified ownership). Mirrors the public
 * render's orderedVisibleRooms (display_name override → room name), but always
 * LIVE (the editor has no published snapshot). Returns [] when there are none.
 */
export async function loadWebsiteRoomNames(
  websiteId: string,
): Promise<string[]> {
  const supabase = createServerClient();
  const { data: wr } = await supabase
    .from("website_rooms")
    .select("room_id, display_name, sort_order")
    .eq("website_id", websiteId)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });
  const rows = wr ?? [];
  const ids = rows.map((r) => r.room_id).filter(Boolean);
  if (ids.length === 0) return [];
  const { data: pr } = await supabase
    .from("property_rooms")
    .select("id, name, is_active, deleted_at")
    .in("id", ids);
  const byId = new Map(
    (pr ?? []).map((r) => [
      (r as { id: string }).id,
      r as {
        name: string;
        is_active: boolean | null;
        deleted_at: string | null;
      },
    ]),
  );
  return rows
    .map((r) => {
      const room = byId.get(r.room_id);
      if (!room || room.is_active === false || room.deleted_at) return null;
      return (r.display_name?.trim() || room.name) as string;
    })
    .filter((n): n is string => Boolean(n));
}

/** True when a sections jsonb array embeds `formId` via a `form` section. */
function sectionsEmbed(sections: unknown, formId: string): boolean {
  if (!Array.isArray(sections)) return false;
  return sections.some((s) => {
    if (!s || typeof s !== "object") return false;
    const sec = s as { type?: unknown; props?: { form_id?: unknown } };
    return sec.type === "form" && sec.props?.form_id === formId;
  });
}

/**
 * Owner-scoped load of the website's forms for the Forms manager. Parses the
 * stored fields/settings jsonb through the SSOT schemas (dropping anything
 * malformed → safe defaults) and derives real tracking per form:
 *  - status: "live" when the form is embedded in at least one PUBLISHED page,
 *    else "draft" (we deliberately derive this rather than add a status column).
 *  - embedLabels: the page titles the form is embedded on (draft or published).
 *  - submissionCount / submissionsThisMonth / lastSubmissionAt from real rows.
 * Returns null when the site isn't owned by the signed-in host.
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

  const [{ data: formRows }, { data: pageRows }] = await Promise.all([
    supabase
      .from("website_forms")
      .select("id, name, type, fields, settings")
      .eq("website_id", websiteId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("website_pages")
      .select("kind, slug, title, draft_sections, published_sections")
      .eq("website_id", websiteId),
  ]);

  const forms = formRows ?? [];
  const pages = pageRows ?? [];

  // Submissions: total + this-month + last, per form, from real rows.
  const total = new Map<string, number>();
  const month = new Map<string, number>();
  const last = new Map<string, string>();
  if (forms.length > 0) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { data: subRows } = await supabase
      .from("website_form_submissions")
      .select("form_id, created_at")
      .eq("website_id", websiteId)
      .neq("status", "archived");
    for (const row of subRows ?? []) {
      total.set(row.form_id, (total.get(row.form_id) ?? 0) + 1);
      if (new Date(row.created_at) >= monthStart) {
        month.set(row.form_id, (month.get(row.form_id) ?? 0) + 1);
      }
      const prev = last.get(row.form_id);
      if (!prev || row.created_at > prev) last.set(row.form_id, row.created_at);
    }
  }

  function pageLabel(p: { kind: string; slug: string; title: string | null }) {
    if (p.kind === "home") return "Home";
    return p.title?.trim() || p.slug;
  }

  const parsed: FormEditorRow[] = forms.map((f) => {
    const fields = formFieldsSchema.safeParse(f.fields);
    const settings = formSettingsSchema.safeParse(f.settings ?? {});

    const publishedOn = pages.filter((p) =>
      sectionsEmbed(p.published_sections, f.id),
    );
    const draftOn = pages.filter((p) => sectionsEmbed(p.draft_sections, f.id));
    const embedPages = draftOn.length > 0 ? draftOn : publishedOn;

    return {
      id: f.id,
      name: f.name,
      type: f.type as FormType,
      fields: fields.success ? fields.data : [],
      settings: settings.success ? settings.data : formSettingsSchema.parse({}),
      submissionCount: total.get(f.id) ?? 0,
      status: publishedOn.length > 0 ? "live" : "draft",
      embedLabels: embedPages.map(pageLabel),
      submissionsThisMonth: month.get(f.id) ?? 0,
      lastSubmissionAt: last.get(f.id) ?? null,
    };
  });

  return { websiteId, subdomain: site.subdomain, forms: parsed };
}
