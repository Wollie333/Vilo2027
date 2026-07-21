"use server";

import { revalidatePath } from "next/cache";

import { withAdminAudit } from "@/lib/admin";
import {
  campaignInputSchema,
  type CampaignInput,
} from "@/lib/affiliate/campaignConfig";
import { findFreeSlug } from "@/lib/affiliate/account";

// WS-1i — the campaign builder's writes. Campaign config drives REAL commission
// accrual, so every write is permission-gated, validated by the shared zod
// schema (never trusting the form) and audited with a before/after snapshot.

const PERMISSION = "subscriptions.edit" as const;

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const CAMPAIGN_COLS =
  "id, slug, name, status, starts_at, ends_at, eligible_partners, eligible_referrals, commission_structure, competition, rules_doc_slug";

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
        commission_structure: c.commission_structure,
        competition: c.competition,
        updated_at: new Date().toISOString(),
      })
      .eq("id", args.campaignId);
    if (error) return { result: { ok: false, error: error.message } };

    revalidatePath("/admin/affiliates/campaigns");
    revalidatePath(`/admin/affiliates/campaigns/${args.campaignId}`);
    revalidatePath(`/competitions/${c.slug}`);
    revalidatePath("/portal/affiliates/competitions");
    return { result: { ok: true }, after: c };
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
