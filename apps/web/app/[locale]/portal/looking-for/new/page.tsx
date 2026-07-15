import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";
import { loadFormDraft } from "@/lib/drafts/store";
import { getLookingForRequirements } from "@/lib/looking-for/requirements";
import { RequestForm, BLANK_REQUEST } from "../_components/RequestForm";

export const dynamic = "force-dynamic";

export default async function NewRequestPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/portal/looking-for/new");
  }

  const [serverDraft, requirementGroups] = await Promise.all([
    loadFormDraft(supabase, user.id, {
      entityType: "looking_for_request",
      entityId: null,
      scopeId: null,
    }),
    getLookingForRequirements(),
  ]);

  return (
    <RequestForm
      mode="create"
      userId={user.id}
      initial={BLANK_REQUEST}
      serverDraft={serverDraft}
      requirementGroups={requirementGroups}
    />
  );
}
