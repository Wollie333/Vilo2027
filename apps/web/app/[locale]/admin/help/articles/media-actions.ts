"use server";

import { z } from "zod";

import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

// Featured / body images for help articles come from the Wielo System Library —
// the shared, public `marketing-assets` bucket that also backs the admin
// /library page and affiliate marketing assets. Reusing that bucket means a
// help article's featured image is a first-class brand asset, browsable and
// re-usable everywhere. Gated on `help.manage` (help editors don't necessarily
// hold the library page's `subscriptions.edit` grant).
const BUCKET = "marketing-assets";

export type BrandMediaImage = { path: string; url: string };

export async function listBrandMedia(): Promise<
  { ok: true; images: BrandMediaImage[] } | { ok: false; error: string }
> {
  try {
    await requirePermission("help.manage");
    const service = createAdminClient();
    const { data: objects, error } = await service.storage
      .from(BUCKET)
      .list("", {
        limit: 500,
        sortBy: { column: "created_at", order: "desc" },
      });
    if (error) throw new Error(error.message);
    const images: BrandMediaImage[] = (objects ?? [])
      // storage.list can return a folder placeholder row with no id — skip it.
      .filter((o) => o.id && o.name)
      .map((o) => {
        const { data } = service.storage.from(BUCKET).getPublicUrl(o.name);
        return { path: o.name, url: data.publicUrl };
      });
    return { ok: true, images };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

const uploadSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
});

// Browser-direct upload: a signed PUT URL so the file goes straight to Storage
// (avoids the Server Action body cap), plus the eventual public URL. Mirrors
// createLibraryUploadUrlAction on the /library page.
export async function createHelpMediaUploadUrl(input: {
  fileName: string;
}): Promise<
  | { ok: true; path: string; token: string; publicUrl: string }
  | { ok: false; error: string }
> {
  try {
    await requirePermission("help.manage");
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
