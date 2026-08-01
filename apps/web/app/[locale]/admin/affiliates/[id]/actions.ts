"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/admin";
import { withAdminAudit } from "@/lib/admin/withAdminAudit";
import { createAdminClient } from "@/lib/supabase/admin";

// Reassign a mis-bound referral to another partner within the 30-day correction
// window (SoT §3.2 rule 5). The money-safety + window check live in the
// reassign_affiliate_referral RPC; this wrapper adds the permission gate and the
// audit row ("all reassignments are logged").

const schema = z.object({
  referralId: z.string().uuid(),
  newAffiliateSlug: z.string().trim().min(1, "Enter the partner code"),
  reason: z.string().trim().min(3, "Give a reason (min 3 characters)"),
});

export type ReassignInput = z.infer<typeof schema>;
type Result = { ok: true; moved: number } | { ok: false; error: string };

type WrappedArgs = ReassignInput & { reason: string; __targetId: string };

const wrapped = withAdminAudit<WrappedArgs, Result>(
  {
    permissionKey: "subscriptions.edit",
    actionName: "affiliate.reassign_referral",
    targetType: "affiliate",
    getTargetId: (a) => a.__targetId, // the partner GAINING the referral
    requireReason: true,
  },
  async (args, service) => {
    const { data, error } = await service
      .rpc("reassign_affiliate_referral", {
        p_referral_id: args.referralId,
        p_new_affiliate_id: args.__targetId,
      })
      .maybeSingle();
    if (error) {
      // Surface the RPC's human message (strip the "reassign: " prefix).
      return {
        result: {
          ok: false,
          error: error.message.replace(/^.*reassign:\s*/i, ""),
        },
        after: null,
      };
    }
    const { data: ref } = await service
      .from("affiliate_referrals")
      .select("id, affiliate_id, campaign_id")
      .eq("id", args.referralId)
      .maybeSingle();
    return {
      result: {
        ok: true,
        moved:
          (data as { moved_commissions?: number } | null)?.moved_commissions ??
          0,
      },
      after: ref,
    };
  },
);

export async function reassignReferralAction(
  input: ReassignInput,
): Promise<Result> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  // Gate BEFORE the service-role lookup below — otherwise an authenticated but
  // unpermissioned caller could probe partner-code existence/status. (The
  // mutation itself is also gated inside `wrapped`.)
  await requirePermission("subscriptions.edit");

  // Resolve the target partner code → id (used both as the audit target and the
  // RPC argument). A bad code fails here, before the permission-gated mutation.
  const admin = createAdminClient();
  const { data: aff } = await admin
    .from("affiliate_accounts")
    .select("id, status")
    .ilike("slug", parsed.data.newAffiliateSlug)
    .maybeSingle();
  if (!aff) return { ok: false, error: "No partner with that code" };
  if (aff.status !== "active") {
    return { ok: false, error: "That partner is not active" };
  }

  const result = await wrapped({ ...parsed.data, __targetId: aff.id });
  if (result.ok) revalidatePath("/admin/affiliates/[id]", "page");
  return result;
}
