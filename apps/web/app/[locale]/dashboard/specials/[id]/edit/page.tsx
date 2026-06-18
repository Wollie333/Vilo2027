import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { requireHost } from "@/lib/host/current";

import { SpecialEditor } from "../../_components/SpecialEditor";
import { loadSpecial, loadSpecialEditorData } from "../../_lib/load";

export const metadata: Metadata = { title: "Edit special" };

export const dynamic = "force-dynamic";

export default async function EditSpecialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const host = await requireHost();
  if (!host.ok) redirect(`/login?next=/dashboard/specials/${id}/edit`);

  const [data, special] = await Promise.all([
    loadSpecialEditorData(host.hostId),
    loadSpecial(id, host.hostId),
  ]);
  if (!special) notFound();

  return (
    <SpecialEditor
      mode="edit"
      specialId={id}
      initialValues={special.values}
      initialStatus={special.values.status}
      data={data}
    />
  );
}
