"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withAdminAudit } from "@/lib/admin";

// Admin triage for Flagged Listings (listing_reports). Status flow:
//   open → reviewing → actioned | dismissed
// Every change is audited (targetType "listing", target = the report row —
// mirrors the data-requests audit convention) + stamps reviewed_by/at.

const reviewingSchema = z.object({
  reportId: z.string().uuid(),
  // Optional — mark-reviewing needs no reason, but the audit wrapper's args
  // type expects the field to exist. Not required (config omits requireReason).
  reason: z.string().optional(),
});
const resolveSchema = z.object({
  reportId: z.string().uuid(),
  reason: z.string().trim().min(5).max(1000),
});

async function callerUserId(): Promise<string | null> {
  const { requireAdmin } = await import("@/lib/admin");
  try {
    const { userId } = await requireAdmin();
    return userId;
  } catch {
    return null;
  }
}

export const markReviewingAction = withAdminAudit<
  z.infer<typeof reviewingSchema>,
  { ok: true }
>(
  {
    permissionKey: "listings.moderate",
    actionName: "listing_report.mark_reviewing",
    targetType: "listing",
    getTargetId: (a) => a.reportId,
  },
  async (args, service) => {
    const { error, data } = await service
      .from("listing_reports")
      .update({ status: "reviewing" })
      .eq("id", args.reportId)
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/flagged-listings");
    return { result: { ok: true }, after: data };
  },
);

export const actionReportAction = withAdminAudit<
  z.infer<typeof resolveSchema>,
  { ok: true }
>(
  {
    permissionKey: "listings.moderate",
    actionName: "listing_report.actioned",
    targetType: "listing",
    getTargetId: (a) => a.reportId,
    requireReason: true,
  },
  async (args, service) => {
    const { error, data } = await service
      .from("listing_reports")
      .update({
        status: "actioned",
        admin_note: args.reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: await callerUserId(),
      })
      .eq("id", args.reportId)
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/flagged-listings");
    return { result: { ok: true }, after: data };
  },
);

export const dismissReportAction = withAdminAudit<
  z.infer<typeof resolveSchema>,
  { ok: true }
>(
  {
    permissionKey: "listings.moderate",
    actionName: "listing_report.dismissed",
    targetType: "listing",
    getTargetId: (a) => a.reportId,
    requireReason: true,
  },
  async (args, service) => {
    const { error, data } = await service
      .from("listing_reports")
      .update({
        status: "dismissed",
        admin_note: args.reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: await callerUserId(),
      })
      .eq("id", args.reportId)
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/flagged-listings");
    return { result: { ok: true }, after: data };
  },
);

// Thin non-throwing wrappers for the client.
export async function markReviewing(input: { reportId: string }) {
  const parsed = reviewingSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input." };
  try {
    await markReviewingAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export async function actionReport(input: {
  reportId: string;
  reason: string;
}) {
  const parsed = resolveSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input." };
  try {
    await actionReportAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}

export async function dismissReport(input: {
  reportId: string;
  reason: string;
}) {
  const parsed = resolveSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input." };
  try {
    await dismissReportAction(parsed.data);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed.",
    };
  }
}
