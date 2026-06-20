import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { FormsManager } from "./FormsManager";
import { loadFormsEditor } from "./loadFormsEditor";

export const dynamic = "force-dynamic";

export default async function WebsiteFormsPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const [t, data] = await Promise.all([
    getTranslations("website"),
    loadFormsEditor(websiteId),
  ]);
  if (!data) notFound();

  return (
    <div>
      <header className="mb-5 max-w-2xl">
        <h2 className="font-display text-lg font-bold text-brand-ink">
          {t("formsHeading")}
        </h2>
        <p className="mt-1 text-sm text-brand-mute">{t("formsSub")}</p>
      </header>

      <FormsManager websiteId={websiteId} initialForms={data.forms} />
    </div>
  );
}
