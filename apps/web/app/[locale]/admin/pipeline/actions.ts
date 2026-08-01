"use server";

import { requireAdmin } from "@/lib/admin";
import { requirePermission } from "@/lib/admin/requirePermission";
import { withAdminAudit } from "@/lib/admin/withAdminAudit";
import { createAdminClient } from "@/lib/supabase/admin";

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
      .select("label, is_won, is_lost, is_customer")
      .eq("id", a.stageId)
      .maybeSingle();
    if (!stage) throw new Error("Unknown stage.");
    // Customer stages (Trial + Won) are SYSTEM-driven: a card lands there only
    // when the host actually starts a trial or pays (DB triggers). Block manual
    // drags in so the board can't claim a customer who isn't one.
    if (stage.is_customer) {
      throw new Error(
        "Trial and Won are set automatically when a lead starts a trial or pays — you can't move a card here manually.",
      );
    }
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

export const sendLeadEmailAction = withAdminAudit<
  { leadId: string; subject: string; body: string; reason?: string },
  { ok: true }
>(
  {
    permissionKey: "pipeline.manage",
    actionName: "pipeline.send_email",
    targetType: "pipeline",
    getTargetId: (a) => a.leadId,
  },
  async (a, service) => {
    const ctx = await requireAdmin();
    const subject = a.subject.trim();
    const body = a.body.trim();
    if (!subject) throw new Error("Add a subject.");
    if (!body) throw new Error("The email is empty.");

    const { data: lead } = await service
      .from("pipeline_leads")
      .select("id, user_profiles(email, full_name)")
      .eq("id", a.leadId)
      .maybeSingle();
    const prof = lead?.user_profiles as {
      email?: string;
      full_name?: string;
    } | null;
    const to = prof?.email?.trim().toLowerCase();
    if (!to) throw new Error("This lead has no email address.");

    // Plain, safe HTML: escape the admin's text and keep paragraph breaks.
    const esc = (s: string) =>
      s.replace(
        /[<>&]/g,
        (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c,
      );
    const html = `${esc(body)
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
      .join(
        "",
      )}<p style="color:#6b7280;font-size:12px">Sent by the Wielo team.</p>`;

    const { sendTransactionalEmail } = await import("@/lib/email/send");
    await sendTransactionalEmail({ to, subject, html });

    const { data: after, error } = await service
      .from("pipeline_activities")
      .insert({
        lead_id: a.leadId,
        staff_id: ctx.userId,
        kind: "email_sent",
        body: `Email sent: ${subject.slice(0, 160)}`,
        meta: { subject, manual: true },
      })
      .select("id")
      .single();
    if (error || !after)
      throw new Error(error?.message ?? "Couldn't log send.");
    await service
      .from("pipeline_leads")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", a.leadId);
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

// ─── Delete lead ──────────────────────────────────────────────────────

/**
 * Delete a pipeline lead. The CRM card + everything hanging off it
 * (activities, tasks, file rows, nurture enrolments — all FK ON DELETE CASCADE)
 * is always removed, along with the stored file objects (storage doesn't cascade
 * with the DB rows). The underlying guest `user_profiles` account is KEPT unless
 * `deleteGuest` is set — in which case it's SOFT-deleted (recoverable, 30-day
 * hold), and that stronger action is separately gated on `users.delete` so a
 * pipeline-only operator can't remove accounts.
 */
export const deleteLeadAction = withAdminAudit<
  { leadId: string; deleteGuest?: boolean; reason?: string },
  { ok: true; deletedGuest: boolean }
>(
  {
    permissionKey: "pipeline.manage",
    actionName: "pipeline.delete_lead",
    targetType: "pipeline",
    getTargetId: (a) => a.leadId,
  },
  async (a, service) => {
    // Deleting the guest account is a heavier right than managing the pipeline.
    if (a.deleteGuest) await requirePermission("users.delete");

    // Resolve the lead + its guest identity before the card is gone.
    const { data: lead } = await service
      .from("pipeline_leads")
      .select("id, user_id, status, pipeline_stages(is_customer)")
      .eq("id", a.leadId)
      .maybeSingle();
    if (!lead) throw new Error("Lead not found.");
    // Customer-lock: a card in a customer stage (Trial or Won) is a real
    // customer and can't be deleted.
    const leadStage = lead.pipeline_stages as { is_customer?: boolean } | null;
    if (leadStage?.is_customer || lead.status === "won") {
      throw new Error(
        "This lead is a customer (Trial or Won) and can't be deleted.",
      );
    }

    // Storage objects aren't cascaded by the DB — remove them first.
    const { data: fileRows } = await service
      .from("pipeline_files")
      .select("path")
      .eq("lead_id", a.leadId);
    const paths = (fileRows ?? [])
      .map((f) => f.path)
      .filter((p): p is string => Boolean(p));
    if (paths.length) {
      await service.storage.from("pipeline-files").remove(paths);
    }

    // Delete the CRM card. FK ON DELETE CASCADE clears activities, tasks,
    // file rows and nurture enrolments in the same statement.
    const { error: delErr } = await service
      .from("pipeline_leads")
      .delete()
      .eq("id", a.leadId);
    if (delErr) throw new Error(delErr.message);

    // Optionally soft-delete the guest account behind the lead (recoverable).
    const deletedGuest = Boolean(a.deleteGuest && lead.user_id);
    if (deletedGuest) {
      const { softDeleteUserAccount } =
        await import("@/lib/users/accountLifecycle");
      await softDeleteUserAccount(service, lead.user_id);
    }

    return {
      result: { ok: true as const, deletedGuest },
      after: { id: a.leadId, user_id: lead.user_id, deletedGuest },
    };
  },
);

// ─── Tasks ────────────────────────────────────────────────────────────

export const addLeadTaskAction = withAdminAudit<
  { leadId: string; title: string; dueAt?: string | null; reason?: string },
  { ok: true }
>(
  {
    permissionKey: "pipeline.manage",
    actionName: "pipeline.add_task",
    targetType: "pipeline",
    getTargetId: (a) => a.leadId,
  },
  async (a, service) => {
    const ctx = await requireAdmin();
    const title = a.title.trim();
    if (!title) throw new Error("Give the task a title.");
    const { data: after, error } = await service
      .from("pipeline_tasks")
      .insert({
        lead_id: a.leadId,
        title: title.slice(0, 200),
        due_at: a.dueAt || null,
        assignee_staff_id: ctx.userId,
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error || !after)
      throw new Error(error?.message ?? "Couldn't add task.");
    await service
      .from("pipeline_leads")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", a.leadId);
    return { result: { ok: true as const }, after };
  },
);

export const toggleLeadTaskAction = withAdminAudit<
  { leadId: string; taskId: string; done: boolean; reason?: string },
  { ok: true }
>(
  {
    permissionKey: "pipeline.manage",
    actionName: "pipeline.toggle_task",
    targetType: "pipeline",
    getTargetId: (a) => a.leadId,
  },
  async (a, service) => {
    const { data: after, error } = await service
      .from("pipeline_tasks")
      .update({
        status: a.done ? "done" : "open",
        completed_at: a.done ? new Date().toISOString() : null,
      })
      .eq("id", a.taskId)
      .eq("lead_id", a.leadId)
      .select("id")
      .single();
    if (error || !after) throw new Error(error?.message ?? "Update failed.");
    return { result: { ok: true as const }, after };
  },
);

export const deleteLeadTaskAction = withAdminAudit<
  { leadId: string; taskId: string; reason?: string },
  { ok: true }
>(
  {
    permissionKey: "pipeline.manage",
    actionName: "pipeline.delete_task",
    targetType: "pipeline",
    getTargetId: (a) => a.leadId,
  },
  async (a, service) => {
    const { error } = await service
      .from("pipeline_tasks")
      .delete()
      .eq("id", a.taskId)
      .eq("lead_id", a.leadId);
    if (error) throw new Error(error.message);
    return { result: { ok: true as const }, after: { id: a.taskId } };
  },
);

// ─── Files ────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 26_214_400; // 25 MB (matches the bucket limit)

/** Sanitise a filename to a storage-safe token (keep the extension readable). */
function safeName(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[^\w.\- ]+/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 120) || "file"
  );
}

/**
 * Mint a signed direct-to-storage upload URL for a lead attachment. Direct upload
 * (not through the server action body) because Vercel functions cap the request
 * body well below the 25 MB file limit. Gated on pipeline.manage; no DB write yet —
 * confirmLeadFileAction records the row once the browser PUT succeeds.
 */
export async function createLeadFileUploadAction(input: {
  leadId: string;
  name: string;
  size: number;
}): Promise<
  { ok: true; uploadUrl: string; path: string } | { ok: false; error: string }
> {
  await requirePermission("pipeline.manage");
  if (!input.leadId) return { ok: false, error: "Missing lead." };
  if (input.size > MAX_FILE_BYTES) {
    return { ok: false, error: "That file is over the 25 MB limit." };
  }
  const admin = createAdminClient();
  const path = `${input.leadId}/${crypto.randomUUID()}-${safeName(input.name)}`;
  const { data, error } = await admin.storage
    .from("pipeline-files")
    .createSignedUploadUrl(path);
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Couldn't start the upload." };
  }
  return { ok: true, uploadUrl: data.signedUrl, path };
}

export const confirmLeadFileAction = withAdminAudit<
  {
    leadId: string;
    path: string;
    name: string;
    size: number;
    mime?: string | null;
    reason?: string;
  },
  { ok: true }
>(
  {
    permissionKey: "pipeline.manage",
    actionName: "pipeline.add_file",
    targetType: "pipeline",
    getTargetId: (a) => a.leadId,
  },
  async (a, service) => {
    const ctx = await requireAdmin();
    const { data: after, error } = await service
      .from("pipeline_files")
      .insert({
        lead_id: a.leadId,
        name: a.name.slice(0, 200),
        path: a.path,
        size_bytes: a.size,
        mime: a.mime || null,
        uploaded_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error || !after)
      throw new Error(error?.message ?? "Couldn't save file.");
    await service.from("pipeline_activities").insert({
      lead_id: a.leadId,
      staff_id: ctx.userId,
      kind: "note",
      body: `File attached: ${a.name.slice(0, 160)}`,
      meta: { file_id: after.id },
    });
    await service
      .from("pipeline_leads")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", a.leadId);
    return { result: { ok: true as const }, after };
  },
);

export const deleteLeadFileAction = withAdminAudit<
  { leadId: string; fileId: string; reason?: string },
  { ok: true }
>(
  {
    permissionKey: "pipeline.manage",
    actionName: "pipeline.delete_file",
    targetType: "pipeline",
    getTargetId: (a) => a.leadId,
  },
  async (a, service) => {
    const { data: file } = await service
      .from("pipeline_files")
      .select("path")
      .eq("id", a.fileId)
      .eq("lead_id", a.leadId)
      .maybeSingle();
    if (file?.path) {
      await service.storage.from("pipeline-files").remove([file.path]);
    }
    const { error } = await service
      .from("pipeline_files")
      .delete()
      .eq("id", a.fileId)
      .eq("lead_id", a.leadId);
    if (error) throw new Error(error.message);
    return { result: { ok: true as const }, after: { id: a.fileId } };
  },
);
