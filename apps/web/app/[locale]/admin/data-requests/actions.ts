"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";

const completeSchema = z.object({
  requestId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

const rejectSchema = z.object({
  requestId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

const processingSchema = z.object({
  requestId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export const markProcessingAction = withAdminAudit<
  z.infer<typeof processingSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.suspend",
    actionName: "data_request.mark_processing",
    targetType: "user",
    getTargetId: (a) => a.requestId,
    requireReason: true,
  },
  async (args, service) => {
    const { error, data } = await service
      .from("data_requests")
      .update({ status: "processing" })
      .eq("id", args.requestId)
      .select("id, status, request_type, user_id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/data-requests");
    return { result: { ok: true }, after: data };
  },
);

export const markCompleteAction = withAdminAudit<
  z.infer<typeof completeSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.suspend",
    actionName: "data_request.complete",
    targetType: "user",
    getTargetId: (a) => a.requestId,
    requireReason: true,
  },
  async (args, service) => {
    const { error, data } = await service
      .from("data_requests")
      .update({
        status: "completed",
        fulfilled_at: new Date().toISOString(),
      })
      .eq("id", args.requestId)
      .select("id, status, request_type, user_id, fulfilled_at")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/data-requests");
    return { result: { ok: true }, after: data };
  },
);

export const rejectRequestAction = withAdminAudit<
  z.infer<typeof rejectSchema>,
  { ok: true }
>(
  {
    permissionKey: "users.suspend",
    actionName: "data_request.reject",
    targetType: "user",
    getTargetId: (a) => a.requestId,
    requireReason: true,
  },
  async (args, service) => {
    const { error, data } = await service
      .from("data_requests")
      .update({
        status: "rejected",
        rejected_reason: args.reason,
        fulfilled_at: new Date().toISOString(),
      })
      .eq("id", args.requestId)
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/data-requests");
    return { result: { ok: true }, after: data };
  },
);

export async function markProcessing(input: {
  requestId: string;
  reason: string;
}) {
  const parsed = processingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  try {
    await markProcessingAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export async function markComplete(input: {
  requestId: string;
  reason: string;
}) {
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  try {
    await markCompleteAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export async function rejectRequest(input: {
  requestId: string;
  reason: string;
}) {
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  try {
    await rejectRequestAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

// ── REAL fulfilment: export (generate data) + deletion (hybrid) ──

/** Gather a user's personal data for a POPIA/GDPR export. Defensive: each
 *  section is best-effort so a missing column never breaks the whole export. */
async function buildUserExport(
  service: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  userId: string,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    user_id: userId,
  };
  const grab = async (
    key: string,
    run: () => PromiseLike<{ data: unknown }>,
  ) => {
    try {
      const { data } = await run();
      out[key] = data ?? null;
    } catch {
      out[key] = null;
    }
  };
  await grab("profile", () =>
    service.from("user_profiles").select("*").eq("id", userId).maybeSingle(),
  );
  await grab("bookings", () =>
    service.from("bookings").select("*").eq("guest_id", userId),
  );
  await grab("reviews", () =>
    service.from("reviews").select("*").eq("guest_id", userId),
  );
  await grab("host", () =>
    service.from("hosts").select("*").eq("user_id", userId).maybeSingle(),
  );
  return out;
}

export const fulfillExportAction = withAdminAudit<
  z.infer<typeof completeSchema>,
  { ok: true; json: string; filename: string }
>(
  {
    permissionKey: "users.suspend",
    actionName: "data_request.export_fulfilled",
    targetType: "user",
    getTargetId: (a) => a.requestId,
    requireReason: true,
  },
  async (args, service) => {
    const { data: req } = await service
      .from("data_requests")
      .select("user_id, request_type")
      .eq("id", args.requestId)
      .single();
    if (!req || req.request_type !== "export")
      throw new Error("Not an export request.");

    const exportData = await buildUserExport(service, req.user_id);
    const json = JSON.stringify(exportData, null, 2);

    await service
      .from("data_requests")
      .update({ status: "completed", fulfilled_at: new Date().toISOString() })
      .eq("id", args.requestId);

    return {
      result: {
        ok: true,
        json,
        filename: `data-export-${req.user_id}.json`,
      },
      after: { request_id: args.requestId, bytes: json.length },
    };
  },
);

export async function fulfillExport(input: {
  requestId: string;
  reason: string;
}) {
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input." };
  try {
    const res = await fulfillExportAction(parsed.data);
    revalidatePath("/admin/data-requests");
    return { ok: true as const, json: res.json, filename: res.filename };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export const fulfillDeletionAction = withAdminAudit<
  z.infer<typeof completeSchema>,
  { ok: true; method: "hard_deleted" | "anonymized" }
>(
  {
    permissionKey: "users.suspend",
    actionName: "data_request.deletion_fulfilled",
    targetType: "user",
    getTargetId: (a) => a.requestId,
    requireReason: true,
  },
  async (args, service) => {
    const { data: req } = await service
      .from("data_requests")
      .select("user_id, request_type")
      .eq("id", args.requestId)
      .single();
    if (!req || req.request_type !== "deletion")
      throw new Error("Not a deletion request.");
    const userId = req.user_id;

    // Try a clean hard delete first (cascades the user + any clean child rows,
    // INCLUDING this data_requests row). If RESTRICT FKs block it — bookings /
    // invoices / payments / audit history — fall back to anonymisation, which
    // satisfies erasure while keeping accounting + audit records intact.
    const { error: delErr } = await service.auth.admin.deleteUser(userId);
    if (!delErr) {
      return {
        result: { ok: true, method: "hard_deleted" },
        after: { user_id: userId, method: "hard_deleted" },
      };
    }

    const anonEmail = `deleted+${userId}@deleted.invalid`;
    await service
      .from("user_profiles")
      .update({
        full_name: "Deleted user",
        email: anonEmail,
        phone: null,
        avatar_url: null,
        is_active: false,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", userId);
    // Scrub the auth identity too (email + metadata).
    try {
      await service.auth.admin.updateUserById(userId, {
        email: anonEmail,
        user_metadata: {},
      });
    } catch {
      // non-blocking — the profile is already de-identified
    }
    await service
      .from("data_requests")
      .update({ status: "completed", fulfilled_at: new Date().toISOString() })
      .eq("id", args.requestId);

    return {
      result: { ok: true, method: "anonymized" },
      after: { user_id: userId, method: "anonymized" },
    };
  },
);

export async function fulfillDeletion(input: {
  requestId: string;
  reason: string;
}) {
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input." };
  try {
    const res = await fulfillDeletionAction(parsed.data);
    revalidatePath("/admin/data-requests");
    return { ok: true as const, method: res.method };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}
