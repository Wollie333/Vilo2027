import { notFound } from "next/navigation";

import { loadDomainData } from "./loadDomainData";
import { DomainManager } from "./DomainManager";

export const dynamic = "force-dynamic";

export default async function WebsiteDomainPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const data = await loadDomainData(websiteId);
  if (!data) notFound();

  return <DomainManager data={data} />;
}
