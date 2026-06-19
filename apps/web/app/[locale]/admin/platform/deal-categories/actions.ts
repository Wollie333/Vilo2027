"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";
import { slugify, uniqueSlug } from "@/lib/help/slug";

const upsertSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(2).max(80).optional(),
  label: z.string().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().min(1).max(40).optional().nullable(),
  sortOrder: z.number().int().min(0).max(10000),
  isActive: z.boolean(),
  // SEO fields (optional)
  metaTitle: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(400).optional().nullable(),
  ogImageUrl: z.string().url().optional().or(z.literal("")).nullable(),
  introMarkdown: z.string().max(10000).optional().nullable(),
  isNew: z.boolean(),
  reason: z.string().optional(),
});

const idReasonSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

const PATHS_TO_REVALIDATE = [
  "/admin/platform/deal-categories",
  "/deals",
  "/dashboard/specials",
];

function revalidateAll() {
  revalidateTag("special-categories");
  for (const p of PATHS_TO_REVALIDATE) revalidatePath(p);
}

async function loadKeys(
  service: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  excludeId?: string,
): Promise<Set<string>> {
  const { data } = await service
    .from("special_categories")
    .select("id, key")
    .is("deleted_at", null);
  const set = new Set<string>();
  for (const r of (data ?? []) as { id: string; key: string }[]) {
    if (excludeId && r.id === excludeId) continue;
    set.add(r.key);
  }
  return set;
}

function nullify<T extends string | null | undefined>(v: T): string | null {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t.length === 0 ? null : t;
}

export const upsertDealCategoryAction = withAdminAudit<
  z.infer<typeof upsertSchema>,
  { ok: true; id: string }
>(
  {
    permissionKey: "taxonomy.manage",
    actionName: "taxonomy.deal_category.upsert",
    targetType: "special_category",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const keys = await loadKeys(service, args.isNew ? undefined : args.id);
    const finalKey = uniqueSlug(args.key ?? args.label, keys);

    const row = {
      key: finalKey,
      label: args.label.trim(),
      description: nullify(args.description),
      icon: nullify(args.icon),
      sort_order: args.sortOrder,
      is_active: args.isActive,
      meta_title: nullify(args.metaTitle),
      meta_description: nullify(args.metaDescription),
      og_image_url: nullify(args.ogImageUrl),
      intro_markdown: nullify(args.introMarkdown),
    };

    if (args.isNew) {
      const { data, error } = await service
        .from("special_categories")
        .insert({ id: args.id, ...row })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      revalidateAll();
      return {
        result: { ok: true, id: (data as { id: string }).id },
        after: data,
      };
    }

    const { data, error } = await service
      .from("special_categories")
      .update(row)
      .eq("id", args.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    revalidateAll();
    return {
      result: { ok: true, id: (data as { id: string }).id },
      after: data,
    };
  },
);

export const deleteDealCategoryAction = withAdminAudit<
  z.infer<typeof idReasonSchema>,
  { ok: true }
>(
  {
    permissionKey: "taxonomy.manage",
    actionName: "taxonomy.deal_category.delete",
    targetType: "special_category",
    getTargetId: (a) => a.id,
    requireReason: true,
  },
  async (args, service) => {
    const { data, error } = await service
      .from("special_categories")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", args.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidateAll();
    return { result: { ok: true }, after: data };
  },
);

export async function saveDealCategory(input: {
  id?: string;
  key?: string;
  label: string;
  description?: string | null;
  icon?: string | null;
  sortOrder: number;
  isActive: boolean;
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImageUrl?: string | null;
  introMarkdown?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const id =
    input.id ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-000000000000");
  const parsed = upsertSchema.safeParse({ ...input, id, isNew: !input.id });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  try {
    const res = await upsertDealCategoryAction(parsed.data);
    return res;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

export async function deleteDealCategory(input: {
  id: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = idReasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Reason is required." };
  try {
    await deleteDealCategoryAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export async function previewDealCategoryKey(label: string): Promise<string> {
  return slugify(label);
}
