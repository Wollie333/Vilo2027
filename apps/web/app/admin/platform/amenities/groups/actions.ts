"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";
import { slugify, uniqueSlug } from "@/lib/help/slug";

const upsertSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(2).max(80).optional(),
  label: z.string().trim().min(2).max(120),
  icon: z.string().min(1).max(60),
  sortOrder: z.number().int().min(0).max(100000),
  isPublished: z.boolean(),
  isNew: z.boolean(),
  reason: z.string().optional(),
});

const idReasonSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

function revalidateAll() {
  revalidateTag("taxonomy");
  revalidatePath("/admin/platform/amenities");
  revalidatePath("/admin/platform/amenities/groups");
}

async function loadSlugs(
  service: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  excludeId?: string,
): Promise<Set<string>> {
  const { data } = await service
    .from("amenity_groups")
    .select("id, slug")
    .is("deleted_at", null);
  const set = new Set<string>();
  for (const r of (data ?? []) as { id: string; slug: string }[]) {
    if (excludeId && r.id === excludeId) continue;
    set.add(r.slug);
  }
  return set;
}

export const upsertAmenityGroupAction = withAdminAudit<
  z.infer<typeof upsertSchema>,
  { ok: true; id: string }
>(
  {
    permissionKey: "taxonomy.manage",
    actionName: "taxonomy.amenity_group.upsert",
    targetType: "amenity_group",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const slugs = await loadSlugs(service, args.isNew ? undefined : args.id);
    const finalSlug = uniqueSlug(args.slug ?? args.label, slugs);

    const row = {
      slug: finalSlug,
      label: args.label.trim(),
      icon: args.icon,
      sort_order: args.sortOrder,
      is_published: args.isPublished,
    };

    if (args.isNew) {
      const { data, error } = await service
        .from("amenity_groups")
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
      .from("amenity_groups")
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

export const deleteAmenityGroupAction = withAdminAudit<
  z.infer<typeof idReasonSchema>,
  { ok: true }
>(
  {
    permissionKey: "taxonomy.manage",
    actionName: "taxonomy.amenity_group.delete",
    targetType: "amenity_group",
    getTargetId: (a) => a.id,
    requireReason: true,
  },
  async (args, service) => {
    const { data, error } = await service
      .from("amenity_groups")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", args.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidateAll();
    return { result: { ok: true }, after: data };
  },
);

export async function saveAmenityGroup(input: {
  id?: string;
  slug?: string;
  label: string;
  icon: string;
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
    const res = await upsertAmenityGroupAction(parsed.data);
    return res;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

export async function deleteAmenityGroup(input: {
  id: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = idReasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Reason is required." };
  try {
    await deleteAmenityGroupAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export async function previewSlug(label: string): Promise<string> {
  return slugify(label);
}
