"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";
import { slugify, uniqueSlug } from "@/lib/help/slug";

const faqSchema = z.array(
  z.object({
    q: z.string().trim().min(2).max(280),
    a: z.string().trim().min(2).max(2000),
  }),
);

const upsertSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  // MVP: accommodation only — experiences/tour guides not built yet.
  kind: z.literal("accommodation"),
  slug: z.string().min(2).max(80).optional(),
  label: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  icon: z.string().min(1).max(60),
  sortOrder: z.number().int().min(0).max(100000),
  isPublished: z.boolean(),
  // SEO + landing
  heroImageUrl: z.string().trim().url().optional().or(z.literal("")).nullable(),
  ogImageUrl: z.string().trim().url().optional().or(z.literal("")).nullable(),
  metaTitle: z.string().trim().max(200).optional().nullable(),
  metaDescription: z.string().trim().max(400).optional().nullable(),
  canonicalUrl: z.string().trim().url().optional().or(z.literal("")).nullable(),
  introMarkdown: z.string().trim().max(20000).optional().nullable(),
  faq: faqSchema.optional(),
  isNew: z.boolean(),
  reason: z.string().optional(),
});

type UpsertArgs = z.infer<typeof upsertSchema>;

const idReasonSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

const PATHS_TO_REVALIDATE = ["/admin/platform/categories", "/explore"];

function revalidateAll() {
  revalidateTag("taxonomy");
  for (const p of PATHS_TO_REVALIDATE) revalidatePath(p);
  revalidatePath("/c/[slug]", "page");
}

async function loadSlugs(
  service: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  excludeId?: string,
): Promise<Set<string>> {
  const { data } = await service
    .from("property_categories")
    .select("id, slug")
    .is("deleted_at", null);
  const set = new Set<string>();
  for (const r of (data ?? []) as { id: string; slug: string }[]) {
    if (excludeId && r.id === excludeId) continue;
    set.add(r.slug);
  }
  return set;
}

function nullify<T extends string | null | undefined>(v: T): string | null {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t.length === 0 ? null : t;
}

export const upsertCategoryAction = withAdminAudit<
  UpsertArgs,
  { ok: true; id: string }
>(
  {
    permissionKey: "taxonomy.manage",
    actionName: "taxonomy.category.upsert",
    targetType: "listing_category",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const slugs = await loadSlugs(service, args.isNew ? undefined : args.id);
    const finalSlug = uniqueSlug(args.slug ?? args.label, slugs);

    const row = {
      parent_id: args.parentId,
      kind: args.kind,
      slug: finalSlug,
      label: args.label.trim(),
      description: nullify(args.description),
      icon: args.icon,
      sort_order: args.sortOrder,
      is_published: args.isPublished,
      hero_image_url: nullify(args.heroImageUrl),
      og_image_url: nullify(args.ogImageUrl),
      meta_title: nullify(args.metaTitle),
      meta_description: nullify(args.metaDescription),
      canonical_url: nullify(args.canonicalUrl),
      intro_markdown: nullify(args.introMarkdown),
      faq: args.faq ?? [],
    };

    if (args.isNew) {
      const { data, error } = await service
        .from("property_categories")
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
      .from("property_categories")
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

export const deleteCategoryAction = withAdminAudit<
  z.infer<typeof idReasonSchema>,
  { ok: true }
>(
  {
    permissionKey: "taxonomy.manage",
    actionName: "taxonomy.category.delete",
    targetType: "listing_category",
    getTargetId: (a) => a.id,
    requireReason: true,
  },
  async (args, service) => {
    const { data, error } = await service
      .from("property_categories")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", args.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidateAll();
    return { result: { ok: true }, after: data };
  },
);

export async function saveCategory(input: {
  id?: string;
  parentId?: string | null;
  kind: "accommodation";
  slug?: string;
  label: string;
  description?: string | null;
  icon: string;
  sortOrder: number;
  isPublished: boolean;
  heroImageUrl?: string | null;
  ogImageUrl?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  introMarkdown?: string | null;
  faq?: Array<{ q: string; a: string }>;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const id =
    input.id ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-000000000000");
  const parsed = upsertSchema.safeParse({
    ...input,
    parentId: input.parentId ?? null,
    id,
    isNew: !input.id,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  try {
    const res = await upsertCategoryAction(parsed.data);
    return res;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

export async function deleteCategory(input: {
  id: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = idReasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Reason is required." };
  try {
    await deleteCategoryAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export async function previewCategorySlug(label: string): Promise<string> {
  return slugify(label);
}
