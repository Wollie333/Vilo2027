"use server";

import { revalidatePath } from "next/cache";

import { requirePermission, withAdminAudit } from "@/lib/admin";
import { notifyAffiliatePayoutPaid } from "@/lib/affiliate/notify";
import { createAdminClient } from "@/lib/supabase/admin";

const PERMISSION = "subscriptions.edit" as const;

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// ─── Suspend / reactivate an affiliate ─────────────────────────────────────
export const setAffiliateStatusAction = withAdminAudit<
  { affiliateId: string; status: "active" | "suspended"; reason?: string },
  ActionResult
>(
  {
    permissionKey: PERMISSION,
    actionName: "affiliate.set_status",
    targetType: "affiliate",
    getTargetId: (a) => a.affiliateId,
  },
  async (args, service) => {
    const admin = await requirePermission(PERMISSION);
    const { error } = await service.rpc("set_affiliate_status", {
      p_affiliate_id: args.affiliateId,
      p_status: args.status,
      p_admin: admin.userId,
      p_reason: args.reason ?? null,
    });
    if (error) return { result: { ok: false, error: error.message } };
    revalidatePath("/admin/affiliates");
    return { result: { ok: true }, after: { status: args.status } };
  },
);

// ─── Payout settlement (approve / paid / reject) ────────────────────────────
export const settleAffiliatePayoutAction = withAdminAudit<
  {
    payoutId: string;
    action: "approve" | "paid" | "reject";
    reference?: string;
    reason?: string;
  },
  ActionResult
>(
  {
    permissionKey: PERMISSION,
    actionName: "affiliate.settle_payout",
    targetType: "affiliate_payout",
    getTargetId: (a) => a.payoutId,
  },
  async (args, service) => {
    const admin = await requirePermission(PERMISSION);
    const { data, error } = await service.rpc("settle_affiliate_payout", {
      p_payout_id: args.payoutId,
      p_action: args.action,
      p_admin: admin.userId,
      p_reference: args.reference ?? null,
      p_reason: args.reason ?? null,
    });
    if (error) return { result: { ok: false, error: error.message } };
    const res = data as { ok: boolean; error?: string };
    if (!res?.ok) {
      return {
        result: {
          ok: false,
          error: res?.error ?? "Could not update the payout.",
        },
      };
    }
    // Tell the affiliate their money is on the way once the payout is marked paid.
    if (args.action === "paid") {
      await notifyAffiliatePayoutPaid(service, args.payoutId);
    }
    revalidatePath("/admin/affiliates");
    return { result: { ok: true }, after: { action: args.action } };
  },
);

// ─── Affiliate terms (shown on the gated programme) ─────────────────────────
export const updateAffiliateTermsAction = withAdminAudit<
  { termsContent: string; termsVersion: string; reason?: string },
  ActionResult
>(
  {
    permissionKey: PERMISSION,
    actionName: "affiliate.update_terms",
    targetType: "affiliate_settings",
    getTargetId: () => "affiliate_settings",
  },
  async (args, service) => {
    const content = args.termsContent.trim();
    const version = args.termsVersion.trim() || "v1";
    if (!content) {
      return { result: { ok: false, error: "The terms can't be empty." } };
    }
    const { error } = await service
      .from("affiliate_settings")
      .update({
        terms_content: content,
        terms_version: version,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) return { result: { ok: false, error: error.message } };
    revalidatePath("/admin/affiliates/terms");
    revalidatePath("/portal/affiliates");
    return { result: { ok: true }, after: { version } };
  },
);

// ─── Program settings + per-method fees ─────────────────────────────────────
export const updateAffiliateSettingsAction = withAdminAudit<
  {
    cookieDays: number;
    holdDays: number;
    minPayoutThreshold: number;
    termsVersion: string;
    attributionModel: "first_click" | "last_click";
    reason?: string;
  },
  ActionResult
>(
  {
    permissionKey: PERMISSION,
    actionName: "affiliate.update_settings",
    targetType: "affiliate_settings",
    getTargetId: () => "affiliate_settings",
  },
  async (args, service) => {
    const { error } = await service
      .from("affiliate_settings")
      .update({
        cookie_days: Math.max(1, Math.round(args.cookieDays)),
        hold_days: Math.max(0, Math.round(args.holdDays)),
        min_payout_threshold: Math.max(0, Math.round(args.minPayoutThreshold)),
        terms_version: args.termsVersion.trim() || "v1",
        attribution_model: args.attributionModel,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) return { result: { ok: false, error: error.message } };
    revalidatePath("/admin/affiliates/settings");
    return { result: { ok: true }, after: args };
  },
);

export const updatePayoutFeeAction = withAdminAudit<
  {
    method: "eft" | "paystack" | "paypal";
    fixedFee: number;
    percentFee: number;
    capFee: number | null;
    reason?: string;
  },
  ActionResult
>(
  {
    permissionKey: PERMISSION,
    actionName: "affiliate.update_fee",
    targetType: "affiliate_settings",
    getTargetId: (a) => a.method,
  },
  async (args, service) => {
    const { error } = await service
      .from("affiliate_payout_fees")
      .update({
        fixed_fee: Math.max(0, args.fixedFee),
        percent_fee: Math.max(0, args.percentFee),
        cap_fee: args.capFee != null && args.capFee > 0 ? args.capFee : null,
        updated_at: new Date().toISOString(),
      })
      .eq("method", args.method);
    if (error) return { result: { ok: false, error: error.message } };
    revalidatePath("/admin/affiliates/settings");
    return { result: { ok: true }, after: args };
  },
);

// ─── Marketing assets ───────────────────────────────────────────────────────
// Admin upload via the service role. Banners are small; if an asset exceeds the
// ~4.5MB server-action body cap, switch to a browser→Storage direct upload.
export async function uploadMarketingAssetAction(
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requirePermission(PERMISSION);
  const service = createAdminClient();

  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "banner").trim();
  if (!(file instanceof File)) return { ok: false, error: "No file received." };
  if (!title) return { ok: false, error: "A title is required." };
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: "File is too large — max 10MB." };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${category}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await service.storage
    .from("marketing-assets")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: "Upload failed. Try again." };

  const { data: pub } = service.storage
    .from("marketing-assets")
    .getPublicUrl(path);

  const { error: insErr } = await service.from("marketing_assets").insert({
    title,
    description: description || null,
    category,
    file_path: path,
    file_url: pub.publicUrl,
    mime_type: file.type || null,
    created_by: admin.userId,
  });
  if (insErr)
    return { ok: false, error: "Saved the file but couldn't register it." };

  revalidatePath("/admin/affiliates/settings");
  return { ok: true };
}

export async function deleteMarketingAssetAction(
  id: string,
): Promise<ActionResult> {
  await requirePermission(PERMISSION);
  const service = createAdminClient();

  const { data: asset } = await service
    .from("marketing_assets")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  if (asset?.file_path) {
    await service.storage.from("marketing-assets").remove([asset.file_path]);
  }
  const { error } = await service
    .from("marketing_assets")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: "Could not delete the asset." };

  revalidatePath("/admin/affiliates/settings");
  return { ok: true };
}

// ─── Affiliate tiers (bonus % on top of the per-product base commission) ─────
export async function upsertAffiliateTierAction(input: {
  id?: string;
  name: string;
  minEarnings: number;
  bonusPercent: number;
}): Promise<ActionResult> {
  await requirePermission("subscriptions.edit");
  const name = input.name.trim();
  if (!name) return { ok: false, error: "A tier name is required." };
  const admin = createAdminClient();
  const row = {
    name,
    min_lifetime_earnings: Math.max(0, Number(input.minEarnings) || 0),
    bonus_percent: Math.max(0, Number(input.bonusPercent) || 0),
    updated_at: new Date().toISOString(),
  };
  const { error } = input.id
    ? await admin.from("affiliate_tiers").update(row).eq("id", input.id)
    : await admin.from("affiliate_tiers").insert(row);
  if (error) return { ok: false, error: "Could not save the tier." };
  revalidatePath("/admin/affiliates/settings");
  return { ok: true };
}

export async function deleteAffiliateTierAction(
  id: string,
): Promise<ActionResult> {
  await requirePermission("subscriptions.edit");
  const admin = createAdminClient();
  const { error } = await admin.from("affiliate_tiers").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the tier." };
  revalidatePath("/admin/affiliates/settings");
  return { ok: true };
}
