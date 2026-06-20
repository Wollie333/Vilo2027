import Link from "next/link";
import { Inbox } from "lucide-react";
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
      <header className="mb-5 flex items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-display text-lg font-bold text-brand-ink">
            {t("formsHeading")}
          </h2>
          <p className="mt-1 text-sm text-brand-mute">{t("formsSub")}</p>
        </div>
        <Link
          href={`/dashboard/website/${websiteId}/forms/responses`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-light"
        >
          <Inbox className="h-3.5 w-3.5" />
          {t("responsesHeading")}
        </Link>
      </header>

      <FormsManager websiteId={websiteId} initialForms={data.forms} />
    </div>
  );
}
