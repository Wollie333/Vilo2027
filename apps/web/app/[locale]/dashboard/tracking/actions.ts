"use server";

import { revalidatePath } from "next/cache";

import { encryptSecret } from "@/lib/crypto/payments";
import { createServerClient } from "@/lib/supabase/server";

import { trackingSchema, type TrackingInput } from "./schema";

type Result = { ok: true } | { ok: false; error: string };

// Save the host's site-wide tracking ids into `settings.analytics` (same shape
// the website builder writes) plus the Meta Conversions API token/enabled flag.
// The token lives in a server-only, encrypted column — never in the JSON that
// reaches the client. Owner-checked: the website must belong to the caller's host.
export async function saveTrackingAction(
  input: TrackingInput,
): Promise<Result> {
  const parsed = trackingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  const d = parsed.data;

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!host) return { ok: false, error: "Host profile not found." };

  const { data: site } = await supabase
    .from("host_websites")
    .select("settings")
    .eq("id", d.websiteId)
    .eq("host_id", host.id)
    .maybeSingle<{ settings: Record<string, unknown> | null }>();
  if (!site) return { ok: false, error: "Website not found." };

  const cleanHref = (raw: string) =>
    /^(https?:\/\/|\/)/i.test(raw.trim()) ? raw.trim() : "";

  const prevSettings = (site.settings ?? {}) as Record<string, unknown>;
  const prevAnalytics = (prevSettings.analytics ?? {}) as Record<
    string,
    unknown
  >;
  const settings = {
    ...prevSettings,
    analytics: {
      ...prevAnalytics,
      metaPixel: d.metaPixel.trim(),
      ga4: d.ga4.trim().toUpperCase(),
      gtm: d.gtm.trim().toUpperCase(),
      tiktok: d.tiktok.trim().toUpperCase(),
      googleAds: d.googleAds.trim().toUpperCase(),
      cookieConsent: {
        enabled: d.cookieConsentEnabled,
        message: d.cookieConsentMessage.trim(),
        privacyHref: cleanHref(d.privacyHref),
      },
    },
  };

  const update: Record<string, unknown> = {
    settings,
    meta_capi_enabled: d.metaCapiEnabled,
  };
  if (d.metaCapiToken) {
    update.meta_capi_access_token = encryptSecret(d.metaCapiToken);
  }

  const { error } = await supabase
    .from("host_websites")
    .update(update as never)
    .eq("id", d.websiteId)
    .eq("host_id", host.id);
  if (error) return { ok: false, error: "Could not save — please retry." };

  revalidatePath("/dashboard/tracking");
  return { ok: true };
}
