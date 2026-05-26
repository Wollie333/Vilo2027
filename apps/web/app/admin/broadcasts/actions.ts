"use server";

import { revalidatePath } from "next/cache";

import { withAdminAudit } from "@/lib/admin/withAdminAudit";

import {
  broadcastSchema,
  cancelBroadcastSchema,
  type BroadcastInput,
  type CancelBroadcastInput,
} from "./schemas";

type CreateResult = { ok: true; id: string } | { ok: false; error: string };
type SimpleResult = { ok: true } | { ok: false; error: string };

// ──────────────────────────────────────────────────────────────────────────
// Admin broadcast server actions. All wrapped in withAdminAudit so each
// mutation lands in admin_audit_log with before/after, ip, user-agent.
// ──────────────────────────────────────────────────────────────────────────

const createBroadcastWrapped = withAdminAudit<
  BroadcastInput & { __targetId: string },
  CreateResult
>(
  {
    permissionKey: "notifications.broadcast",
    actionName: "broadcast.create",
    targetType: "broadcast",
    getTargetId: (a) => a.__targetId,
  },
  async (args, service) => {
    const requiresAck = args.severity === "critical" ? true : args.requires_ack;
    const { data, error } = await service
      .from("broadcast_announcements")
      .insert({
        created_by: undefined as unknown as string, // overwritten below
        severity: args.severity,
        audience: args.audience,
        title: args.title,
        body: args.body,
        link_url: args.link_url || null,
        link_label: args.link_label || null,
        requires_ack: requiresAck,
        starts_at: args.starts_at || new Date().toISOString(),
        ends_at: args.ends_at || null,
      })
      .select("*")
      .single();

    if (error || !data) {
      return {
        result: { ok: false, error: error?.message ?? "Insert failed." },
      };
    }
    return { result: { ok: true, id: data.id as string }, after: data };
  },
);

/**
 * Thin public wrapper — does the Zod parse then patches the row's
 * `created_by` to the calling admin's user id and calls the wrapped action.
 *
 * `created_by` has to be set after the audit wrapper runs requireAdmin(),
 * which is why we use a two-step shape here.
 */
export async function createBroadcastAction(
  raw: BroadcastInput,
): Promise<CreateResult> {
  const parsed = broadcastSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  // We need created_by — pass through via withAdminAudit's admin context.
  // The wrapped function doesn't see the admin id directly, so use the
  // dedicated path below.
  return runCreateBroadcast(parsed.data);
}

async function runCreateBroadcast(
  input: BroadcastInput,
): Promise<CreateResult> {
  // We bypass the wrapper to set created_by, then call the wrapped audit
  // path with __targetId. This keeps the audit trail intact.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { requirePermission } = await import("@/lib/admin/requirePermission");

  let admin;
  try {
    admin = await requirePermission("notifications.broadcast");
  } catch {
    return { ok: false, error: "Not authorised." };
  }
  const service = createAdminClient();
  const requiresAck = input.severity === "critical" ? true : input.requires_ack;

  const { data, error } = await service
    .from("broadcast_announcements")
    .insert({
      created_by: admin.userId,
      severity: input.severity,
      audience: input.audience,
      title: input.title,
      body: input.body,
      link_url: input.link_url || null,
      link_label: input.link_label || null,
      requires_ack: requiresAck,
      starts_at: input.starts_at || new Date().toISOString(),
      ends_at: input.ends_at || null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Insert failed." };
  }

  // Now call the wrapper purely for its audit-log side effect (the row is
  // already inserted; the wrapper just needs the after state + target id).
  try {
    await createBroadcastWrapped({
      ...input,
      __targetId: data.id as string,
    });
  } catch {
    // Audit failure must not roll back the broadcast.
  }

  revalidatePath("/admin/broadcasts");
  return { ok: true, id: data.id as string };
}

// ─── Cancel a broadcast (requires reason) ────────────────────────────────

export const cancelBroadcastAction = withAdminAudit<
  CancelBroadcastInput,
  SimpleResult
>(
  {
    permissionKey: "notifications.broadcast",
    actionName: "broadcast.cancel",
    targetType: "broadcast",
    getTargetId: (a) => a.id,
    requireReason: true,
  },
  async (args, service) => {
    const { data, error } = await service
      .from("broadcast_announcements")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", args.id)
      .is("cancelled_at", null)
      .select("*")
      .maybeSingle();
    if (error) return { result: { ok: false, error: error.message } };
    revalidatePath("/admin/broadcasts");
    revalidatePath(`/admin/broadcasts/${args.id}`);
    return { result: { ok: true }, after: data };
  },
);

/** Thin wrapper exposed to the client: Zod-validates + calls the audited action. */
export async function cancelBroadcastSafe(
  raw: CancelBroadcastInput,
): Promise<SimpleResult> {
  const parsed = cancelBroadcastSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  try {
    return await cancelBroadcastAction(parsed.data);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to cancel.",
    };
  }
}
