import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { loadDomainData } from "./loadDomainData";
import { DomainManager } from "./DomainManager";

export const dynamic = "force-dynamic";

export default async function WebsiteDomainPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const [t, data] = await Promise.all([
    getTranslations("website"),
    loadDomainData(websiteId),
  ]);
  if (!data) notFound();

  return (
    <div className="max-w-2xl">
      <header className="mb-5">
        <h2 className="font-display text-lg font-bold text-brand-ink">
          {t("domainHeading")}
        </h2>
        <p className="mt-1 text-sm text-brand-mute">{t("domainSub")}</p>
      </header>

      <DomainManager data={data} />
    </div>
  );
}
