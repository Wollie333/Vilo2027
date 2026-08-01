import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/admin";
import { requirePermission } from "@/lib/admin/requirePermission";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLead } from "@/lib/pipeline/queries";

import { LeadRecordClient } from "./_components/LeadRecordClient";

export const dynamic = "force-dynamic";

export default async function LeadRecordPage({
  params,
}: {
  params: { leadId: string };
}) {
  await requirePermission("pipeline.view");
  const admin = await requireAdmin();
  const lead = await getLead(params.leadId);
  if (!lead) notFound();

  const { data: me } = await createAdminClient()
    .from("user_profiles")
    .select("full_name")
    .eq("id", admin.userId)
    .maybeSingle();

  return (
    <LeadRecordClient
      lead={lead}
      currentStaff={{
        id: admin.userId,
        name: me?.full_name || admin.email,
      }}
    />
  );
}
