import { notFound } from "next/navigation";

import { FormsList } from "./FormsList";
import { loadFormsEditor } from "./loadFormsEditor";

export const dynamic = "force-dynamic";

export default async function WebsiteFormsPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const data = await loadFormsEditor(websiteId);
  if (!data) notFound();

  return <FormsList websiteId={websiteId} initialForms={data.forms} />;
}
