import "server-only";

import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";

// Admin-managed Meta (Facebook) marketing integration. The browser Pixel is
// active when an id is set AND enabled. The Conversions API token is plumbed for
// later and is NEVER exposed to the client (server-only helper).

export type MetaIntegration = {
  pixelId: string | null;
  pixelEnabled: boolean;
  capiEnabled: boolean;
  capiTokenSet: boolean;
  testEventCode: string | null;
};

export const getMetaIntegration = cache(async (): Promise<MetaIntegration> => {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_integrations")
      .select(
        "meta_pixel_id, meta_pixel_enabled, meta_capi_enabled, meta_capi_access_token, meta_test_event_code",
      )
      .eq("id", true)
      .maybeSingle();
    return {
      pixelId: data?.meta_pixel_id ?? null,
      pixelEnabled: !!data?.meta_pixel_enabled,
      capiEnabled: !!data?.meta_capi_enabled,
      capiTokenSet: !!data?.meta_capi_access_token,
      testEventCode: data?.meta_test_event_code ?? null,
    };
  } catch {
    return {
      pixelId: null,
      pixelEnabled: false,
      capiEnabled: false,
      capiTokenSet: false,
      testEventCode: null,
    };
  }
});

// The only value the client may receive: the pixel id, and only when enabled.
export async function getActiveMetaPixelId(): Promise<string | null> {
  const m = await getMetaIntegration();
  return m.pixelEnabled && m.pixelId ? m.pixelId : null;
}
