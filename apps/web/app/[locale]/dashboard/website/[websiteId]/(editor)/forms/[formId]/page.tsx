import { ArrowLeft, Inbox } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { FormsManager } from "../FormsManager";
import { loadFormsEditor } from "../loadFormsEditor";

export const dynamic = "force-dynamic";

export default async function WebsiteFormEditorPage({
  params,
}: {
  params: Promise<{ websiteId: string; formId: string }>;
}) {
  const { websiteId, formId } = await params;
  const [t, data] = await Promise.all([
    getTranslations("website"),
    loadFormsEditor(websiteId),
  ]);
  if (!data || !data.forms.some((f) => f.id === formId)) notFound();

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/dashboard/website/${websiteId}/forms`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-mute hover:text-brand-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("formsHeading")}
        </Link>
        <Link
          href={`/dashboard/website/${websiteId}/forms/responses`}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-light"
        >
          <Inbox className="h-3.5 w-3.5" />
          {t("responsesHeading")}
        </Link>
      </header>

      <FormsManager
        websiteId={websiteId}
        initialForms={data.forms}
        preselectId={formId}
      />
    </div>
  );
}
