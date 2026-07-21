import { ArrowLeft, Handshake, Trophy, Users, Wallet } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { getBrandName } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublishedLegalDocument } from "@/lib/legalDocuments";
import { renderAgreementBody } from "@/lib/affiliate/agreement.shared";
import { formatMoney } from "@/lib/format";

import { PartnerSignupForm } from "./PartnerSignupForm";

/**
 * The partner signup screen — ONE component behind both `/signup/partner` and
 * `/signup/partner/[campaign]`.
 *
 * A competition does NOT get its own hand-built page: the campaign row drives
 * the headline, the pitch and the rules to sign, so creating a campaign in the
 * admin builder yields a working signup URL with no new code. That is what makes
 * each competition independent from a signup point of view.
 */
export async function PartnerSignupScreen({
  campaignSlug,
}: {
  campaignSlug?: string;
}) {
  const brand = await getBrandName();
  const admin = createAdminClient();

  const campaign = campaignSlug
    ? await loadSignupCampaign(admin, campaignSlug)
    : null;

  const [{ data: settings }, rulesDoc] = await Promise.all([
    admin
      .from("affiliate_settings")
      .select("terms_version, terms_content")
      .eq("id", true)
      .maybeSingle(),
    campaign?.rulesDocSlug
      ? getPublishedLegalDocument(campaign.rulesDocSlug)
      : Promise.resolve(null),
  ]);

  const agreementBody = renderAgreementBody(
    settings?.terms_content ?? "",
    brand,
  );

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr] xl:grid-cols-[1.05fr_1fr]">
      <aside className="relative flex min-h-[220px] flex-col overflow-hidden bg-brand-gradient-dark p-8 text-white lg:min-h-0 lg:p-14 xl:p-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-dot-grid opacity-25"
        />
        <div className="relative flex items-center justify-between">
          <Link
            href="/"
            className="group flex items-center gap-2 text-emerald-200/80 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to {brand}
          </Link>
        </div>
        <div className="relative flex max-w-md flex-1 flex-col justify-center py-8 lg:py-12">
          <div className="inline-flex items-center gap-1.5 self-start rounded-pill bg-white/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200/95 ring-1 ring-white/15">
            {campaign ? (
              <>
                <Trophy className="h-3 w-3" /> {campaign.name}
              </>
            ) : (
              <>
                <Handshake className="h-3 w-3" /> {brand} Partners
              </>
            )}
          </div>
          <h2 className="mt-5 font-display text-3xl font-bold leading-[1.1] tracking-tight lg:text-4xl">
            {campaign
              ? "Enter the race. Earn for life."
              : "Refer hosts. Earn every month."}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-emerald-100/75">
            {campaign
              ? `Sign up as a ${brand} partner and you're entered into ${campaign.name}. Every host you bring on earns you commission for as long as they stay — the competition just adds prizes on top.`
              : `Bring South African hosts onto ${brand} and earn a share of what they pay, every month, for as long as they stay with us.`}
          </p>
          <ul className="mt-6 space-y-3 text-[14px] text-emerald-100/85">
            <li className="flex items-center gap-2.5">
              <Wallet className="h-4 w-4 shrink-0 text-emerald-300" /> Lifetime
              recurring commission
            </li>
            <li className="flex items-center gap-2.5">
              <Users className="h-4 w-4 shrink-0 text-emerald-300" /> Your own
              referral link and landing page
            </li>
            {campaign?.prizePot ? (
              <li className="flex items-center gap-2.5">
                <Trophy className="h-4 w-4 shrink-0 text-emerald-300" />
                {formatMoney(campaign.prizePot, "ZAR")} prize pot
              </li>
            ) : null}
          </ul>

          {campaign?.placesLeft != null ? (
            <div className="mt-7 self-start rounded-pill bg-white/[0.08] px-3 py-1.5 text-[12px] font-semibold text-emerald-100 ring-1 ring-white/15">
              {campaign.placesLeft > 0
                ? `${campaign.placesLeft} of ${campaign.maxParticipants} places left`
                : "This competition is full"}
            </div>
          ) : null}
        </div>
      </aside>

      <main className="relative flex min-w-0 items-stretch justify-center bg-brand-light/50 p-6 lg:items-center lg:p-10 xl:p-12">
        <div className="w-full max-w-[440px] py-10 lg:py-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-primary">
            {campaign ? "Enter the competition" : "Become a partner"}
          </div>
          <h1 className="mt-2 font-display text-[30px] font-bold leading-[1.1] tracking-tight text-brand-ink">
            Create your partner account
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-brand-mute">
            Free to join. We&apos;ll set up your {brand} account and your
            referral link — confirm your email and you&apos;re live.
          </p>
          <div className="mt-7">
            <PartnerSignupForm
              brand={brand}
              campaign={
                campaign
                  ? {
                      slug: campaign.slug,
                      name: campaign.name,
                      full: campaign.placesLeft === 0,
                    }
                  : null
              }
              agreementBody={agreementBody}
              agreementVersion={settings?.terms_version ?? "v1"}
              rules={
                rulesDoc ? { slug: rulesDoc.slug, title: rulesDoc.title } : null
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}

type SignupCampaign = {
  id: string;
  slug: string;
  name: string;
  rulesDocSlug: string | null;
  prizePot: number | null;
  maxParticipants: number | null;
  placesLeft: number | null;
};

/**
 * Only an OPEN campaign can have a signup page. A draft/ended/archived or
 * invite-only competition resolves to null, so its URL falls back to the plain
 * partner signup rather than 404-ing someone mid-signup.
 */
async function loadSignupCampaign(
  admin: ReturnType<typeof createAdminClient>,
  slug: string,
): Promise<SignupCampaign | null> {
  const { data } = await admin
    .from("affiliate_campaigns")
    .select(
      "id, slug, name, status, eligible_partners, rules_doc_slug, competition, max_participants",
    )
    .ilike("slug", slug)
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  if (data.eligible_partners === "invite") return null;

  let placesLeft: number | null = null;
  if (data.max_participants != null) {
    const { count } = await admin
      .from("affiliate_campaign_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", data.id)
      .eq("status", "active");
    placesLeft = Math.max(0, data.max_participants - (count ?? 0));
  }

  const competition = (data.competition ?? {}) as { prize_pot?: unknown };
  const prizePot =
    typeof competition.prize_pot === "number" ? competition.prize_pot : null;

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    rulesDocSlug: data.rules_doc_slug,
    prizePot,
    maxParticipants: data.max_participants,
    placesLeft,
  };
}
