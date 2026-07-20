"use server";

import { revalidatePath } from "next/cache";

import { withAdminAudit } from "@/lib/admin";
import { BOARD_STATUSES, type BoardStatus } from "@/lib/buildBoard.shared";
import { createServerClient } from "@/lib/supabase/server";

const PERMISSION = "platform.settings" as const;

function isBoardStatus(v: string): v is BoardStatus {
  return (BOARD_STATUSES as readonly string[]).includes(v);
}

// Approve → publish (or unpublish) a request onto the public board.
export const setRequestPublishedAction = withAdminAudit<
  { id: string; isPublic: boolean; reason?: string },
  { ok: true }
>(
  {
    permissionKey: PERMISSION,
    actionName: "feature_request.set_published",
    targetType: "feature_request",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const { data, error } = await service
      .from("feature_requests")
      .update({ is_public: args.isPublic })
      .eq("id", args.id)
      .select("id, is_public, title")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/build-board");
    revalidatePath("/build");
    return { result: { ok: true }, after: data };
  },
);

// Change a request's roadmap status. Stamps shipped_at when moving to 'shipped'.
export const setRequestStatusAction = withAdminAudit<
  { id: string; status: string; reason?: string },
  { ok: true }
>(
  {
    permissionKey: PERMISSION,
    actionName: "feature_request.set_status",
    targetType: "feature_request",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    if (!isBoardStatus(args.status)) throw new Error("Invalid status.");
    const patch: Record<string, unknown> = { status: args.status };
    if (args.status === "shipped") {
      patch.shipped_at = new Date().toISOString();
    }
    const { data, error } = await service
      .from("feature_requests")
      .update(patch)
      .eq("id", args.id)
      .select("id, status, shipped_at, title")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/build-board");
    revalidatePath("/build");
    return { result: { ok: true }, after: data };
  },
);

// Merge a duplicate INTO a target: migrates votes, hides the source. The RPC is
// is_super_admin()-guarded, so it MUST run on the admin's own session client —
// not the service-role client (auth.uid() would be null there).
export const mergeRequestsAction = withAdminAudit<
  { sourceId: string; targetId: string; reason?: string },
  { ok: true }
>(
  {
    permissionKey: PERMISSION,
    actionName: "feature_request.merge",
    targetType: "feature_request",
    getTargetId: (a) => a.sourceId,
  },
  async (args) => {
    if (args.sourceId === args.targetId) {
      throw new Error("Pick a different target to merge into.");
    }
    const supabase = createServerClient();
    const { error } = await supabase.rpc("merge_feature_requests", {
      p_source: args.sourceId,
      p_target: args.targetId,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/build-board");
    revalidatePath("/build");
    return { result: { ok: true }, after: { merged: args } };
  },
);

// Hard-delete a request (pre-MVP: spam/junk submissions). Votes cascade.
export const deleteRequestAction = withAdminAudit<
  { id: string; reason?: string },
  { ok: true }
>(
  {
    permissionKey: PERMISSION,
    actionName: "feature_request.delete",
    targetType: "feature_request",
    getTargetId: (a) => a.id,
  },
  async (args, service) => {
    const { data, error } = await service
      .from("feature_requests")
      .delete()
      .eq("id", args.id)
      .select("id, title")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/build-board");
    revalidatePath("/build");
    return { result: { ok: true }, after: data };
  },
);
