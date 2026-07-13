import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { loadFormDraft } from "@/lib/drafts/store";
import { requireHost } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";

import { SpecialEditor } from "../_components/SpecialEditor";
import { emptySpecial } from "../_lib/defaults";
import { loadSpecialEditorData } from "../_lib/load";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("specials");
  return { title: t("metaNew") };
}

export const dynamic = "force-dynamic";

export default async function NewSpecialPage() {
  const host = await requireHost();
  if (!host.ok) redirect("/login?next=/dashboard/specials/new");

  const data = await loadSpecialEditorData(host.hostId);

  const serverDraft = await loadFormDraft(createServerClient(), host.userId, {
    entityType: "special",
    entityId: null,
    scopeId: null,
  });

  return (
    <SpecialEditor
      mode="create"
      initialValues={emptySpecial()}
      initialStatus="draft"
      data={data}
      userId={host.userId}
      serverDraft={serverDraft}
    />
  );
}
