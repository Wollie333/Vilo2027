"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";

// A fixed sentinel id for the brand_name platform_setting (audit target_id is a
// uuid column; platform_settings is keyed by text, so we use a stable uuid).
const BRAND_SETTING_ID = "00000000-0000-0000-0000-0000000b5a4d";

const brandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a name.")
    .max(40, "Keep it under 40 characters."),
  reason: z.string().optional(),
});

// Set the app-wide display brand name (platform_settings.brand_name). Admin-only
// via withAdminAudit; the change propagates everywhere the name is read at
// runtime (see lib/brand.ts). Revalidates the whole tree so titles/nav update.
export const setBrandNameAction = withAdminAudit<
  z.infer<typeof brandSchema>,
  { ok: true; name: string }
>(
  {
    permissionKey: "platform.settings",
    actionName: "platform.settings.brand_name",
    targetType: "platform_setting",
    getTargetId: () => BRAND_SETTING_ID,
  },
  async (args, service) => {
    const parsed = brandSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid name.");
    }
    const name = parsed.data.name;

    const { data, error } = await service
      .from("platform_settings")
      .upsert({
        key: "brand_name",
        value: name as never,
        description:
          "Display brand name shown across the app. Placeholder until the real brand is decided.",
        updated_at: new Date().toISOString(),
      })
      .eq("key", "brand_name")
      .select("key, value")
      .single();
    if (error) throw new Error(error.message);

    // Brand name appears everywhere — revalidate the whole app tree.
    revalidatePath("/", "layout");

    return { result: { ok: true, name }, after: data };
  },
);
