import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireHost } from "@/lib/host/current";

import { SpecialEditor } from "../_components/SpecialEditor";
import { emptySpecial } from "../_lib/defaults";
import { loadSpecialEditorData } from "../_lib/load";

export const metadata: Metadata = { title: "New special" };

export const dynamic = "force-dynamic";

export default async function NewSpecialPage() {
  const host = await requireHost();
  if (!host.ok) redirect("/login?next=/dashboard/specials/new");

  const data = await loadSpecialEditorData(host.hostId);

  return (
    <SpecialEditor
      mode="create"
      initialValues={emptySpecial()}
      initialStatus="draft"
      data={data}
    />
  );
}
