import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { loadFormResponses } from "./loadFormResponses";
import { ResponsesManager } from "./ResponsesManager";

export const dynamic = "force-dynamic";

export default async function WebsiteFormResponsesPage({
  params,
  searchParams,
}: {
  params: Promise<{ websiteId: string }>;
  searchParams: Promise<{ form?: string }>;
}) {
  const { websiteId } = await params;
  const { form } = await searchParams;
  const [t, data] = await Promise.all([
    getTranslations("website"),
    loadFormResponses(websiteId),
  ]);
  if (!data) notFound();

  return (
    <div>
      <header className="mb-5 max-w-2xl">
        <Link
          href={`/dashboard/website/${websiteId}/forms`}
          className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-mute transition-colors hover:text-brand-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("formsHeading")}
        </Link>
        <h2 className="font-display text-lg font-bold text-brand-ink">
          {t("responsesHeading")}
        </h2>
        <p className="mt-1 text-sm text-brand-mute">{t("responsesSub")}</p>
      </header>

      <ResponsesManager
        websiteId={websiteId}
        forms={data.forms}
        submissions={data.submissions}
        initialFormId={form ?? "all"}
      />
    </div>
  );
}
