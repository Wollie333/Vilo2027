import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Megaphone,
} from "lucide-react";
import { notFound } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import {
  describeCompetition,
  describeLadder,
  rateToPct,
} from "@/lib/affiliate/campaignConfig";
import type {
  CommissionStructure,
  Competition,
} from "@/lib/affiliate/campaigns";
import { createAdminClient } from "@/lib/supabase/admin";

import { CampaignAdminTabs } from "../_components/CampaignAdminTabs";
import { CampaignBuilder } from "../_components/CampaignBuilder";
import { CampaignRulesEditor } from "../_components/CampaignRulesEditor";
import { EnrollmentPauseButton } from "../_components/EnrollmentPauseButton";

export const dynamic = "force-dynamic";

// WS-1i — the campaign builder, restructured to mirror the partner-facing race
// detail: a header + inner tabs (Overview / Standings / Partners / Marketing /
// Rules & prizes). Everything that used to live in a seed migration is editable
// in Overview, alongside the live read-outs so the founder can see what a change
// would affect before making it.

const CAMPAIGN_STATUS: Record<string, { cls: string; label: string }> = {
  active: { cls: "green", label: "Live" },
  draft: { cls: "gray", label: "Draft" },
  ended: { cls: "amber", label: "Ended" },
  archived: { cls: "red", label: "Archived" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminCampaignPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const { data: campaign } = await service
    .from("affiliate_campaigns")
    .select(
      "id, slug, name, status, starts_at, ends_at, eligible_partners, eligible_referrals, commission_structure, competition, rules_doc_slug, max_participants, host_offer, hero_image_url",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!campaign) notFound();

  // Wielo media-library images the hero image can be assigned from.
  const { data: libObjects } = await service.storage
    .from("marketing-assets")
    .list("", { limit: 500, sortBy: { column: "created_at", order: "desc" } });
  const libraryImages = (libObjects ?? [])
    .filter((o) => o.id && o.name)
    .map((o) => ({
      path: o.name,
      url: service.storage.from("marketing-assets").getPublicUrl(o.name).data
        .publicUrl,
    }));

  const [
    { data: legalDocs },
    { data: enrollments },
    { data: rawScores },
    { data: floors },
    { data: ruleAcceptances },
  ] = await Promise.all([
    service
      .from("legal_documents")
      .select("slug, title, body_html, version, is_published")
      .order("title"),
    service
      .from("affiliate_campaign_enrollments")
      .select("affiliate_id, status, enrolled_at, paused_at, paused_reason")
      .eq("campaign_id", campaign.id),
    service.rpc("campaign_active_listings", { p_campaign_id: campaign.id }),
    service
      .from("affiliate_campaign_floors")
      .select("affiliate_id, floor_rate, reason, awarded_at")
      .eq("campaign_id", campaign.id),
    service
      .from("affiliate_campaign_rule_acceptances")
      .select("id, affiliate_id, doc_slug, doc_version, accepted_at, ip")
      .eq("campaign_id", campaign.id)
      .order("accepted_at", { ascending: false }),
  ]);

  const scores = (rawScores ?? []) as {
    affiliate_id: string;
    active_listings: number;
  }[];

  // Resolve partner names once for every panel below.
  const affiliateIds = Array.from(
    new Set(
      [
        ...(enrollments ?? []).map((e) => e.affiliate_id),
        ...scores.map((s) => s.affiliate_id),
        ...(floors ?? []).map((f) => f.affiliate_id),
        ...(ruleAcceptances ?? []).map((a) => a.affiliate_id),
      ].filter((id): id is string => Boolean(id)),
    ),
  );
  const nameById = new Map<string, { name: string; slug: string }>();
  if (affiliateIds.length) {
    const { data: accounts } = await service
      .from("affiliate_accounts")
      .select("id, user_id, slug")
      .in("id", affiliateIds);
    const userIds = (accounts ?? []).map((a) => a.user_id);
    const { data: profiles } = userIds.length
      ? await service
          .from("user_profiles")
          .select("id, full_name, email")
          .in("id", userIds)
      : {
          data: [] as {
            id: string;
            full_name: string | null;
            email: string | null;
          }[],
        };
    const profileByUser = new Map((profiles ?? []).map((p) => [p.id, p]));
    for (const a of accounts ?? []) {
      const p = profileByUser.get(a.user_id);
      nameById.set(a.id, {
        name: p?.full_name || p?.email || "Unnamed partner",
        slug: a.slug,
      });
    }
  }

  // Enrollment status by partner. On an `eligible_partners = 'all'' campaign a
  // partner can be scoring without ever having had an enrollment row, so the
  // standings default to 'active' — they ARE racing, and pausing them upserts
  // the row that was missing.
  const enrollmentStatusById = new Map(
    (enrollments ?? []).map((e) => [
      e.affiliate_id as string,
      e.status as string,
    ]),
  );

  const standings = scores
    .slice()
    .sort((a, b) => b.active_listings - a.active_listings)
    .map((s, i) => ({
      rank: i + 1,
      id: s.affiliate_id,
      name: nameById.get(s.affiliate_id)?.name ?? "—",
      slug: nameById.get(s.affiliate_id)?.slug ?? "",
      listings: s.active_listings,
      status: enrollmentStatusById.get(s.affiliate_id) ?? "active",
    }));

  const enrolledRows = (enrollments ?? []).map((e) => ({
    id: e.affiliate_id,
    name: nameById.get(e.affiliate_id)?.name ?? "—",
    slug: nameById.get(e.affiliate_id)?.slug ?? "",
    status: e.status as string,
    enrolled_at: e.enrolled_at as string | null,
    paused_reason: (e.paused_reason as string | null) ?? null,
  }));

  const floorRows = (floors ?? []).map((f) => ({
    id: `${f.affiliate_id}-${f.awarded_at}`,
    name: nameById.get(f.affiliate_id)?.name ?? "—",
    rate: `${rateToPct(Number(f.floor_rate))}%`,
    reason: (f.reason as string | null) ?? "—",
    awarded_at: f.awarded_at as string | null,
  }));

  // The rules document this campaign points at, if any, plus who has signed it.
  const rulesDoc =
    (legalDocs ?? []).find((d) => d.slug === campaign.rules_doc_slug) ?? null;
  const acceptanceRows = (ruleAcceptances ?? []).map((a) => ({
    id: a.id as string,
    name: nameById.get(a.affiliate_id ?? "")?.name ?? "—",
    version: a.doc_version as number,
    stale: rulesDoc ? (a.doc_version as number) !== rulesDoc.version : false,
    accepted_at: a.accepted_at as string,
    ip: (a.ip as string | null) ?? "—",
  }));

  const activeEnrolled = enrolledRows.filter(
    (e) => e.status === "active",
  ).length;
  const capacity = (campaign.max_participants as number | null) ?? null;
  const statusTag = CAMPAIGN_STATUS[campaign.status] ?? CAMPAIGN_STATUS.draft;
  const ladderText = describeLadder(
    (campaign.commission_structure ?? null) as CommissionStructure | null,
  );
  const competitionText = describeCompetition(
    (campaign.competition ?? null) as Competition | null,
  );

  // ── OVERVIEW panel ──────────────────────────────────────────────
  const overview = (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-brand-line bg-brand-line sm:grid-cols-4">
        <div className="bg-brand-secondary p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
            Status
          </div>
          <div className="mt-2 font-display text-[18px] font-bold capitalize leading-none text-white">
            {statusTag.label}
          </div>
          <div className="mt-1.5 text-[11px] text-brand-accent">
            {campaign.status === "active"
              ? "Paying its ladder now"
              : "Not paying yet"}
          </div>
        </div>
        <BandCell
          label="Enrolled partners"
          value={
            capacity != null
              ? `${activeEnrolled} / ${capacity}`
              : String(activeEnrolled)
          }
          sub={capacity != null ? "places filled" : "active in the race"}
        />
        <BandCell
          label="Runs"
          value={fmtDate(campaign.starts_at as string | null)}
          sub={`until ${fmtDate(campaign.ends_at as string | null)}`}
        />
        <BandCell label="Scoring" value={competitionText} sub={ladderText} />
      </section>

      <CampaignBuilder
        campaignId={campaign.id}
        initial={{
          name: campaign.name,
          slug: campaign.slug,
          status: campaign.status as never,
          starts_at: campaign.starts_at as string | null,
          ends_at: campaign.ends_at as string | null,
          eligible_partners: campaign.eligible_partners as never,
          eligible_referrals: campaign.eligible_referrals as never,
          rules_doc_slug: (campaign.rules_doc_slug as string | null) ?? null,
          max_participants:
            (campaign.max_participants as number | null) ?? null,
          host_offer: (campaign.host_offer as string | null) ?? null,
          hero_image_url: (campaign.hero_image_url as string | null) ?? null,
          commission_structure: (campaign.commission_structure ?? {
            model: "inherit",
          }) as never,
          competition: (campaign.competition ?? {}) as never,
        }}
        legalDocs={(legalDocs ?? []).map((d) => ({
          slug: d.slug as string,
          title: d.title as string,
        }))}
        enrolledActive={activeEnrolled}
        libraryImages={libraryImages}
      />
    </div>
  );

  // ── STANDINGS panel ─────────────────────────────────────────────
  const standingsPanel = (
    <section className="am-card overflow-hidden">
      <div className="border-b border-brand-line px-5 py-3.5">
        <div className="smallcaps">Live standings</div>
        <p className="mt-0.5 text-[11.5px] text-brand-mute">
          Live listings from hosts each partner brought in — the same read the
          public leaderboard uses.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="ttable">
          <thead>
            <tr>
              <th className="r">#</th>
              <th>Partner</th>
              <th className="r">Live listings</th>
              <th className="r" />
            </tr>
          </thead>
          <tbody>
            {standings.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-brand-mute">
                  No scoring activity yet.
                </td>
              </tr>
            ) : (
              standings.map((r) => (
                <tr key={r.id}>
                  <td className="num r font-semibold text-brand-ink">
                    {r.rank}
                  </td>
                  <td>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold text-brand-ink">
                        {r.name}
                      </div>
                      <div className="mono truncate text-[11px] text-brand-mute">
                        /r/{r.slug}
                      </div>
                    </div>
                  </td>
                  <td className="num r font-semibold">
                    {r.listings}
                    {r.status === "paused" ? (
                      <span className="tag amber ml-2">
                        <span className="d" />
                        Paused
                      </span>
                    ) : null}
                  </td>
                  <td className="r">
                    <EnrollmentPauseButton
                      campaignId={campaign.id}
                      affiliateId={r.id}
                      name={r.name}
                      status={r.status}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  // ── PARTNERS panel ──────────────────────────────────────────────
  const partnersPanel = (
    <div className="space-y-6">
      <section className="am-card overflow-hidden">
        <div className="border-b border-brand-line px-5 py-3.5">
          <div className="smallcaps">Enrolled partners</div>
        </div>
        <div className="overflow-x-auto">
          <table className="ttable">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Status</th>
                <th>Joined</th>
                <th className="r" />
              </tr>
            </thead>
            <tbody>
              {enrolledRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-brand-mute">
                    Nobody has joined this campaign yet.
                  </td>
                </tr>
              ) : (
                enrolledRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-semibold text-brand-ink">
                          {r.name}
                        </div>
                        <div className="mono truncate text-[11px] text-brand-mute">
                          /r/{r.slug}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`tag ${r.status === "paused" ? "amber" : "gray"}`}
                      >
                        <span className="d" />
                        <span className="capitalize">{r.status}</span>
                      </span>
                      {r.paused_reason ? (
                        <div className="mt-1 max-w-[22rem] text-[11px] leading-snug text-brand-mute">
                          {r.paused_reason}
                        </div>
                      ) : null}
                    </td>
                    <td className="num text-brand-mute">
                      {fmtDate(r.enrolled_at)}
                    </td>
                    <td className="r">
                      <EnrollmentPauseButton
                        campaignId={campaign.id}
                        affiliateId={r.id}
                        name={r.name}
                        status={r.status}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="am-card overflow-hidden">
        <div className="border-b border-brand-line px-5 py-3.5">
          <div className="smallcaps">Commission floors awarded</div>
          <p className="mt-0.5 text-[11.5px] text-brand-mute">
            Prizes that permanently lock a partner&apos;s minimum rate. These
            survive the campaign ending.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="ttable">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Locked rate</th>
                <th>Why</th>
                <th>Awarded</th>
              </tr>
            </thead>
            <tbody>
              {floorRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-brand-mute">
                    No floors awarded yet.
                  </td>
                </tr>
              ) : (
                floorRows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold text-brand-ink">{r.name}</td>
                    <td className="num font-semibold text-brand-primary">
                      {r.rate}
                    </td>
                    <td className="text-brand-mute">{r.reason}</td>
                    <td className="num text-brand-mute">
                      {fmtDate(r.awarded_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  // ── MARKETING panel ─────────────────────────────────────────────
  // Mirrors the partner race Marketing tab: a link into the marketing library.
  // Assets are program-wide, so this is a jump-off, not a per-campaign store.
  const marketingPanel = (
    <Link href="/admin/affiliates/marketing" className="brow">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-brand-accent text-brand-secondary">
        <Megaphone className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-brand-ink">
          Marketing material
        </div>
        <div className="text-[12.5px] text-brand-mute">
          Manage the banners, posts and templates affiliates use — shared across
          every campaign.
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-brand-mute" />
    </Link>
  );

  // ── RULES & PRIZES panel ────────────────────────────────────────
  const rulesPanel = (
    <div className="space-y-6">
      <CampaignRulesEditor
        campaignId={campaign.id}
        campaignSlug={campaign.slug}
        campaignName={campaign.name}
        initial={{
          slug: (campaign.rules_doc_slug as string | null) ?? null,
          title: (rulesDoc?.title as string | undefined) ?? null,
          html: (rulesDoc?.body_html as string | null | undefined) ?? null,
          version: (rulesDoc?.version as number | undefined) ?? null,
          isPublished: Boolean(rulesDoc?.is_published),
          acceptedCount: acceptanceRows.length,
        }}
      />

      <section className="am-card overflow-hidden">
        <div className="border-b border-brand-line px-5 py-3.5">
          <div className="smallcaps">Rules accepted on entry</div>
          <p className="mt-0.5 text-[11.5px] text-brand-mute">
            Nobody can enter without accepting the rules. Each row stores the
            exact text that partner agreed to — the records are immutable.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="ttable">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Rules version</th>
                <th>Entered</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {acceptanceRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-brand-mute">
                    {campaign.rules_doc_slug
                      ? "No entries yet."
                      : "No rules published — publish them above to require acceptance on entry."}
                  </td>
                </tr>
              ) : (
                acceptanceRows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold text-brand-ink">{r.name}</td>
                    <td className="num text-brand-ink">
                      v{r.version}
                      {r.stale ? (
                        <span className="tag amber ml-2">
                          <span className="d" />
                          older version
                        </span>
                      ) : null}
                    </td>
                    <td className="num text-brand-mute">
                      {fmtDateTime(r.accepted_at)}
                    </td>
                    <td className="mono text-[11.5px] text-brand-mute">
                      {r.ip}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  return (
    <div>
      {/* HEADER — the campaign is its own workspace: the program nav is hidden,
          so this carries the back button + full breadcrumb trail. */}
      <div>
        <nav className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-brand-mute">
          <Link href="/admin" className="hover:underline">
            Admin
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/admin/affiliates" className="hover:underline">
            Affiliates
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/admin/affiliates/campaigns" className="hover:underline">
            Campaigns
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-brand-ink">{campaign.name}</span>
        </nav>
        <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/admin/affiliates/campaigns"
                aria-label="Back to campaigns"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-line bg-white text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="font-display text-[20px] font-extrabold leading-none text-brand-ink">
                {campaign.name}
              </h1>
              <span className={`tag ${statusTag.cls}`}>
                <span className="d" />
                {statusTag.label}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-brand-mute">
              <a
                href={`/competitions/${campaign.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-brand-primary hover:underline"
              >
                {campaign.status === "active"
                  ? "View public leaderboard"
                  : "Preview public page (404 until launched)"}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href={`/signup/partner/${campaign.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-brand-primary hover:underline"
              >
                {campaign.status === "active"
                  ? "Open partner signup link"
                  : "Preview partner signup"}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <CampaignAdminTabs
        panels={{
          overview,
          standings: standingsPanel,
          partners: partnersPanel,
          marketing: marketingPanel,
          rules: rulesPanel,
        }}
      />
    </div>
  );
}

function BandCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-[#FAFCFB] p-4">
      <div className="smallcaps">{label}</div>
      <div className="num mt-1.5 font-display text-[16px] font-bold leading-tight text-brand-ink">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-brand-mute">{sub}</div>
    </div>
  );
}
