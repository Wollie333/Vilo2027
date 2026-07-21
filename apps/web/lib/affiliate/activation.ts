import "server-only";

import { hasSignedVersion } from "@/lib/affiliate/agreement";
import { getPublishedLegalDocument } from "@/lib/legalDocuments";
import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Affiliate activation — the ONE place that decides whether a pending partner
 * may start referring.
 *
 * A public signup form creates the account in `pending`: it exists, but earns
 * nothing and appears on no leaderboard. It becomes `active` by clearing every
 * gate below, or by an admin activating it by hand.
 *
 * The gates cannot all be judged at submit time — email confirmation lands
 * minutes or hours later, when they click the link in their inbox. So activation
 * is RE-EVALUATED at every point a gate can close (signup submit, email-confirm
 * route, agreement signing, admin action) rather than decided once. Deciding it
 * at signup is how the email gate quietly becomes decorative.
 */
export type ActivationChecklist = {
  agreementSigned: boolean;
  platformTermsAccepted: boolean;
  emailConfirmed: boolean;
  /** True when there is no campaign, or its rules have been signed. */
  campaignRulesAccepted: boolean;
  /** The competition they signed up through, if any. */
  campaignId: string | null;
  ready: boolean;
};

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Report which activation gates a pending affiliate has cleared. Read-only —
 * safe to call for rendering the partner's "finish setup" checklist.
 */
export async function evaluateAffiliateActivation(
  admin: Admin,
  affiliateId: string,
): Promise<ActivationChecklist | null> {
  const { data: account } = await admin
    .from("affiliate_accounts")
    .select("id, user_id, status, signup_campaign_id")
    .eq("id", affiliateId)
    .maybeSingle();
  if (!account) return null;

  const [{ data: settings }, { data: profile }] = await Promise.all([
    admin
      .from("affiliate_settings")
      .select("terms_version")
      .eq("id", true)
      .maybeSingle(),
    admin
      .from("user_profiles")
      .select("terms_accepted_at, email_verified_at")
      .eq("id", account.user_id)
      .maybeSingle(),
  ]);

  const agreementSigned = await hasSignedVersion(
    admin,
    account.id,
    settings?.terms_version ?? "v1",
  );
  const platformTermsAccepted = !!profile?.terms_accepted_at;
  const emailConfirmed = !!profile?.email_verified_at;

  const campaignId = account.signup_campaign_id ?? null;
  const campaignRulesAccepted = await hasAcceptedCampaignRules(
    admin,
    account.id,
    campaignId,
  );

  return {
    agreementSigned,
    platformTermsAccepted,
    emailConfirmed,
    campaignRulesAccepted,
    campaignId,
    ready:
      agreementSigned &&
      platformTermsAccepted &&
      emailConfirmed &&
      campaignRulesAccepted,
  };
}

/**
 * A campaign only gates on rules when it actually publishes some. No campaign,
 * or a campaign with no published rules doc → nothing to sign.
 */
async function hasAcceptedCampaignRules(
  admin: Admin,
  affiliateId: string,
  campaignId: string | null,
): Promise<boolean> {
  if (!campaignId) return true;

  const { data: campaign } = await admin
    .from("affiliate_campaigns")
    .select("rules_doc_slug")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign?.rules_doc_slug) return true;

  const doc = await getPublishedLegalDocument(campaign.rules_doc_slug);
  if (!doc) return true;

  const { count } = await admin
    .from("affiliate_campaign_rule_acceptances")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("affiliate_id", affiliateId)
    .eq("doc_version", doc.version);
  return (count ?? 0) > 0;
}

export type ActivationResult = {
  activated: boolean;
  checklist: ActivationChecklist | null;
};

/**
 * Flip a pending affiliate to active IF every gate is clear, then enrol them in
 * the competition they signed up through.
 *
 * Call this from every point a gate can close. It is a no-op for an account that
 * is already active (or suspended — a suspended partner must never be silently
 * reinstated by confirming their email).
 *
 * `activatedBy` is the admin doing it by hand; omit for self-activation. An admin
 * override deliberately SKIPS the gate check — that is the point of a manual
 * activation — and the caller is responsible for the audit entry.
 */
export async function activateAffiliateIfReady(
  admin: Admin,
  affiliateId: string,
  activatedBy?: string | null,
): Promise<ActivationResult> {
  const checklist = await evaluateAffiliateActivation(admin, affiliateId);
  if (!checklist) return { activated: false, checklist: null };

  const { data: account } = await admin
    .from("affiliate_accounts")
    .select("status")
    .eq("id", affiliateId)
    .maybeSingle();
  if (account?.status !== "pending") {
    return { activated: false, checklist };
  }
  if (!checklist.ready && !activatedBy) {
    return { activated: false, checklist };
  }

  // Only the write that actually moves pending→active proceeds to enrolment, so
  // two gates closing at once can't double-enrol.
  const { data: claimed } = await admin
    .from("affiliate_accounts")
    .update({
      status: "active",
      activated_at: new Date().toISOString(),
      activated_by: activatedBy ?? null,
    })
    .eq("id", affiliateId)
    .eq("status", "pending")
    .select("id");
  if (!claimed || claimed.length === 0) {
    return { activated: false, checklist };
  }

  if (checklist.campaignId) {
    await enrolInSignupCampaign(admin, affiliateId, checklist.campaignId);
  }
  return { activated: true, checklist };
}

/**
 * Enrol a freshly activated partner in the competition they came in through.
 *
 * A place is deliberately NOT held while they are pending: the capacity trigger
 * locks the campaign row and a capped competition would otherwise fill up with
 * people who never confirmed their email. Being full is therefore a real
 * possibility here — it must not fail the activation, since the partner is a
 * valid affiliate either way; they simply aren't in that race.
 */
async function enrolInSignupCampaign(
  admin: Admin,
  affiliateId: string,
  campaignId: string,
): Promise<void> {
  const { data: campaign } = await admin
    .from("affiliate_campaigns")
    .select("status, eligible_partners")
    .eq("id", campaignId)
    .maybeSingle();
  if (campaign?.status !== "active") return;
  if (campaign.eligible_partners === "invite") return;

  await admin.from("affiliate_campaign_enrollments").upsert(
    {
      affiliate_id: affiliateId,
      campaign_id: campaignId,
      status: "active",
    },
    { onConflict: "affiliate_id,campaign_id", ignoreDuplicates: true },
  );
}
