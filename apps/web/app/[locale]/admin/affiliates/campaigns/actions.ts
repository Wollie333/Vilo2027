"use server";

import { revalidatePath } from "next/cache";

import { requirePermission, withAdminAudit } from "@/lib/admin";
import { notifyCampaignPauseChanged } from "@/lib/affiliate/notify";
import {
  campaignInputSchema,
  type CampaignInput,
} from "@/lib/affiliate/campaignConfig";
import { findFreeSlug } from "@/lib/affiliate/account";
import { sanitiseListingHtml } from "@/lib/sanitiseHtml";

// WS-1i — the campaign builder's writes. Campaign config drives REAL commission
// accrual, so every write is permission-gated, validated by the shared zod
// schema (never trusting the form) and audited with a before/after snapshot.

const PERMISSION = "subscriptions.edit" as const;

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const CAMPAIGN_COLS =
  "id, slug, name, status, starts_at, ends_at, eligible_partners, eligible_referrals, commission_structure, competition, rules_doc_slug, max_participants";

/** Create a DRAFT campaign. A campaign is never born live — the founder
 *  configures the ladder and prizes first, then launches it explicitly. */
export const createCampaignAction = withAdminAudit<
  { name: string; slug: string; reason?: string },
  ActionResult<{ id: string }>
>(
  {
    permissionKey: PERMISSION,
    actionName: "affiliate.campaign_create",
    targetType: "affiliate_campaign",
    // The row does not exist yet; the audit row is keyed on the slug we mint.
    getTargetId: (a) => a.slug,
  },
  async (args, service) => {
    const name = args.name.trim();
    const slug = args.slug.trim().toLowerCase();
    if (name.length < 2) {
      return { result: { ok: false, error: "Give the campaign a name." } };
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      return {
        result: {
          ok: false,
          error: "The link uses lowercase letters, numbers and dashes only.",
        },
      };
    }

    const { data: clash } = await service
      .from("affiliate_campaigns")
      .select("id")
      .ilike("slug", slug)
      .maybeSingle();
    if (clash) {
      return {
        result: { ok: false, error: "That link is already taken." },
      };
    }

    const { data, error } = await service
      .from("affiliate_campaigns")
      .insert({
        name,
        slug,
        status: "draft",
        eligible_partners: "all",
        eligible_referrals: "activated_in_window",
        // A safe, inert starting point: no rungs, nothing public, pays nothing
        // until the founder fills it in and launches.
        commission_structure: { model: "inherit" },
        competition: { leaderboard_visibility: "hidden" },
      })
      .select("id")
      .single();
    if (error || !data) {
      return {
        result: { ok: false, error: error?.message ?? "Could not create it." },
      };
    }

    revalidatePath("/admin/affiliates/campaigns");
    return {
      result: { ok: true, data: { id: data.id } },
      after: { id: data.id, slug, name, status: "draft" },
    };
  },
);

/** Save the whole campaign config. Validated server-side by the shared schema. */
export const updateCampaignAction = withAdminAudit<
  { campaignId: string; input: CampaignInput; reason?: string },
  ActionResult
>(
  {
    permissionKey: PERMISSION,
    actionName: "affiliate.campaign_update",
    targetType: "affiliate_campaign",
    getTargetId: (a) => a.campaignId,
    captureBefore: async (service, a) => {
      const { data } = await service
        .from("affiliate_campaigns")
        .select(CAMPAIGN_COLS)
        .eq("id", a.campaignId)
        .maybeSingle();
      return data;
    },
  },
  async (args, service) => {
    const parsed = campaignInputSchema.safeParse(args.input);
    if (!parsed.success) {
      return {
        result: {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Some fields look wrong.",
        },
      };
    }
    const c = parsed.data;

    // Slug is the public leaderboard URL — it must stay unique.
    const { data: clash } = await service
      .from("affiliate_campaigns")
      .select("id")
      .ilike("slug", c.slug)
      .neq("id", args.campaignId)
      .maybeSingle();
    if (clash) {
      return { result: { ok: false, error: "That link is already taken." } };
    }

    const { error } = await service
      .from("affiliate_campaigns")
      .update({
        name: c.name,
        slug: c.slug,
        status: c.status,
        starts_at: c.starts_at,
        ends_at: c.ends_at,
        eligible_partners: c.eligible_partners,
        eligible_referrals: c.eligible_referrals,
        rules_doc_slug: c.rules_doc_slug || null,
        max_participants: c.max_participants,
        commission_structure: c.commission_structure,
        competition: c.competition,
        updated_at: new Date().toISOString(),
      })
      .eq("id", args.campaignId);
    if (error) {
      // The capacity trigger has no say on a campaign UPDATE, but lowering the
      // cap below the number already enrolled is a foot-gun worth naming.
      return { result: { ok: false, error: error.message } };
    }

    revalidatePath("/admin/affiliates/campaigns");
    revalidatePath(`/admin/affiliates/campaigns/${args.campaignId}`);
    revalidatePath(`/competitions/${c.slug}`);
    revalidatePath("/portal/affiliates/competitions");
    return { result: { ok: true }, after: c };
  },
);

/**
 * Author the campaign's RULES document from the builder and publish it live at
 * /legal/<slug>, then point the campaign at it. Reuses the WS-6a legal-documents
 * pipeline (sanitise on write, version bumps only on a real body change) so the
 * rules sit at the fixed retained URL the CPA requires — and so the version a
 * partner accepts on entry is a real, addressable thing.
 */
export const saveCampaignRulesAction = withAdminAudit<
  {
    campaignId: string;
    slug: string;
    title: string;
    html: string;
    reason?: string;
  },
  ActionResult<{ slug: string; version: number }>
>(
  {
    permissionKey: PERMISSION,
    actionName: "affiliate.campaign_save_rules",
    targetType: "affiliate_campaign",
    getTargetId: (a) => a.campaignId,
    captureBefore: async (service, a) => {
      const { data } = await service
        .from("affiliate_campaigns")
        .select("rules_doc_slug")
        .eq("id", a.campaignId)
        .maybeSingle();
      return data;
    },
  },
  async (args, service) => {
    const slug = args.slug.trim().toLowerCase();
    const title = args.title.trim();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      return {
        result: {
          ok: false,
          error: "The rules link uses lowercase letters, numbers and dashes.",
        },
      };
    }
    if (title.length < 2) {
      return { result: { ok: false, error: "Give the rules a title." } };
    }
    const cleaned =
      args.html.trim().length > 0 ? sanitiseListingHtml(args.html) : null;
    if (!cleaned) {
      return {
        result: {
          ok: false,
          error: "Write the rules before publishing them.",
        },
      };
    }

    const { data: existing } = await service
      .from("legal_documents")
      .select("body_html, version, is_published, published_at")
      .eq("slug", slug)
      .maybeSingle();

    // Version bumps ONLY on a real body change — the version number is what a
    // partner's entry signature is keyed on, so it must not drift on a no-op save.
    const prevVersion =
      typeof existing?.version === "number" ? existing.version : 0;
    const bodyChanged = cleaned !== (existing?.body_html ?? null);
    const version = existing
      ? bodyChanged
        ? prevVersion + 1
        : prevVersion
      : 1;

    const nowIso = new Date().toISOString();
    const becamePublished = !existing?.is_published;
    const publishedAt =
      bodyChanged || becamePublished || !existing?.published_at
        ? nowIso
        : existing.published_at;

    const { error: docError } = await service.from("legal_documents").upsert(
      {
        slug,
        title,
        body_html: cleaned,
        version,
        is_published: true,
        published_at: publishedAt,
        updated_at: nowIso,
      },
      { onConflict: "slug" },
    );
    if (docError) return { result: { ok: false, error: docError.message } };

    const { error: linkError } = await service
      .from("affiliate_campaigns")
      .update({ rules_doc_slug: slug, updated_at: nowIso })
      .eq("id", args.campaignId);
    if (linkError) return { result: { ok: false, error: linkError.message } };

    revalidatePath(`/legal/${slug}`);
    revalidatePath(`/admin/affiliates/campaigns/${args.campaignId}`);
    revalidatePath("/portal/affiliates/competitions");
    return {
      result: { ok: true, data: { slug, version } },
      after: { slug, version },
    };
  },
);

/** Launch / pause / end a campaign without touching its config. */
export const setCampaignStatusAction = withAdminAudit<
  {
    campaignId: string;
    status: "draft" | "active" | "ended" | "archived";
    reason?: string;
  },
  ActionResult
>(
  {
    permissionKey: PERMISSION,
    actionName: "affiliate.campaign_set_status",
    targetType: "affiliate_campaign",
    getTargetId: (a) => a.campaignId,
    captureBefore: async (service, a) => {
      const { data } = await service
        .from("affiliate_campaigns")
        .select("status, slug")
        .eq("id", a.campaignId)
        .maybeSingle();
      return data;
    },
  },
  async (args, service) => {
    // Going live is the one transition that starts paying campaign rates, so it
    // is refused unless the structure actually resolves to something payable.
    if (args.status === "active") {
      const { data: campaign } = await service
        .from("affiliate_campaigns")
        .select("commission_structure")
        .eq("id", args.campaignId)
        .maybeSingle();
      const cs = (campaign?.commission_structure ?? {}) as {
        model?: string;
        bands?: { rate: number }[];
        flat_rate?: number;
      };
      const ladderPays =
        cs.model === "ladder" && (cs.bands ?? []).some((b) => b.rate > 0);
      const flatPays = cs.model === "flat" && (cs.flat_rate ?? 0) > 0;
      if (cs.model !== "inherit" && !ladderPays && !flatPays) {
        return {
          result: {
            ok: false,
            error:
              "Set up the commission structure before launching — as configured this campaign would pay nobody.",
          },
        };
      }
    }

    const { data, error } = await service
      .from("affiliate_campaigns")
      .update({ status: args.status, updated_at: new Date().toISOString() })
      .eq("id", args.campaignId)
      .select("slug")
      .single();
    if (error) return { result: { ok: false, error: error.message } };

    revalidatePath("/admin/affiliates/campaigns");
    revalidatePath(`/admin/affiliates/campaigns/${args.campaignId}`);
    if (data?.slug) revalidatePath(`/competitions/${data.slug}`);
    revalidatePath("/portal/affiliates/competitions");
    return { result: { ok: true }, after: { status: args.status } };
  },
);

// ─── Pause / resume a partner in a competition ─────────────────────────────
//
// Competition-scoped only, and deliberately narrower than the global
// `setAffiliateStatusAction` suspend in ../actions.ts. A paused partner:
//
//   * drops off the leaderboard and out of prize contention;
//   * KEEPS their referral links and their lifetime commission ladder — a
//     pause must never cost a partner money they have already earned;
//   * keeps accruing score quietly, so resuming shows their true standing.
//
// Reversible by design. 'withdrawn' (they left) and 'removed' (disqualified)
// are the terminal states and are not set from here.
export const setCampaignEnrollmentStatusAction = withAdminAudit<
  {
    campaignId: string;
    affiliateId: string;
    status: "active" | "paused";
    reason?: string;
  },
  ActionResult
>(
  {
    permissionKey: PERMISSION,
    actionName: "affiliate.campaign_enrollment_status",
    targetType: "affiliate_campaign_enrollment",
    // admin_audit_log.target_id is a uuid column — a composite "campaign:
    // affiliate" key silently lands as NULL. Key on the partner (the subject of
    // the action); the campaign id travels in the audited args either way.
    getTargetId: (a) => a.affiliateId,
  },
  async (args, service) => {
    const admin = await requirePermission(PERMISSION);
    const pausing = args.status === "paused";
    const reason = args.reason?.trim() || null;

    if (pausing && !reason) {
      // The reason is shown to the partner verbatim, so it is not optional.
      return {
        result: {
          ok: false,
          error: "Give a reason — the partner is shown it.",
        },
      };
    }

    const { data: before } = await service
      .from("affiliate_campaign_enrollments")
      .select("status")
      .eq("campaign_id", args.campaignId)
      .eq("affiliate_id", args.affiliateId)
      .maybeSingle();

    if (before && before.status !== "active" && before.status !== "paused") {
      // Don't quietly resurrect someone who withdrew or was disqualified.
      return {
        result: {
          ok: false,
          error: `That partner is ${before.status}, not taking part — pausing doesn't apply.`,
        },
      };
    }

    // Upsert rather than update: on an `eligible_partners = 'all'` campaign a
    // partner can be scoring on the leaderboard without ever having had an
    // enrollment row, and those are exactly the ones you may need to pause.
    const { error } = await service
      .from("affiliate_campaign_enrollments")
      .upsert(
        {
          campaign_id: args.campaignId,
          affiliate_id: args.affiliateId,
          status: args.status,
          paused_at: pausing ? new Date().toISOString() : null,
          paused_by: pausing ? admin.userId : null,
          paused_reason: pausing ? reason : null,
        },
        { onConflict: "affiliate_id,campaign_id" },
      );
    if (error) return { result: { ok: false, error: error.message } };

    await notifyCampaignPauseChanged(service, {
      campaignId: args.campaignId,
      affiliateId: args.affiliateId,
      paused: pausing,
      reason,
    });

    revalidatePath(`/admin/affiliates/campaigns/${args.campaignId}`);
    revalidatePath("/portal/affiliates/competitions");
    const { data: camp } = await service
      .from("affiliate_campaigns")
      .select("slug")
      .eq("id", args.campaignId)
      .maybeSingle();
    if (camp?.slug) {
      revalidatePath(`/competitions/${camp.slug}`);
      revalidatePath(`/portal/affiliates/race/${camp.slug}`);
    }

    return {
      result: { ok: true },
      before: { status: before?.status ?? null },
      after: { status: args.status, reason },
    };
  },
);

// Re-exported so the create form can suggest a free slug from the name without
// duplicating the slugify rules.
export async function suggestCampaignSlugAction(name: string): Promise<string> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  // findFreeSlug checks affiliate_accounts; campaigns live in their own table,
  // so only borrow the slugify + fallback shape, then check campaigns here.
  const base = (await findFreeSlug(admin, name)).replace(/-[a-z0-9]{5}$/, "");
  let candidate = base;
  for (let i = 2; i < 20; i++) {
    const { data } = await admin
      .from("affiliate_campaigns")
      .select("id")
      .ilike("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}
