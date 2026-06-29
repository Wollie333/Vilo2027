import { notFound } from "next/navigation";

import {
  loadFormsEditor,
  loadWebsiteRoomNames,
} from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/forms/loadFormsEditor";

import { FormEditor } from "./FormEditor";

export const dynamic = "force-dynamic";

export default async function FullScreenFormEditorPage({
  params,
}: {
  params: Promise<{ websiteId: string; formId: string }>;
}) {
  const { websiteId, formId } = await params;
  const data = await loadFormsEditor(websiteId);
  if (!data) notFound();
  const form = data.forms.find((f) => f.id === formId);
  if (!form) notFound();

  // Live rooms a `rooms` field will auto-populate with — shown read-only in the
  // builder so the host sees the real list instead of editing placeholders.
  const roomNames = await loadWebsiteRoomNames(websiteId);

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "vilo.site";

  return (
    <FormEditor
      websiteId={websiteId}
      formId={formId}
      formType={form.type}
      subdomain={`${data.subdomain}.${root}`}
      initialName={form.name}
      initialFields={form.fields}
      initialSettings={form.settings}
      roomNames={roomNames}
      themeSwatches={data.themeSwatches}
      themeVars={data.themeVars}
    />
  );
}
