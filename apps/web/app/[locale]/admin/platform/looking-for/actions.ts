"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { uniqueSlug } from "@/lib/help/slug";
import { REQUIREMENTS_TAG } from "@/lib/looking-for/requirements";

type Service = ReturnType<typeof createAdminClient>;

function revalidateAll() {
  revalidateTag(REQUIREMENTS_TAG);
  revalidatePath("/admin/platform/looking-for");
}

async function loadSlugs(
  service: Service,
  table: "looking_for_requirement_groups" | "looking_for_requirement_options",
  excludeId?: string,
): Promise<Set<string>> {
  const { data } = await service
    .from(table)
    .select("id, slug")
    .is("deleted_at", null);
  const set = new Set<string>();
  for (const r of (data ?? []) as { id: string; slug: string }[]) {
    if (excludeId && r.id === excludeId) continue;
    set.add(r.slug);
  }
  return set;
}

const idReasonSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

function newId(id?: string): string {
  return (
    id ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-000000000000")
  );
}

// ─── GROUPS ────────────────────────────────────────────────────────────────
const groupSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(2).max(80).optional(),
  label: z.string().trim().min(2).max(120),
  icon: z.string().min(1).max(60),
  selectMode: z.enum(["single", "multi"]),
  sortOrder: z.number().int().min(0).max(100000),
  isPublished: z.boolean(),
  isNew: z.boolean(),
  reason: z.string().optional(),
});

const upsertGroupAction = withAdminAudit<
  z.infer<typeof groupSchema>,
  { ok: true; id: string }
>(
  {
    permissionKey: "taxonomy.manage",
    actionName: "looking_for.requirement_group.upsert",
    targetType: "looking_for_requirement_group",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const slugs = await loadSlugs(
      service,
      "looking_for_requirement_groups",
      args.isNew ? undefined : args.id,
    );
    const row = {
      slug: uniqueSlug(args.slug ?? args.label, slugs),
      label: args.label.trim(),
      icon: args.icon,
      select_mode: args.selectMode,
      sort_order: args.sortOrder,
      is_published: args.isPublished,
    };
    const q = args.isNew
      ? service
          .from("looking_for_requirement_groups")
          .insert({ id: args.id, ...row })
      : service
          .from("looking_for_requirement_groups")
          .update(row)
          .eq("id", args.id);
    const { data, error } = await q.select("*").single();
    if (error) throw new Error(error.message);
    revalidateAll();
    return {
      result: { ok: true, id: (data as { id: string }).id },
      after: data,
    };
  },
);

const deleteGroupAction = withAdminAudit<
  z.infer<typeof idReasonSchema>,
  { ok: true }
>(
  {
    permissionKey: "taxonomy.manage",
    actionName: "looking_for.requirement_group.delete",
    targetType: "looking_for_requirement_group",
    getTargetId: (a) => a.id,
    requireReason: true,
  },
  async (args, service) => {
    // Soft-delete the group and its options together.
    await service
      .from("looking_for_requirement_options")
      .update({ deleted_at: new Date().toISOString() })
      .eq("group_id", args.id);
    const { data, error } = await service
      .from("looking_for_requirement_groups")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", args.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidateAll();
    return { result: { ok: true }, after: data };
  },
);

export async function saveRequirementGroup(input: {
  id?: string;
  label: string;
  icon: string;
  selectMode: "single" | "multi";
  sortOrder: number;
  isPublished: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = groupSchema.safeParse({
    ...input,
    id: newId(input.id),
    isNew: !input.id,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  try {
    return await upsertGroupAction(parsed.data);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

export async function deleteRequirementGroup(input: {
  id: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = idReasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Reason is required." };
  try {
    await deleteGroupAction(parsed.data);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

// ─── OPTIONS ─────────────────────────────────────────────────────────────────
const optionSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  slug: z.string().min(2).max(80).optional(),
  label: z.string().trim().min(1).max(120),
  icon: z.string().min(1).max(60),
  sortOrder: z.number().int().min(0).max(100000),
  isPublished: z.boolean(),
  isNew: z.boolean(),
  reason: z.string().optional(),
});

const upsertOptionAction = withAdminAudit<
  z.infer<typeof optionSchema>,
  { ok: true; id: string }
>(
  {
    permissionKey: "taxonomy.manage",
    actionName: "looking_for.requirement_option.upsert",
    targetType: "looking_for_requirement_option",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const slugs = await loadSlugs(
      service,
      "looking_for_requirement_options",
      args.isNew ? undefined : args.id,
    );
    const row = {
      group_id: args.groupId,
      slug: uniqueSlug(args.slug ?? args.label, slugs),
      label: args.label.trim(),
      icon: args.icon,
      sort_order: args.sortOrder,
      is_published: args.isPublished,
    };
    const q = args.isNew
      ? service
          .from("looking_for_requirement_options")
          .insert({ id: args.id, ...row })
      : service
          .from("looking_for_requirement_options")
          .update(row)
          .eq("id", args.id);
    const { data, error } = await q.select("*").single();
    if (error) throw new Error(error.message);
    revalidateAll();
    return {
      result: { ok: true, id: (data as { id: string }).id },
      after: data,
    };
  },
);

const deleteOptionAction = withAdminAudit<
  z.infer<typeof idReasonSchema>,
  { ok: true }
>(
  {
    permissionKey: "taxonomy.manage",
    actionName: "looking_for.requirement_option.delete",
    targetType: "looking_for_requirement_option",
    getTargetId: (a) => a.id,
    requireReason: true,
  },
  async (args, service) => {
    const { data, error } = await service
      .from("looking_for_requirement_options")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", args.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidateAll();
    return { result: { ok: true }, after: data };
  },
);

export async function saveRequirementOption(input: {
  id?: string;
  groupId: string;
  label: string;
  icon: string;
  sortOrder: number;
  isPublished: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = optionSchema.safeParse({
    ...input,
    id: newId(input.id),
    isNew: !input.id,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  try {
    return await upsertOptionAction(parsed.data);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

export async function deleteRequirementOption(input: {
  id: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = idReasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Reason is required." };
  try {
    await deleteOptionAction(parsed.data);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
