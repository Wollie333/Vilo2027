"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";
import { slugify, uniqueSlug } from "@/lib/help/slug";

const audienceEnum = z.enum(["host", "guest", "both"]);
const statusEnum = z.enum(["draft", "published", "archived"]);

const createSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(3).max(160),
  slug: z.string().min(2).max(80).optional(),
  excerpt: z.string().max(500).default(""),
  bodyHtml: z.string().default(""),
  bodyJson: z.unknown().default({}),
  categoryId: z.string().uuid().nullable().default(null),
  audience: audienceEnum.default("both"),
  status: statusEnum.default("draft"),
  readTimeMinutes: z.number().int().min(1).max(60).default(4),
  featuredRank: z.number().int().min(1).max(100).nullable().default(null),
  hasVideo: z.boolean().default(false),
  reason: z.string().optional(),
});

const updateSchema = createSchema.extend({ id: z.string().uuid() });

const statusChangeSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

async function loadExistingSlugs(
  service: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  excludeId?: string,
): Promise<Set<string>> {
  const { data } = await service
    .from("help_articles")
    .select("id, slug")
    .is("deleted_at", null);
  const set = new Set<string>();
  for (const row of (data ?? []) as { id: string; slug: string }[]) {
    if (excludeId && row.id === excludeId) continue;
    set.add(row.slug);
  }
  return set;
}

export const createHelpArticleAction = withAdminAudit<
  z.infer<typeof createSchema>,
  { ok: true; id: string; slug: string }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.article.create",
    targetType: "help_article",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const slugs = await loadExistingSlugs(service);
    const finalSlug = uniqueSlug(args.slug ?? args.title, slugs);
    const publishedAt =
      args.status === "published" ? new Date().toISOString() : null;

    const { data, error } = await service
      .from("help_articles")
      .insert({
        id: args.id,
        slug: finalSlug,
        title: args.title.trim(),
        excerpt: args.excerpt,
        body_html: args.bodyHtml,
        body_json: args.bodyJson as never,
        category_id: args.categoryId,
        audience: args.audience,
        status: args.status,
        featured_rank: args.featuredRank,
        read_time_minutes: args.readTimeMinutes,
        has_video: args.hasVideo,
        published_at: publishedAt,
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    const row = data as { id: string; slug: string };
    revalidatePath("/admin/help");
    revalidatePath("/admin/help/articles");
    revalidatePath("/dashboard/help");
    revalidatePath("/help");
    return { result: { ok: true, id: row.id, slug: row.slug }, after: row };
  },
);

export const updateHelpArticleAction = withAdminAudit<
  z.infer<typeof updateSchema>,
  { ok: true; id: string; slug: string }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.article.update",
    targetType: "help_article",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const slugs = await loadExistingSlugs(service, args.id);
    const finalSlug = uniqueSlug(args.slug ?? args.title, slugs);

    const { data: current } = await service
      .from("help_articles")
      .select("status, published_at")
      .eq("id", args.id)
      .maybeSingle();
    const wasPublished =
      (current as { status?: string } | null)?.status === "published";
    const willPublish = args.status === "published";
    const publishedAt = willPublish
      ? ((current as { published_at?: string | null })?.published_at ??
        new Date().toISOString())
      : wasPublished
        ? ((current as { published_at?: string | null })?.published_at ?? null)
        : null;

    const { data, error } = await service
      .from("help_articles")
      .update({
        slug: finalSlug,
        title: args.title.trim(),
        excerpt: args.excerpt,
        body_html: args.bodyHtml,
        body_json: args.bodyJson as never,
        category_id: args.categoryId,
        audience: args.audience,
        status: args.status,
        featured_rank: args.featuredRank,
        read_time_minutes: args.readTimeMinutes,
        has_video: args.hasVideo,
        published_at: publishedAt,
      })
      .eq("id", args.id)
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    const row = data as { id: string; slug: string };
    revalidatePath("/admin/help");
    revalidatePath("/admin/help/articles");
    revalidatePath(`/admin/help/articles/${row.id}`);
    revalidatePath("/dashboard/help");
    revalidatePath(`/dashboard/help/${row.slug}`);
    revalidatePath("/help");
    revalidatePath(`/help/${row.slug}`);
    return { result: { ok: true, id: row.id, slug: row.slug }, after: row };
  },
);

export const archiveHelpArticleAction = withAdminAudit<
  z.infer<typeof statusChangeSchema>,
  { ok: true }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.article.archive",
    targetType: "help_article",
    getTargetId: (a) => a.id,
    requireReason: true,
  },
  async (args, service) => {
    const { data, error } = await service
      .from("help_articles")
      .update({ status: "archived" })
      .eq("id", args.id)
      .select("id, slug, status")
      .single();
    if (error) throw new Error(error.message);
    const row = data as { id: string; slug: string; status: string };
    revalidatePath("/admin/help/articles");
    revalidatePath(`/admin/help/articles/${row.id}`);
    revalidatePath("/dashboard/help");
    revalidatePath(`/dashboard/help/${row.slug}`);
    revalidatePath("/help");
    revalidatePath(`/help/${row.slug}`);
    return { result: { ok: true }, after: row };
  },
);

export const softDeleteHelpArticleAction = withAdminAudit<
  z.infer<typeof statusChangeSchema>,
  { ok: true }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.article.soft_delete",
    targetType: "help_article",
    getTargetId: (a) => a.id,
    requireReason: true,
  },
  async (args, service) => {
    const { data, error } = await service
      .from("help_articles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", args.id)
      .select("id, deleted_at")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/help/articles");
    revalidatePath(`/admin/help/articles/${(data as { id: string }).id}`);
    return { result: { ok: true }, after: data };
  },
);

export const restoreHelpArticleAction = withAdminAudit<
  z.infer<typeof statusChangeSchema>,
  { ok: true }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.article.restore",
    targetType: "help_article",
    getTargetId: (a) => a.id,
    requireReason: true,
  },
  async (args, service) => {
    const { data, error } = await service
      .from("help_articles")
      .update({ deleted_at: null, status: "draft" })
      .eq("id", args.id)
      .select("id, status, deleted_at")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/help/articles");
    revalidatePath(`/admin/help/articles/${(data as { id: string }).id}`);
    return { result: { ok: true }, after: data };
  },
);

// Public thin wrappers ------------------------------------------------------

export async function saveHelpArticle(
  input: unknown & { mode: "create" | "update" },
): Promise<
  { ok: true; id: string; slug: string } | { ok: false; error: string }
> {
  const mode =
    (input as { mode?: string }).mode === "update" ? "update" : "create";
  const parsed =
    mode === "create"
      ? createSchema.safeParse(input)
      : updateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  try {
    const res =
      mode === "create"
        ? await createHelpArticleAction(
            parsed.data as z.infer<typeof createSchema>,
          )
        : await updateHelpArticleAction(
            parsed.data as z.infer<typeof updateSchema>,
          );
    if (res.ok) return res;
    return { ok: false, error: "Save failed." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed.",
    };
  }
}

export async function archiveHelpArticle(input: {
  id: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Reason is required." };
  try {
    await archiveHelpArticleAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export async function softDeleteHelpArticle(input: {
  id: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Reason is required." };
  try {
    await softDeleteHelpArticleAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export async function restoreHelpArticle(input: {
  id: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Reason is required." };
  try {
    await restoreHelpArticleAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export async function previewSlug(title: string): Promise<string> {
  return slugify(title);
}
