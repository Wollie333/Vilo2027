import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { listWebsiteFormsAction } from "@/app/[locale]/dashboard/website/actions";

import { loadWebsiteEditorData } from "../../loadWebsiteEditorData";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function WebsiteSettingsPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const [t, data, formsRes] = await Promise.all([
    getTranslations("website"),
    loadWebsiteEditorData(websiteId),
    listWebsiteFormsAction(websiteId),
  ]);
  if (!data) notFound();

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

  return (
    <div className="max-w-2xl">
      <header className="mb-5">
        <h2 className="font-display text-lg font-bold text-brand-ink">
          {t("settingsHeading")}
        </h2>
        <p className="mt-1 text-sm text-brand-mute">{t("settingsSub")}</p>
      </header>

      <SettingsForm
        websiteId={websiteId}
        defaultEmail={data.brand.contact?.email ?? ""}
        defaultPhone={data.brand.contact?.phone ?? ""}
        forms={forms.map((f) => ({ id: f.id, name: f.name }))}
        initial={{
          enquiryEmailEnabled: enquiry.emailEnabled === true,
          enquiryEmailTo: enquiry.emailTo ?? "",
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
        }}
      />
    </div>
  );
}
