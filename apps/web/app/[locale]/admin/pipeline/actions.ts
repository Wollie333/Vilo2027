"use server";

import { requireAdmin } from "@/lib/admin";
import { withAdminAudit } from "@/lib/admin/withAdminAudit";

// Audited mutations for the pipeline board + lead record. Each is gated on
// pipeline.manage and writes an admin_audit_log row + a pipeline_activities
// timeline entry (staff_id = the acting admin, which is a platform_staff.user_id).

export const moveLeadStageAction = withAdminAudit<
  { leadId: string; stageId: string; reason?: string },
  { ok: true }
>(
  {
    permissionKey: "pipeline.manage",
    actionName: "pipeline.move_stage",
    targetType: "pipeline",
    getTargetId: (a) => a.leadId,
  },
  async (a, service) => {
    const ctx = await requireAdmin();
    const { data: stage } = await service
      .from("pipeline_stages")
      .select("label, is_won, is_lost")
      .eq("id", a.stageId)
      .maybeSingle();
    if (!stage) throw new Error("Unknown stage.");
    const status = stage.is_won ? "won" : stage.is_lost ? "lost" : "open";
    const { data: after, error } = await service
      .from("pipeline_leads")
      .update({
        stage_id: a.stageId,
        status,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", a.leadId)
      .select("*")
      .single();
    if (error || !after) throw new Error(error?.message ?? "Move failed.");
    await service.from("pipeline_activities").insert({
      lead_id: a.leadId,
      staff_id: ctx.userId,
      kind: "stage_moved",
      body: `Moved to ${stage.label}.`,
      meta: { stage_id: a.stageId, status },
    });
    return { result: { ok: true as const }, after };
  },
);

export const setLeadOutcomeAction = withAdminAudit<
  { leadId: string; outcome: "won" | "lost"; reason?: string },
  { ok: true }
>(
  {
    permissionKey: "pipeline.manage",
    actionName: "pipeline.set_outcome",
    targetType: "pipeline",
    getTargetId: (a) => a.leadId,
  },
  async (a, service) => {
    const ctx = await requireAdmin();
    const { data: lead } = await service
      .from("pipeline_leads")
      .select("audience")
      .eq("id", a.leadId)
      .maybeSingle();
    if (!lead) throw new Error("Lead not found.");
    const flag = a.outcome === "won" ? "is_won" : "is_lost";
    const { data: stage } = await service
      .from("pipeline_stages")
      .select("id, label")
      .eq("audience", lead.audience)
      .eq(flag, true)
      .maybeSingle();
    if (!stage) throw new Error("No terminal stage configured.");
    const { data: after, error } = await service
      .from("pipeline_leads")
      .update({
        stage_id: stage.id,
        status: a.outcome,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", a.leadId)
      .select("*")
      .single();
    if (error || !after) throw new Error(error?.message ?? "Update failed.");
    await service.from("pipeline_activities").insert({
      lead_id: a.leadId,
      staff_id: ctx.userId,
      kind: a.outcome === "won" ? "converted" : "note",
      body: a.outcome === "won" ? "Marked won." : "Marked lost.",
      meta: { stage_id: stage.id, status: a.outcome },
    });
    return { result: { ok: true as const }, after };
  },
);

export const assignLeadOwnerAction = withAdminAudit<
  { leadId: string; ownerStaffId: string | null; reason?: string },
  { ok: true }
>(
  {
    permissionKey: "pipeline.manage",
    actionName: "pipeline.assign_owner",
    targetType: "pipeline",
    getTargetId: (a) => a.leadId,
  },
  async (a, service) => {
    const ctx = await requireAdmin();
    const { data: after, error } = await service
      .from("pipeline_leads")
      .update({
        owner_staff_id: a.ownerStaffId,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", a.leadId)
      .select("*")
      .single();
    if (error || !after) throw new Error(error?.message ?? "Assign failed.");
    let ownerName = "no one";
    if (a.ownerStaffId) {
      const { data: o } = await service
        .from("user_profiles")
        .select("full_name")
        .eq("id", a.ownerStaffId)
        .maybeSingle();
      ownerName = o?.full_name ?? "a teammate";
    }
    await service.from("pipeline_activities").insert({
      lead_id: a.leadId,
      staff_id: ctx.userId,
      kind: "note",
      body: `Owner set to ${ownerName}.`,
      meta: { owner_staff_id: a.ownerStaffId },
    });
    return { result: { ok: true as const }, after };
  },
);

export const addLeadNoteAction = withAdminAudit<
  {
    leadId: string;
    body: string;
    kind?: "note" | "call_logged";
    reason?: string;
  },
  { ok: true }
>(
  {
    permissionKey: "pipeline.manage",
    actionName: "pipeline.add_note",
    targetType: "pipeline",
    getTargetId: (a) => a.leadId,
  },
  async (a, service) => {
    const ctx = await requireAdmin();
    const body = a.body.trim();
    if (!body) throw new Error("Note can't be empty.");
    const { data: after, error } = await service
      .from("pipeline_activities")
      .insert({
        lead_id: a.leadId,
        staff_id: ctx.userId,
        kind: a.kind === "call_logged" ? "call_logged" : "note",
        body: body.slice(0, 4000),
        meta: {},
      })
      .select("id")
      .single();
    if (error || !after) throw new Error(error?.message ?? "Couldn't save.");
    await service
      .from("pipeline_leads")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", a.leadId);
    return { result: { ok: true as const }, after };
  },
);
