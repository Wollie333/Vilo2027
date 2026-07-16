import "server-only";

import { getDefaultBusinessId } from "@/lib/business/resolveBusiness";
import { slugify } from "@/lib/help/slug";
import { requireHost } from "@/lib/host/current";
import { loadActiveThemes, type ThemeOption } from "@/lib/site/themes.server";
import { createServerClient } from "@/lib/supabase/server";

export type WizardContext = {
  businessId: string;
  /** Prefill for the site name (business trading/legal name). */
  defaultName: string;
  /** Suggested subdomain (slug of the name) — uniqueness is checked on submit. */
  defaultSubdomain: string;
  /** The business's logo path (storage path, not a URL), if any. */
  logoPath: string | null;
  contactEmail: string;
  contactPhone: string;
  themes: ThemeOption[];
  /** True when this business already has a website (wizard should not re-create). */
  alreadyExists: boolean;
};

/**
 * Loads everything the setup wizard prefills + offers: the host's default
 * business (name + logo), a suggested subdomain, and the active theme catalogue.
 * Returns null when there's no signed-in host or no business yet. Reuses the
 * existing business resolver + theme loader — no new data sources.
 */
export async function loadWizardContext(): Promise<WizardContext | null> {
  const host = await requireHost();
  if (!host.ok) return null;

  const supabase = createServerClient();
  const businessId = await getDefaultBusinessId(supabase, host.hostId);
  if (!businessId) return null;

  const [{ data: biz }, { data: existing }, themes] = await Promise.all([
    supabase
      .from("businesses")
      .select("trading_name, legal_name, logo_path")
      .eq("id", businessId)
      .maybeSingle(),
    supabase
      .from("host_websites")
      .select("id")
      .eq("business_id", businessId)
      .maybeSingle(),
    loadActiveThemes(),
  ]);

  const name = biz?.trading_name?.trim() || biz?.legal_name?.trim() || "";

  // The business logo lives in the `host-logos` bucket, so resolve it to its
  // public URL and pass THAT as the prefill: websiteAssetUrl() passes absolute
  // URLs through unchanged, so it renders in the wizard preview and, once stored
  // on brand.logo_path, on the live site — without copying buckets.
  const businessLogoUrl = biz?.logo_path
    ? (supabase.storage.from("host-logos").getPublicUrl(biz.logo_path).data
        ?.publicUrl ?? null)
    : null;

  return {
    businessId,
    defaultName: name,
    defaultSubdomain: slugify(name).slice(0, 63),
    logoPath: businessLogoUrl,
    contactEmail: "",
    contactPhone: "",
    themes,
    alreadyExists: Boolean(existing),
  };
}
