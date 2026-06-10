"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";
import { sanitiseListingHtml } from "@/lib/sanitiseHtml";

// Fixed sentinel id for the branding platform_settings (audit target_id is a
// uuid column; platform_settings is keyed by text, so we use a stable uuid).
const BRANDING_SETTING_ID = "00000000-0000-0000-0000-0000000b5a4d";
const LEGAL_SETTING_ID = "00000000-0000-0000-0000-0000001e6a1f";

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

// ─── Platform legal documents (booking terms + privacy) ────────────
const legalSchema = z.object({
  kind: z.enum(["booking_terms", "privacy"]),
  // Empty string clears the custom text (public page falls back to static copy).
  html: z.string().max(120_000),
  reason: z.string().optional(),
});

const LEGAL_KEY: Record<"booking_terms" | "privacy", string> = {
  booking_terms: "legal_booking_terms",
  privacy: "legal_privacy",
};

// Publish a platform-wide legal document (Vilo-authored). Sanitises the HTML and
// bumps the version only when the text actually changes, so booking acceptance
// records (bookings.accepted_*_version) stay meaningful. Admin-only + audited.
export const saveLegalDocAction = withAdminAudit<
  z.infer<typeof legalSchema>,
  { ok: true; version: number }
>(
  {
    permissionKey: "platform.settings",
    actionName: "platform.settings.legal",
    targetType: "platform_setting",
    getTargetId: () => LEGAL_SETTING_ID,
  },
  async (args, service) => {
    const parsed = legalSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const { kind, html } = parsed.data;
    const cleaned = html.trim().length > 0 ? sanitiseListingHtml(html) : null;
    const key = LEGAL_KEY[kind];

    const { data: existing } = await service
      .from("platform_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    const prev = (existing?.value ?? {}) as {
      html?: string | null;
      version?: number;
    };
    const prevHtml = typeof prev.html === "string" ? prev.html : null;
    const prevVersion = typeof prev.version === "number" ? prev.version : 1;
    const version = cleaned === prevHtml ? prevVersion : prevVersion + 1;

    const { error } = await service.from("platform_settings").upsert({
      key,
      value: {
        html: cleaned,
        version,
        updated_at: new Date().toISOString(),
      } as never,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    // The public /terms + /privacy pages read this at runtime.
    revalidatePath("/terms");
    revalidatePath("/privacy");

    return { result: { ok: true, version }, after: { key, version } };
  },
);
