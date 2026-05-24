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
