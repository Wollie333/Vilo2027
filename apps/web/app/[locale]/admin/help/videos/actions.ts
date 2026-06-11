"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";
import { parseVideoEmbed } from "@/lib/help/embed";

const upsertSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(3).max(160),
  description: z.string().max(500).default(""),
  categoryId: z.string().uuid().nullable().default(null),
  audience: z.enum(["host", "guest", "both"]),
  embedUrl: z.string().url(),
  thumbnailUrl: z.string().url().or(z.literal("")).optional(),
  durationSeconds: z.number().int().min(0).max(36000),
  status: z.enum(["draft", "published", "archived"]),
  featuredRank: z.number().int().min(1).max(100).nullable().default(null),
  sortOrder: z.number().int().min(0).max(10000),
  isNew: z.boolean().default(false),
  isCreate: z.boolean(),
  reason: z.string().optional(),
});

const idReasonSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export const upsertHelpVideoAction = withAdminAudit<
  z.infer<typeof upsertSchema>,
  { ok: true; id: string }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.video.upsert",
    targetType: "help_video",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const parsed = parseVideoEmbed(args.embedUrl);
    if (!parsed) throw new Error("Couldn't parse YouTube or Vimeo URL.");

    const payload = {
      title: args.title.trim(),
      description: args.description,
      category_id: args.categoryId,
      audience: args.audience,
      embed_provider: parsed.provider,
      embed_id: parsed.id,
      embed_url: parsed.url,
      thumbnail_url: args.thumbnailUrl?.trim() || null,
      duration_seconds: args.durationSeconds,
      status: args.status,
      featured_rank: args.featuredRank,
      sort_order: args.sortOrder,
      is_new: args.isNew,
    };

    if (args.isCreate) {
      const { data, error } = await service
        .from("help_videos")
        .insert({ id: args.id, ...payload })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      revalidatePath("/admin/help/videos");
      revalidatePath("/dashboard/help");
      revalidatePath("/help");
      return {
        result: { ok: true, id: (data as { id: string }).id },
        after: data,
      };
    }

    const { data, error } = await service
      .from("help_videos")
      .update(payload)
      .eq("id", args.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/help/videos");
    revalidatePath(`/admin/help/videos/${args.id}`);
    revalidatePath("/dashboard/help");
    revalidatePath("/help");
    return {
      result: { ok: true, id: (data as { id: string }).id },
      after: data,
    };
  },
);

export const deleteHelpVideoAction = withAdminAudit<
  z.infer<typeof idReasonSchema>,
  { ok: true }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.video.delete",
    targetType: "help_video",
    getTargetId: (a) => a.id,
    requireReason: true,
  },
  async (args, service) => {
    const { data, error } = await service
      .from("help_videos")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", args.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/help/videos");
    revalidatePath("/dashboard/help");
    revalidatePath("/help");
    return { result: { ok: true }, after: data };
  },
);

export async function saveHelpVideo(input: {
  id?: string;
  title: string;
  description?: string;
  categoryId: string | null;
  audience: "host" | "guest" | "both";
  embedUrl: string;
  thumbnailUrl?: string;
  durationSeconds: number;
  status: "draft" | "published" | "archived";
  featuredRank: number | null;
  sortOrder: number;
  isNew: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const id =
    input.id ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-000000000000");
  const parsed = upsertSchema.safeParse({ ...input, id, isCreate: !input.id });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  try {
    const res = await upsertHelpVideoAction(parsed.data);
    if (res.ok) return res;
    return { ok: false, error: "Save failed." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

export async function deleteHelpVideo(input: {
  id: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = idReasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Reason is required." };
  try {
    await deleteHelpVideoAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}
