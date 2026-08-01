import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/admin";
import { requirePermission } from "@/lib/admin/requirePermission";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLead, getLeadFiles, getLeadTasks } from "@/lib/pipeline/queries";

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

  const [{ data: me }, tasks, files] = await Promise.all([
    createAdminClient()
      .from("user_profiles")
      .select("full_name")
      .eq("id", admin.userId)
      .maybeSingle(),
    getLeadTasks(params.leadId),
    getLeadFiles(params.leadId),
  ]);

  return (
    <LeadRecordClient
      lead={lead}
      tasks={tasks}
      files={files}
      currentStaff={{
        id: admin.userId,
        name: me?.full_name || admin.email,
      }}
    />
  );
}
