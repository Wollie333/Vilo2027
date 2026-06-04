import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";

// The app's display brand name is configurable (platform_settings.brand_name) —
// "Vilo" is a placeholder until the real brand is chosen. Read it through here
// rather than hardcoding the word anywhere.
//
// Server-only: uses the service role so it resolves in ANY server context (RSC,
// route handler, email worker, PDF render) without depending on request cookies.
// Cached per request via React cache(). Client components get the value from
// <BrandProvider> (fed by the root layout) — see components/brand/BrandProvider.

export const DEFAULT_BRAND = "Vilo";

export const getBrandName = cache(async (): Promise<string> => {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "brand_name")
      .maybeSingle();
    const v = data?.value;
    return typeof v === "string" && v.trim().length > 0
      ? v.trim()
      : DEFAULT_BRAND;
  } catch {
    return DEFAULT_BRAND;
  }
});
