import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { loadWebsiteEditorData } from "../../loadWebsiteEditorData";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function WebsiteSettingsPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const [t, data] = await Promise.all([
    getTranslations("website"),
    loadWebsiteEditorData(websiteId),
  ]);
  if (!data) notFound();

  const enquiry = data.settings.enquiry ?? {};
  const conversion = (data.settings.conversion ?? {}) as {
    whatsapp?: { enabled?: boolean; number?: string; message?: string };
    announcement?: {
      enabled?: boolean;
      text?: string;
      linkLabel?: string;
      linkHref?: string;
    };
  };
  const wa = conversion.whatsapp ?? {};
  const ann = conversion.announcement ?? {};

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
        }}
      />
    </div>
  );
}
