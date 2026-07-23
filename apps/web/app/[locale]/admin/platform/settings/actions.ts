"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";
import { encryptSecret } from "@/lib/crypto/payments";
import { sanitiseListingHtml } from "@/lib/sanitiseHtml";

// Fixed sentinel id for the branding platform_settings (audit target_id is a
// uuid column; platform_settings is keyed by text, so we use a stable uuid).
const BRANDING_SETTING_ID = "00000000-0000-0000-0000-0000000b5a4d";
const LEGAL_SETTING_ID = "00000000-0000-0000-0000-0000001e6a1f";
const LEGAL_DOCS_SETTING_ID = "00000000-0000-0000-0000-0000001e6d0c";
const WIELO_BUSINESS_SETTING_ID = "00000000-0000-0000-0000-0000005b1d00";
const META_INTEGRATION_ID = "00000000-0000-0000-0000-0000000fb1d0";

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

// Publish a platform-wide legal document (Wielo-authored). Sanitises the HTML and
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

// ─── Generic legal documents (WS-6a: /legal/[slug]) ────────────────
const legalDocumentSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(80)
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Slug must be lowercase words separated by hyphens.",
    ),
  title: z.string().trim().min(2, "Enter a title.").max(200),
  // Empty string is allowed (a stub with no body yet) — it just won't render.
  html: z.string().max(200_000),
  is_published: z.boolean().default(true),
  reason: z.string().optional(),
});

// Create or update a slug-addressable legal document. Sanitises the HTML and bumps
// `version` only when the body actually changes. `published_at` advances only on a
// content change or a first publish, so the public page's "Last updated" stays
// honest. Admin-only + audited (the acting admin is recorded in admin_audit_log).
export const saveLegalDocumentAction = withAdminAudit<
  z.infer<typeof legalDocumentSchema>,
  { ok: true; version: number }
>(
  {
    permissionKey: "platform.settings",
    actionName: "platform.settings.legal_document",
    targetType: "platform_setting",
    getTargetId: () => LEGAL_DOCS_SETTING_ID,
  },
  async (args, service) => {
    const parsed = legalDocumentSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const { slug, title, html, is_published } = parsed.data;
    const cleaned = html.trim().length > 0 ? sanitiseListingHtml(html) : null;

    const { data: existing } = await service
      .from("legal_documents")
      .select("body_html, version, is_published, published_at")
      .eq("slug", slug)
      .maybeSingle();

    const prevHtml = existing?.body_html ?? null;
    const prevVersion =
      typeof existing?.version === "number" ? existing.version : 0;
    const bodyChanged = cleaned !== prevHtml;
    const version = existing
      ? bodyChanged
        ? prevVersion + 1
        : prevVersion
      : 1;

    const nowIso = new Date().toISOString();
    // Advance published_at on a first publish, a content change, or when moving
    // from unpublished → published; otherwise keep the prior stamp.
    const becamePublished = is_published && !existing?.is_published;
    const publishedAt = is_published
      ? bodyChanged || becamePublished || !existing?.published_at
        ? nowIso
        : existing.published_at
      : (existing?.published_at ?? null);

    const { error } = await service.from("legal_documents").upsert(
      {
        slug,
        title,
        body_html: cleaned,
        version,
        is_published,
        published_at: publishedAt,
        updated_at: nowIso,
      },
      { onConflict: "slug" },
    );
    if (error) throw new Error(error.message);

    // The public /legal/[slug] page reads this at runtime.
    revalidatePath(`/legal/${slug}`);

    return { result: { ok: true, version }, after: { slug, version } };
  },
);

// ─── Wielo business details (issuer on every Wielo invoice) ──────────
const wieloBusinessSchema = z.object({
  legal_name: z.string().trim().max(160),
  vat_number: z.string().trim().max(40),
  company_reg_number: z.string().trim().max(60),
  address_line1: z.string().trim().max(160),
  address_line2: z.string().trim().max(160),
  city: z.string().trim().max(80),
  postal_code: z.string().trim().max(20),
  country: z.string().trim().max(2),
  email: z.string().trim().max(160),
  logo_path: z.string().trim().max(400),
  // VAT pricing mode + rate. Only takes effect when vat_number is set; rate is a
  // percentage 0–100 (SA is 15). Stored as a string to match the jsonb shape.
  vat_mode: z.enum(["inclusive", "exclusive"]).default("inclusive"),
  vat_rate: z
    .string()
    .trim()
    .refine((v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 100;
    }, "VAT rate must be a number between 0 and 100.")
    .default("15"),
  reason: z.string().optional(),
});

// Save Wielo's own business identity (platform_settings.wielo_business). Frozen
// into each Wielo invoice at issue time by the mint_wielo_invoice trigger. Admin
// only + audited; the country defaults to ZA when left blank.
export const saveWieloBusinessAction = withAdminAudit<
  z.infer<typeof wieloBusinessSchema>,
  { ok: true }
>(
  {
    permissionKey: "platform.settings",
    actionName: "platform.settings.wielo_business",
    targetType: "platform_setting",
    getTargetId: () => WIELO_BUSINESS_SETTING_ID,
  },
  async (args, service) => {
    const parsed = wieloBusinessSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const { reason: _reason, ...value } = parsed.data;
    void _reason;
    const { error } = await service.from("platform_settings").upsert({
      key: "wielo_business",
      value: { ...value, country: value.country || "ZA" } as never,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { result: { ok: true }, after: value };
  },
);

// Upload the Wielo platform logo (shown top-left on every Wielo → user financial
// document). Stored in the host-logos bucket under a wielo-business/ prefix (a
// public bucket, same as host business logos). Returns the storage path; the
// form then persists it via saveWieloBusinessAction. Admin only + audited.
const wieloLogoSchema = z.object({
  // A data: URL (base64). Kept modest — a logo, not a hero image.
  dataUrl: z.string().max(3_500_000),
  reason: z.string().optional(),
});

export const uploadWieloLogoAction = withAdminAudit<
  z.infer<typeof wieloLogoSchema>,
  { ok: true; path: string }
>(
  {
    permissionKey: "platform.settings",
    actionName: "platform.settings.wielo_logo",
    targetType: "platform_setting",
    getTargetId: () => WIELO_BUSINESS_SETTING_ID,
  },
  async (args, service) => {
    const parsed = wieloLogoSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const m = /^data:(image\/(png|jpeg|jpg|webp|svg\+xml));base64,(.+)$/.exec(
      parsed.data.dataUrl,
    );
    if (!m) throw new Error("Upload a PNG, JPG, WebP or SVG image.");
    const contentType = m[1];
    const ext =
      m[2] === "svg+xml" ? "svg" : m[2] === "jpeg" ? "jpg" : (m[2] as string);
    const bytes = Buffer.from(m[3], "base64");
    if (bytes.length > 2_000_000) throw new Error("Logo must be under 2 MB.");

    const path = `wielo-business/logo-${randomUUID()}.${ext}`;
    const { error } = await service.storage
      .from("host-logos")
      .upload(path, bytes, { contentType, upsert: true });
    if (error) throw new Error(error.message);

    return { result: { ok: true, path }, after: { path } };
  },
);

// ─── Meta Pixel (Conversions API plumbed for later) ────────────────
const metaIntegrationSchema = z.object({
  meta_pixel_id: z
    .string()
    .trim()
    .max(40)
    .regex(/^\d*$/, "A Meta Pixel ID is numeric.")
    .optional()
    .default(""),
  meta_pixel_enabled: z.boolean(),
  meta_test_event_code: z.string().trim().max(40).optional().default(""),
  // Conversions API (server-side). The token is write-only: a blank value keeps
  // the current token (never sent back to the client), so the admin toggles CAPI
  // off with the enabled flag rather than by clearing the field.
  meta_capi_access_token: z.string().trim().max(400).optional().default(""),
  meta_capi_enabled: z.boolean().optional().default(false),
  reason: z.string().optional(),
});

// Save the Meta Pixel config (platform_integrations singleton). The pixel loads
// site-wide when enabled + an id is set — no redeploy. The Conversions API token
// is intentionally not editable here yet (coming soon). Admin only + audited.
export const saveMetaIntegrationAction = withAdminAudit<
  z.infer<typeof metaIntegrationSchema>,
  { ok: true }
>(
  {
    permissionKey: "platform.settings",
    actionName: "platform.settings.meta_integration",
    targetType: "platform_setting",
    getTargetId: () => META_INTEGRATION_ID,
  },
  async (args, service) => {
    const parsed = metaIntegrationSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const {
      meta_pixel_id,
      meta_pixel_enabled,
      meta_test_event_code,
      meta_capi_access_token,
      meta_capi_enabled,
    } = parsed.data;
    const row: Record<string, unknown> = {
      id: true,
      meta_pixel_id: meta_pixel_id || null,
      meta_pixel_enabled,
      meta_test_event_code: meta_test_event_code || null,
      meta_capi_enabled,
      updated_at: new Date().toISOString(),
    };
    // Only overwrite the token when a new one is supplied (write-only secret).
    // Encrypt at the app layer (AES-256-GCM via PAYMENT_CIPHER_KEY) like the
    // payment-gateway secrets; meta-capi.ts decrypts it server-side to call Meta.
    if (meta_capi_access_token) {
      row.meta_capi_access_token = encryptSecret(meta_capi_access_token);
    }
    const { error } = await service
      .from("platform_integrations")
      .upsert(row as never);
    if (error) throw new Error(error.message);
    // Pixel id is read by the root layout — revalidate the whole tree.
    revalidatePath("/", "layout");
    return {
      result: { ok: true },
      after: {
        meta_pixel_id,
        meta_pixel_enabled,
        meta_capi_enabled,
        capi_token_updated: Boolean(meta_capi_access_token),
      },
    };
  },
);

// ─── Other platform tracking ids (GA4 / GTM / TikTok / Google Ads) ──
// Presence of an id = active; the founder can paste them without a redeploy.
// They load site-wide on the Wielo app (never on host micro-sites). Same
// singleton row as the Meta pixel; only these columns are touched, so the two
// forms don't clobber each other.
const trackingIdsSchema = z.object({
  ga4_measurement_id: z
    .string()
    .trim()
    .max(40)
    .regex(/^(G-[A-Z0-9]+)?$/i, "GA4 ids look like G-XXXXXXXXXX.")
    .optional()
    .default(""),
  gtm_container_id: z
    .string()
    .trim()
    .max(40)
    .regex(/^(GTM-[A-Z0-9]+)?$/i, "GTM ids look like GTM-XXXXXXX.")
    .optional()
    .default(""),
  tiktok_pixel_id: z.string().trim().max(60).optional().default(""),
  google_ads_id: z
    .string()
    .trim()
    .max(40)
    .regex(/^(AW-[A-Z0-9]+)?$/i, "Google Ads ids look like AW-XXXXXXXXX.")
    .optional()
    .default(""),
  reason: z.string().optional(),
});

export const saveTrackingIdsAction = withAdminAudit<
  z.infer<typeof trackingIdsSchema>,
  { ok: true }
>(
  {
    permissionKey: "platform.settings",
    actionName: "platform.settings.tracking_ids",
    targetType: "platform_setting",
    getTargetId: () => META_INTEGRATION_ID,
  },
  async (args, service) => {
    const parsed = trackingIdsSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const {
      ga4_measurement_id,
      gtm_container_id,
      tiktok_pixel_id,
      google_ads_id,
    } = parsed.data;
    const { error } = await service.from("platform_integrations").upsert({
      id: true,
      ga4_measurement_id: ga4_measurement_id || null,
      gtm_container_id: gtm_container_id || null,
      tiktok_pixel_id: tiktok_pixel_id || null,
      google_ads_id: google_ads_id || null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return {
      result: { ok: true },
      after: {
        ga4_measurement_id,
        gtm_container_id,
        tiktok_pixel_id,
        google_ads_id,
      },
    };
  },
);
