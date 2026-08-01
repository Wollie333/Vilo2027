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
  seoTitle: z.string().max(70).default(""),
  metaDescription: z.string().max(200).default(""),
  ogImageUrl: z.string().url().max(2048).or(z.literal("")).default(""),
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
        seo_title: args.seoTitle || null,
        meta_description: args.metaDescription || null,
        og_image_url: args.ogImageUrl || null,
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
        seo_title: args.seoTitle || null,
        meta_description: args.metaDescription || null,
        og_image_url: args.ogImageUrl || null,
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

// Bulk operations ----------------------------------------------------------
// One audited row per bulk call (the full id list + count live in payload.args);
// target_id is the first id as a representative. Each updates all rows in a
// single `.in("id", ids)` statement.

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  reason: z.string().optional(),
});
const bulkReasonSchema = bulkSchema.extend({
  reason: z.string().min(5).max(500),
});
const bulkMoveSchema = bulkSchema.extend({
  categoryId: z.string().uuid().nullable(),
});

function revalidateHelp() {
  revalidatePath("/admin/help");
  revalidatePath("/admin/help/articles");
  revalidatePath("/dashboard/help");
  revalidatePath("/help");
  revalidatePath("/help/articles");
}

export const bulkPublishArticlesAction = withAdminAudit<
  z.infer<typeof bulkSchema>,
  { ok: true; count: number }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.article.bulk_publish",
    targetType: "help_article",
    getTargetId: (a) => a.ids[0],
  },
  async (args, service) => {
    const nowIso = new Date().toISOString();
    const { error } = await service
      .from("help_articles")
      .update({ status: "published" })
      .in("id", args.ids);
    if (error) throw new Error(error.message);
    // Stamp published_at only where it was never set, so re-publishing keeps the
    // original go-live date.
    await service
      .from("help_articles")
      .update({ published_at: nowIso })
      .in("id", args.ids)
      .is("published_at", null);
    revalidateHelp();
    return {
      result: { ok: true, count: args.ids.length },
      after: { ids: args.ids, status: "published" },
    };
  },
);

export const bulkArchiveArticlesAction = withAdminAudit<
  z.infer<typeof bulkReasonSchema>,
  { ok: true; count: number }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.article.bulk_archive",
    targetType: "help_article",
    getTargetId: (a) => a.ids[0],
    requireReason: true,
  },
  async (args, service) => {
    const { error } = await service
      .from("help_articles")
      .update({ status: "archived" })
      .in("id", args.ids);
    if (error) throw new Error(error.message);
    revalidateHelp();
    return {
      result: { ok: true, count: args.ids.length },
      after: { ids: args.ids, status: "archived" },
    };
  },
);

export const bulkSoftDeleteArticlesAction = withAdminAudit<
  z.infer<typeof bulkReasonSchema>,
  { ok: true; count: number }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.article.bulk_soft_delete",
    targetType: "help_article",
    getTargetId: (a) => a.ids[0],
    requireReason: true,
  },
  async (args, service) => {
    const { error } = await service
      .from("help_articles")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", args.ids)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
    revalidateHelp();
    return {
      result: { ok: true, count: args.ids.length },
      after: { ids: args.ids, deleted: true },
    };
  },
);

export const bulkRestoreArticlesAction = withAdminAudit<
  z.infer<typeof bulkReasonSchema>,
  { ok: true; count: number }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.article.bulk_restore",
    targetType: "help_article",
    getTargetId: (a) => a.ids[0],
    requireReason: true,
  },
  async (args, service) => {
    const { error } = await service
      .from("help_articles")
      .update({ deleted_at: null, status: "draft" })
      .in("id", args.ids);
    if (error) throw new Error(error.message);
    revalidateHelp();
    return {
      result: { ok: true, count: args.ids.length },
      after: { ids: args.ids, restored: true },
    };
  },
);

export const bulkMoveArticlesAction = withAdminAudit<
  z.infer<typeof bulkMoveSchema>,
  { ok: true; count: number }
>(
  {
    permissionKey: "help.manage",
    actionName: "help.article.bulk_move_category",
    targetType: "help_article",
    getTargetId: (a) => a.ids[0],
  },
  async (args, service) => {
    const { error } = await service
      .from("help_articles")
      .update({ category_id: args.categoryId })
      .in("id", args.ids);
    if (error) throw new Error(error.message);
    revalidateHelp();
    return {
      result: { ok: true, count: args.ids.length },
      after: { ids: args.ids, category_id: args.categoryId },
    };
  },
);

type BulkResult = { ok: true; count: number } | { ok: false; error: string };

async function runBulk<T extends { ids: string[] }>(
  action: (a: T) => Promise<{ ok: true; count: number }>,
  parsed: { success: true; data: T } | { success: false },
  invalidMsg: string,
): Promise<BulkResult> {
  if (!parsed.success) return { ok: false, error: invalidMsg };
  try {
    return await action(parsed.data);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function bulkPublishArticles(ids: string[]): Promise<BulkResult> {
  return runBulk(
    bulkPublishArticlesAction,
    bulkSchema.safeParse({ ids }),
    "Select at least one article.",
  );
}

export async function bulkArchiveArticles(
  ids: string[],
  reason: string,
): Promise<BulkResult> {
  return runBulk(
    bulkArchiveArticlesAction,
    bulkReasonSchema.safeParse({ ids, reason }),
    "A reason (5+ chars) is required.",
  );
}

export async function bulkSoftDeleteArticles(
  ids: string[],
  reason: string,
): Promise<BulkResult> {
  return runBulk(
    bulkSoftDeleteArticlesAction,
    bulkReasonSchema.safeParse({ ids, reason }),
    "A reason (5+ chars) is required.",
  );
}

export async function bulkRestoreArticles(
  ids: string[],
  reason: string,
): Promise<BulkResult> {
  return runBulk(
    bulkRestoreArticlesAction,
    bulkReasonSchema.safeParse({ ids, reason }),
    "A reason (5+ chars) is required.",
  );
}

export async function bulkMoveArticles(
  ids: string[],
  categoryId: string | null,
): Promise<BulkResult> {
  return runBulk(
    bulkMoveArticlesAction,
    bulkMoveSchema.safeParse({ ids, categoryId }),
    "Select at least one article.",
  );
}
