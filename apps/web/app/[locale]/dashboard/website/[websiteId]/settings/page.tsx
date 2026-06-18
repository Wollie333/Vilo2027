import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { loadWebsiteEditorData } from "../loadWebsiteEditorData";
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
        initial={{
          enquiryEmailEnabled: enquiry.emailEnabled === true,
          enquiryEmailTo: enquiry.emailTo ?? "",
        }}
      />
    </div>
  );
}
