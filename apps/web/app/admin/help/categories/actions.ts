"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";
import { slugify, uniqueSlug } from "@/lib/help/slug";

const upsertSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(2).max(80).optional(),
  name: z.string().min(2).max(120),
  description: z.string().max(280).optional(),
  icon: z.string().min(1).max(40),
  audience: z.enum(["host", "guest", "both"]),
  sortOrder: z.number().int().min(0).max(10000),
  isPublished: z.boolean(),
  isNew: z.boolean(),
  reason: z.string().optional(),
});

const idReasonSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

async function loadSlugs(
  service: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  excludeId?: string,
): Promise<Set<string>> {
  const { data } = await service
    .from("help_categories")
    .select("id, slug")
    .is("deleted_at", null);
  const set = new Set<string>();
  for (const r of (data ?? []) as { id: string; slug: string }[]) {
    if (excludeId && r.id === excludeId) continue;
    set.add(r.slug);
  }
  return set;
}

export const upsertHelpCategoryAction = withAdminAudit<
  z.infer<typeof upsertSchema>,
  { ok: true; id: string }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.category.upsert",
    targetType: "help_category",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const slugs = await loadSlugs(service, args.isNew ? undefined : args.id);
    const finalSlug = uniqueSlug(args.slug ?? args.name, slugs);

    if (args.isNew) {
      const { data, error } = await service
        .from("help_categories")
        .insert({
          id: args.id,
          slug: finalSlug,
          name: args.name.trim(),
          description: args.description ?? null,
          icon: args.icon,
          audience: args.audience,
          sort_order: args.sortOrder,
          is_published: args.isPublished,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      revalidatePath("/admin/help/categories");
      revalidatePath("/dashboard/help");
      revalidatePath("/help");
      return {
        result: { ok: true, id: (data as { id: string }).id },
        after: data,
      };
    }

    const { data, error } = await service
      .from("help_categories")
      .update({
        slug: finalSlug,
        name: args.name.trim(),
        description: args.description ?? null,
        icon: args.icon,
        audience: args.audience,
        sort_order: args.sortOrder,
        is_published: args.isPublished,
      })
      .eq("id", args.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/help/categories");
    revalidatePath("/dashboard/help");
    revalidatePath("/help");
    return {
      result: { ok: true, id: (data as { id: string }).id },
      after: data,
    };
  },
);

export const deleteHelpCategoryAction = withAdminAudit<
  z.infer<typeof idReasonSchema>,
  { ok: true }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.category.delete",
    targetType: "help_category",
    getTargetId: (a) => a.id,
    requireReason: true,
  },
  async (args, service) => {
    const { data, error } = await service
      .from("help_categories")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", args.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/help/categories");
    revalidatePath("/dashboard/help");
    revalidatePath("/help");
    return { result: { ok: true }, after: data };
  },
);

export async function saveHelpCategory(input: {
  id?: string;
  slug?: string;
  name: string;
  description?: string;
  icon: string;
  audience: "host" | "guest" | "both";
  sortOrder: number;
  isPublished: boolean;
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
    const res = await upsertHelpCategoryAction(parsed.data);
    if (res.ok) return res;
    return { ok: false, error: "Save failed." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

export async function deleteHelpCategory(input: {
  id: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = idReasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Reason is required." };
  try {
    await deleteHelpCategoryAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export async function previewCategorySlug(name: string): Promise<string> {
  return slugify(name);
}
