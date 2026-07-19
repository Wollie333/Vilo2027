import { notFound } from "next/navigation";

import { listWebsiteFormsAction } from "@/app/[locale]/dashboard/website/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { websiteAssetUrl } from "@/lib/website/assets";

import { loadWebsiteEditorData } from "../../loadWebsiteEditorData";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function WebsiteSettingsPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const [data, formsRes] = await Promise.all([
    loadWebsiteEditorData(websiteId),
    listWebsiteFormsAction(websiteId),
  ]);
  if (!data) notFound();

  // CAPI config (server-only). loadWebsiteEditorData already asserted ownership;
  // we surface only the enabled flag + whether a token is on file — never the
  // token itself.
  const { data: capiRow } = await createAdminClient()
    .from("host_websites")
    .select("meta_capi_enabled, meta_capi_access_token")
    .eq("id", websiteId)
    .maybeSingle();

  const forms = formsRes.ok ? formsRes.forms : [];

  const enquiry = data.settings.enquiry ?? {};
  const conversion = (data.settings.conversion ?? {}) as {
    whatsapp?: { enabled?: boolean; number?: string; message?: string };
    announcement?: {
      enabled?: boolean;
      text?: string;
      linkLabel?: string;
      linkHref?: string;
    };
    popup?: {
      enabled?: boolean;
      heading?: string;
      body?: string;
      trigger?: "delay" | "scroll" | "exit";
      delaySeconds?: number;
      scrollPercent?: number;
      frequency?: "once" | "daily" | "always";
      ctaLabel?: string;
      ctaHref?: string;
      formId?: string;
    };
  };
  const wa = conversion.whatsapp ?? {};
  const ann = conversion.announcement ?? {};
  const pop = conversion.popup ?? {};

  const analytics = (data.settings.analytics ?? {}) as {
    ga4?: string;
    metaPixel?: string;
    gtm?: string;
    tiktok?: string;
    googleAds?: string;
    cookieConsent?: {
      enabled?: boolean;
      message?: string;
      privacyHref?: string;
    };
  };
  const consent = analytics.cookieConsent ?? {};

  const blog = (data.settings.blog ?? {}) as {
    heading?: string;
    intro?: string;
  };

  const socialRail = (data.settings.socialRail ?? {}) as {
    enabled?: boolean;
  };

  const payments = (data.settings.payments ?? {}) as {
    paystack?: boolean;
    eft?: boolean;
  };

  return (
    <SettingsForm
      websiteId={websiteId}
      status={data.status}
      defaultEmail={data.brand.contact?.email ?? ""}
      defaultPhone={data.brand.contact?.phone ?? ""}
      brandHref={`/dashboard/website/${websiteId}/brand`}
      themeHref={`/dashboard/website/${websiteId}/theme`}
      seoHref={`/dashboard/website/${websiteId}/seo`}
      domainHref={`/dashboard/website/${websiteId}/domain`}
      faviconUrl={websiteAssetUrl(data.brand.favicon_path) || null}
      forms={forms.map((f) => ({ id: f.id, name: f.name }))}
      initial={{
        brandName: data.brand.name ?? "",
        brandTagline: data.brand.tagline ?? "",
        enquiryEmailEnabled: enquiry.emailEnabled === true,
        enquiryEmailTo: enquiry.emailTo ?? "",
        payPaystackEnabled: payments.paystack !== false,
        payEftEnabled: payments.eft !== false,
        whatsappEnabled: wa.enabled === true,
        whatsappNumber: wa.number ?? "",
        whatsappMessage: wa.message ?? "",
        announcementEnabled: ann.enabled === true,
        announcementText: ann.text ?? "",
        announcementLinkLabel: ann.linkLabel ?? "",
        announcementLinkHref: ann.linkHref ?? "",
        popupEnabled: pop.enabled === true,
        popupHeading: pop.heading ?? "",
        popupBody: pop.body ?? "",
        popupTrigger: pop.trigger ?? "delay",
        popupDelaySeconds: pop.delaySeconds ?? 5,
        popupScrollPercent: pop.scrollPercent ?? 50,
        popupFrequency: pop.frequency ?? "once",
        popupCtaLabel: pop.ctaLabel ?? "",
        popupCtaHref: pop.ctaHref ?? "",
        popupFormId: pop.formId ?? "",
        ga4MeasurementId: analytics.ga4 ?? "",
        metaPixelId: analytics.metaPixel ?? "",
        gtmId: analytics.gtm ?? "",
        tiktokId: analytics.tiktok ?? "",
        googleAdsId: analytics.googleAds ?? "",
        cookieConsentEnabled: consent.enabled !== false,
        cookieConsentMessage: consent.message ?? "",
        privacyPolicyHref: consent.privacyHref ?? "",
        metaCapiEnabled: capiRow?.meta_capi_enabled === true,
        capiTokenSet: Boolean(capiRow?.meta_capi_access_token),
        blogHeading: blog.heading ?? "",
        blogIntro: blog.intro ?? "",
        socialRail: { enabled: socialRail.enabled === true },
      }}
    />
  );
}
