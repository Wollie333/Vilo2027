import "server-only";

import { cache } from "react";

import type { PlatformTracking } from "@/components/analytics/PlatformMarketing";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin-managed platform marketing integrations (the singleton
// platform_integrations row). The Meta browser Pixel is active when its id is
// set AND enabled; the other tracking ids (GA4 / GTM / TikTok / Google Ads) are
// active simply when set. The Conversions API token is plumbed for later and is
// NEVER exposed to the client (server-only helper).

export type MetaIntegration = {
  pixelId: string | null;
  pixelEnabled: boolean;
  capiEnabled: boolean;
  capiTokenSet: boolean;
  testEventCode: string | null;
  // Other platform tracking ids (presence = active).
  ga4: string | null;
  gtm: string | null;
  tiktok: string | null;
  googleAds: string | null;
};

export const getMetaIntegration = cache(async (): Promise<MetaIntegration> => {
  const empty: MetaIntegration = {
    pixelId: null,
    pixelEnabled: false,
    capiEnabled: false,
    capiTokenSet: false,
    testEventCode: null,
    ga4: null,
    gtm: null,
    tiktok: null,
    googleAds: null,
  };
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_integrations")
      .select(
        "meta_pixel_id, meta_pixel_enabled, meta_capi_enabled, meta_capi_access_token, meta_test_event_code, ga4_measurement_id, gtm_container_id, tiktok_pixel_id, google_ads_id",
      )
      .eq("id", true)
      .maybeSingle();
    if (!data) return empty;
    return {
      pixelId: data.meta_pixel_id ?? null,
      pixelEnabled: !!data.meta_pixel_enabled,
      capiEnabled: !!data.meta_capi_enabled,
      capiTokenSet: !!data.meta_capi_access_token,
      testEventCode: data.meta_test_event_code ?? null,
      ga4: data.ga4_measurement_id ?? null,
      gtm: data.gtm_container_id ?? null,
      tiktok: data.tiktok_pixel_id ?? null,
      googleAds: data.google_ads_id ?? null,
    };
  } catch {
    return empty;
  }
});

/**
 * The client-safe set of Wielo platform tracking ids to inject site-wide (via
 * PlatformMarketing in the root layout). Meta pixel obeys its enabled flag; the
 * others are active when set. Never returns the CAPI token.
 */
export async function getPlatformTracking(): Promise<PlatformTracking> {
  const m = await getMetaIntegration();
  const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);
  return {
    metaPixelId: m.pixelEnabled ? clean(m.pixelId) : null,
    ga4: clean(m.ga4),
    gtm: clean(m.gtm),
    tiktok: clean(m.tiktok),
    googleAds: clean(m.googleAds),
  };
}
