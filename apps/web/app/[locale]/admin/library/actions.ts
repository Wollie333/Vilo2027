"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission, withAdminAudit } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

// The Wielo System Library — app-scoped images for the business side of Wielo
// (affiliate resources, promo art, anything the platform itself needs). It lives
// in the SAME public `marketing-assets` bucket the affiliate marketing manager
// uses, so a file uploaded here can back a marketing asset and vice-versa. This
// is NOT a host's media library — those are host-scoped (dashboard/media).
const BUCKET = "marketing-assets";

// Synthetic audit target — the library manages bucket objects, which have no
// single row id (mirrors PRODUCT_TARGET / PROMO_TARGET).
const LIBRARY_TARGET = "00000000-0000-0000-0000-00000005a1e5";

// Browser-direct upload: a signed PUT URL so the file goes straight to Storage
// (avoids the Server Action body cap), plus the eventual public URL.
const uploadSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
});

export async function createLibraryUploadUrlAction(input: {
  fileName: string;
}): Promise<
  | { ok: true; path: string; token: string; publicUrl: string }
  | { ok: false; error: string }
> {
  try {
    await requirePermission("subscriptions.edit");
    const parsed = uploadSchema.safeParse(input);
    if (!parsed.success) throw new Error("Invalid file name.");
    const service = createAdminClient();
    const safe = parsed.data.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const { data, error } = await service.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data)
      throw new Error(error?.message ?? "Upload init failed.");
    const { data: pub } = service.storage.from(BUCKET).getPublicUrl(path);
    return { ok: true, path, token: data.token, publicUrl: pub.publicUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

const deleteSchema = z.object({
  path: z.string().trim().min(1).max(400),
  reason: z.string().optional(),
});

export const deleteLibraryImageAction = withAdminAudit<
  z.infer<typeof deleteSchema>,
  { ok: true }
>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "system_library.delete",
    targetType: "marketing_asset",
    getTargetId: () => LIBRARY_TARGET,
  },
  async (args, service) => {
    const { path } = deleteSchema.parse(args);
    // Refuse to delete a file that an affiliate marketing asset still points at —
    // that would leave the asset with a broken image and no warning. The admin
    // should remove the marketing asset first.
    const { count } = await service
      .from("marketing_assets")
      .select("id", { count: "exact", head: true })
      .eq("file_path", path);
    if ((count ?? 0) > 0) {
      throw new Error(
        "This image is used by an affiliate marketing asset — remove that first.",
      );
    }
    const { error } = await service.storage.from(BUCKET).remove([path]);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/library");
    return { result: { ok: true }, after: { path, deleted: true } };
  },
);

// Thin client wrapper (a client component can't call the audited const).
export async function deleteLibraryImage(input: {
  path: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await deleteLibraryImageAction({ path: input.path });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
