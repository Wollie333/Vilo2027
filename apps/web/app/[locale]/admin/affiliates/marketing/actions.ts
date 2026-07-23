"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission, withAdminAudit } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

const MARKETING_TARGET = "00000000-0000-0000-0000-0000000ad5e7";
const BUCKET = "marketing-assets";

// NOT exported: a "use server" module may only export async functions, so a
// runtime const here would break the whole action module. It's used internally
// for the zod enum; the exported MarketingCategory type below is erased at build.
const MARKETING_CATEGORIES = [
  "banner",
  "social",
  "email",
  "prompt",
  "video",
  "blog",
] as const;
export type MarketingCategory = (typeof MARKETING_CATEGORIES)[number];

const upsertSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  category: z.enum(MARKETING_CATEGORIES),
  title: z.string().trim().min(1, "Give it a title.").max(160),
  description: z.string().trim().max(500).optional().nullable(),
  body: z.string().trim().max(8000).optional().nullable(),
  linkUrl: z
    .string()
    .trim()
    .url("Enter a valid URL.")
    .max(2000)
    .optional()
    .or(z.literal("")),
  filePath: z.string().trim().max(500).optional().nullable(),
  fileUrl: z
    .string()
    .trim()
    .url("Enter a valid file URL.")
    .max(2000)
    .optional()
    .or(z.literal("")),
  mimeType: z.string().trim().max(120).optional().nullable(),
  width: z.number().int().min(0).max(20000).optional().nullable(),
  height: z.number().int().min(0).max(20000).optional().nullable(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
  // NULL = default-programme asset; set = belongs to this campaign only. Set at
  // creation and never changed afterwards.
  campaignId: z.string().uuid().optional().nullable(),
  reason: z.string().optional(),
});

export type UpsertMarketingInput = z.infer<typeof upsertSchema>;

const nn = (v: string | null | undefined) => (v && v.length > 0 ? v : null);

export const upsertMarketingAssetAction = withAdminAudit<
  UpsertMarketingInput,
  { ok: true; id: string }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "affiliate.marketing.upsert",
    targetType: "marketing_asset",
    getTargetId: (a) => a.id ?? MARKETING_TARGET,
  },
  async (args, service) => {
    const parsed = upsertSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const d = parsed.data;
    const admin = await requirePermission("subscriptions.edit");

    const row = {
      category: d.category,
      title: d.title,
      description: nn(d.description),
      body: nn(d.body),
      link_url: nn(d.linkUrl),
      file_path: nn(d.filePath),
      file_url: nn(d.fileUrl),
      mime_type: nn(d.mimeType),
      width: d.width ?? null,
      height: d.height ?? null,
      sort_order: d.sortOrder,
      is_active: d.isActive,
      updated_at: new Date().toISOString(),
    };

    let id = d.id ?? "";
    if (d.id) {
      const { error } = await service
        .from("marketing_assets")
        .update(row)
        .eq("id", d.id);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await service
        .from("marketing_assets")
        .insert({
          ...row,
          campaign_id: d.campaignId ?? null,
          created_by: admin.userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = data.id;
    }

    revalidatePath("/admin/affiliates/marketing");
    revalidatePath("/admin/affiliates/campaigns", "layout");
    revalidatePath("/portal/affiliates/marketing");
    return { result: { ok: true, id }, after: { id } };
  },
);

const idSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().optional(),
});

export const deleteMarketingAssetAction = withAdminAudit<
  z.infer<typeof idSchema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "affiliate.marketing.delete",
    targetType: "marketing_asset",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const parsed = idSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    // Best-effort remove the storage object if this asset owned a file.
    const { data: asset } = await service
      .from("marketing_assets")
      .select("file_path")
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (asset?.file_path) {
      await service.storage.from(BUCKET).remove([asset.file_path]);
    }
    const { error } = await service
      .from("marketing_assets")
      .delete()
      .eq("id", parsed.data.id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/affiliates/marketing");
    revalidatePath("/portal/affiliates/marketing");
    return { result: { ok: true }, after: { id: parsed.data.id } };
  },
);

const toggleSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
  reason: z.string().optional(),
});

export const toggleMarketingAssetAction = withAdminAudit<
  z.infer<typeof toggleSchema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "affiliate.marketing.toggle",
    targetType: "marketing_asset",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const parsed = toggleSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    const { error } = await service
      .from("marketing_assets")
      .update({
        is_active: parsed.data.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/affiliates/marketing");
    revalidatePath("/portal/affiliates/marketing");
    return { result: { ok: true }, after: parsed.data };
  },
);

// Browser-direct upload: hand back a signed PUT URL + the eventual public URL
// (the marketing-assets bucket is public-read). Avoids the Vercel Server Action
// body cap — the file goes straight to Storage, then upsert records the path.
const uploadSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentType: z.string().trim().max(120).optional(),
});

export async function createMarketingUploadUrlAction(input: {
  fileName: string;
  contentType?: string;
}): Promise<
  | { ok: true; path: string; token: string; publicUrl: string }
  | { ok: false; error: string }
> {
  try {
    await requirePermission("subscriptions.edit");
    const parsed = uploadSchema.safeParse(input);
    if (!parsed.success) throw new Error("Invalid file.");
    const service = createAdminClient();
    const safe = parsed.data.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const { data, error } = await service.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data)
      throw new Error(error?.message ?? "Upload init failed.");
    const { data: pub } = service.storage.from(BUCKET).getPublicUrl(path);
    return {
      ok: true,
      path,
      token: data.token,
      publicUrl: pub.publicUrl,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

// ── Thin client wrappers ──────────────────────────────────────
type Res = { ok: true; id?: string } | { ok: false; error: string };
async function wrap(fn: () => Promise<unknown>): Promise<Res> {
  try {
    const r = (await fn()) as { id?: string } | undefined;
    return { ok: true, id: r?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function upsertMarketingAsset(input: UpsertMarketingInput) {
  return wrap(() => upsertMarketingAssetAction(input));
}
export async function deleteMarketingAsset(id: string) {
  return wrap(() => deleteMarketingAssetAction({ id }));
}
export async function toggleMarketingAsset(id: string, isActive: boolean) {
  return wrap(() => toggleMarketingAssetAction({ id, isActive }));
}
