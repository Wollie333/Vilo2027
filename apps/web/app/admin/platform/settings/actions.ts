"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";

// Fixed sentinel id for the branding platform_settings (audit target_id is a
// uuid column; platform_settings is keyed by text, so we use a stable uuid).
const BRANDING_SETTING_ID = "00000000-0000-0000-0000-0000000b5a4d";

const brandingSchema = z.object({
  brandName: z
    .string()
    .trim()
    .min(1, "Enter a brand name.")
    .max(40, "Keep the brand name under 40 characters."),
  companyName: z
    .string()
    .trim()
    .min(1, "Enter the company name.")
    .max(120, "Keep the company name under 120 characters."),
  companyLocation: z
    .string()
    .trim()
    .max(120, "Keep the location under 120 characters."),
  reason: z.string().optional(),
});

// Set the app-wide brand + legal company identity (platform_settings). Admin-only
// via withAdminAudit; changes propagate everywhere these are read at runtime
// (see lib/brand.ts). Revalidates the whole tree so titles/nav/footers update.
export const saveBrandingAction = withAdminAudit<
  z.infer<typeof brandingSchema>,
  { ok: true }
>(
  {
    permissionKey: "platform.settings",
    actionName: "platform.settings.branding",
    targetType: "platform_setting",
    getTargetId: () => BRANDING_SETTING_ID,
  },
  async (args, service) => {
    const parsed = brandingSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const { brandName, companyName, companyLocation } = parsed.data;

    const rows = [
      { key: "brand_name", value: brandName },
      { key: "company_legal_name", value: companyName },
      { key: "company_location", value: companyLocation },
    ];
    const { data, error } = await service
      .from("platform_settings")
      .upsert(
        rows.map((r) => ({
          key: r.key,
          value: r.value as never,
          updated_at: new Date().toISOString(),
        })),
      )
      .select("key, value");
    if (error) throw new Error(error.message);

    // These appear everywhere — revalidate the whole app tree.
    revalidatePath("/", "layout");

    return { result: { ok: true }, after: data };
  },
);
