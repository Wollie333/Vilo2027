import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";

// The app's display brand name + legal company identity are configurable
// (platform_settings) — all placeholders until the real brand/company is
// decided. Read them through here rather than hardcoding the strings anywhere.
//
// Server-only: uses the service role so values resolve in ANY server context
// (RSC, route handler, email worker, PDF render) without depending on request
// cookies. Cached per request via React cache(). Client components get the
// values from <BrandProvider> (fed by the root layout) — see
// components/brand/BrandProvider.

export const DEFAULT_BRAND = "Vilo";
export const DEFAULT_COMPANY_NAME = "Vilo Platform (Pty) Ltd";
export const DEFAULT_COMPANY_LOCATION = "Cape Town, South Africa";

// Read one platform_settings string value, falling back to a default.
const getSettingString = cache(
  async (key: string, fallback: string): Promise<string> => {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("platform_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      const v = data?.value;
      return typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback;
    } catch {
      return fallback;
    }
  },
);

export const getBrandName = (): Promise<string> =>
  getSettingString("brand_name", DEFAULT_BRAND);

export const getCompanyLegalName = (): Promise<string> =>
  getSettingString("company_legal_name", DEFAULT_COMPANY_NAME);

export const getCompanyLocation = (): Promise<string> =>
  getSettingString("company_location", DEFAULT_COMPANY_LOCATION);

// All branding values at once (used by the root layout to feed the client
// provider, and by the admin settings form).
export async function getBranding(): Promise<{
  brandName: string;
  companyName: string;
  companyLocation: string;
}> {
  const [brandName, companyName, companyLocation] = await Promise.all([
    getBrandName(),
    getCompanyLegalName(),
    getCompanyLocation(),
  ]);
  return { brandName, companyName, companyLocation };
}
