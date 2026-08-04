import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Megaphone,
} from "lucide-react";
import { notFound } from "next/navigation";

// The Email tab reuses the Communications hub's message-row / drawer / modal
// styles (mrow, chp, mailmodal, drawer, lockzone…) — affiliate-manager.css
// (loaded by the affiliates layout) covers card/smallcaps/tgl/ttable only.
import "@/app/[locale]/admin/communications/communications.css";
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
import { parseEmailSchedule } from "@/lib/affiliate/emailSchedule";
import { EMAIL_REGISTRY } from "@/lib/email/registry";
import { listMessageConfigs } from "@/lib/notifications/admin-config";
import { COMPETITION_KINDS } from "@/lib/notifications/catalog";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  MarketingManager,
  type LibraryImage,
  type MarketingAsset,
} from "../../marketing/_components/MarketingManager";
import { loadCampaignMetrics } from "@/lib/affiliate/metrics";
import { loadCampaignResults } from "@/lib/affiliate/finalize";

import { getSamplePayload } from "../../../emails/samplePayloads";
import { CampaignAdminTabs } from "../_components/CampaignAdminTabs";
import { CampaignBuilder } from "../_components/CampaignBuilder";
import { CampaignEmailPanel } from "../_components/CampaignEmailPanel";
import { CampaignMetricsPanel } from "../_components/CampaignMetricsPanel";
import { CampaignResultsPanel } from "../_components/CampaignResultsPanel";
import { FloorAwardManager } from "../_components/FloorAwardManager";
import { CampaignRulesBinder } from "../_components/CampaignRulesBinder";
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

const zar = (n: number) => `R${Math.round(n).toLocaleString("en-ZA")}`;

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
      "id, slug, name, status, starts_at, ends_at, eligible_partners, eligible_referrals, commission_structure, competition, rules_doc_slug, max_participants, host_offer, hero_image_url, email_schedule",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!campaign) notFound();

  // Wielo media library (shared) + this campaign's own marketing assets.
  const [{ data: libObjects }, { data: campaignAssets }, { data: usedRows }] =
    await Promise.all([
      service.storage.from("marketing-assets").list("", {
        limit: 500,
        sortBy: { column: "created_at", order: "desc" },
      }),
      service
        .from("marketing_assets")
        .select(
          "id, category, title, description, body, link_url, file_path, file_url, mime_type, width, height, sort_order, is_active",
        )
        .eq("campaign_id", params.id)
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true }),
      service
        .from("marketing_assets")
        .select("file_path")
        .not("file_path", "is", null),
    ]);
  const inUsePaths = new Set(
    (usedRows ?? [])
      .map((r) => r.file_path)
      .filter((p): p is string => Boolean(p)),
  );
  const libraryImages: LibraryImage[] = (libObjects ?? [])
    .filter((o) => o.id && o.name)
    .map((o) => ({
      path: o.name,
      url: service.storage.from("marketing-assets").getPublicUrl(o.name).data
        .publicUrl,
      sizeBytes:
        (o.metadata?.size as number | undefined) ??
        (o.metadata?.contentLength as number | undefined) ??
        null,
      mime: (o.metadata?.mimetype as string | undefined) ?? null,
      createdAt: o.created_at ?? null,
      inUse: inUsePaths.has(o.name),
    }));

  const [
    { data: legalDocs },
    { data: enrollments },
    { data: rawScores },
    { data: floors },
    { data: ruleAcceptances },
    { data: productRows },
    { data: prizeAwards },
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
      .select("affiliate_id, floor_rate, won_via, awarded_at")
      .eq("campaign_id", campaign.id),
    service
      .from("affiliate_campaign_rule_acceptances")
      .select("id, affiliate_id, doc_slug, doc_version, accepted_at, ip")
      .eq("campaign_id", campaign.id)
      .order("accepted_at", { ascending: false }),
    // Membership products for the host-trial picker + duplicate sources (any
    // visibility — competition products are hidden).
    service
      .from("products")
      .select("id, name, slug, price, annual_price, currency, is_visible")
      .eq("product_type", "membership")
      .eq("is_active", true)
      .order("is_visible", { ascending: false })
      .order("price"),
    service
      .from("affiliate_prize_awards")
      .select("affiliate_id, amount, currency, status")
      .eq("campaign_id", campaign.id),
  ]);

  // Prize money per entrant (owed vs settled) for the entries roster.
  const prizeByAffiliate = new Map<
    string,
    { owed: number; paid: number; currency: string }
  >();
  for (const p of prizeAwards ?? []) {
    const id = p.affiliate_id as string;
    const cur = prizeByAffiliate.get(id) ?? {
      owed: 0,
      paid: 0,
      currency: (p.currency as string) ?? "ZAR",
    };
    const amt = Number(p.amount ?? 0);
    if (p.status === "paid") cur.paid += amt;
    else if (p.status === "owed") cur.owed += amt;
    prizeByAffiliate.set(id, cur);
  }

  const membershipProducts = (productRows ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    slug: p.slug as string,
    price: Number(p.price),
    annualPrice: p.annual_price != null ? Number(p.annual_price) : null,
    currency: (p.currency as string) ?? "ZAR",
    isVisible: Boolean(p.is_visible),
  }));

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
    affiliateId: f.affiliate_id as string,
    name: nameById.get(f.affiliate_id)?.name ?? "—",
    slug: nameById.get(f.affiliate_id)?.slug ?? "",
    ratePct: rateToPct(Number(f.floor_rate)),
    wonVia: (f.won_via as string | null) ?? "—",
    awarded: fmtDate(f.awarded_at as string | null),
  }));

  // Everyone taking part is a floor candidate (they appear via a score, an
  // enrolment, an existing floor or a rules acceptance → all in nameById).
  const floorPartners = Array.from(nameById.entries())
    .map(([id, v]) => ({ id, name: v.name, slug: v.slug }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const isLadderCampaign =
    ((campaign.commission_structure as { model?: string } | null)?.model ??
      "inherit") === "ladder";

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

  // Campaign performance metrics (funnel, commissions, scoring trend, partners).
  const metrics = await loadCampaignMetrics(campaign.id);
  // Finalization state: computed/published winners for the Results tab.
  const results = await loadCampaignResults(campaign.id);

  // ── ENTRIES roster ────────────────────────────────────────────────────────
  // Every participant + their competition-scoped numbers. metrics.partners
  // already computes per-entrant referrals / live listings / net commission
  // earned UNDER THIS CAMPAIGN; overlay enrolment, prizes and rule acceptance so
  // the Partners tab reads as a full entry record, each row linking to a
  // competition-scoped detail. Union so a partner who enrolled or signed the
  // rules but hasn't scored yet still shows.
  const metricById = new Map(metrics.partners.map((p) => [p.affiliateId, p]));
  const enrollmentById = new Map(
    (enrollments ?? []).map((e) => [
      e.affiliate_id as string,
      {
        enrolledAt: (e.enrolled_at as string | null) ?? null,
        pausedReason: (e.paused_reason as string | null) ?? null,
      },
    ]),
  );
  const ruleAcceptedIds = new Set(
    (ruleAcceptances ?? []).map((a) => a.affiliate_id as string),
  );
  const entryRows = Array.from(
    new Set<string>([...metricById.keys(), ...nameById.keys()]),
  )
    .map((id) => {
      const m = metricById.get(id);
      const prize = prizeByAffiliate.get(id) ?? null;
      return {
        id,
        name: m?.name ?? nameById.get(id)?.name ?? "—",
        slug: m?.slug ?? nameById.get(id)?.slug ?? "",
        liveListings: m?.liveListings ?? 0,
        referrals: m?.referrals ?? 0,
        earned: m?.earned ?? 0,
        currency: m?.currency ?? metrics.balance.currency,
        status: enrollmentStatusById.get(id) ?? "active",
        pausedReason: enrollmentById.get(id)?.pausedReason ?? null,
        prizeOwed: prize?.owed ?? 0,
        prizePaid: prize?.paid ?? 0,
        ruleAccepted: ruleAcceptedIds.has(id),
      };
    })
    .sort(
      (a, b) =>
        b.liveListings - a.liveListings ||
        b.earned - a.earned ||
        b.referrals - a.referrals,
    );
  const rulesBound = Boolean(campaign.rules_doc_slug);

  // Email tab: the competition-scoped lens over the global override store. Load
  // the message configs (each merged with its override + 24h health) and keep
  // just this campaign's messages — the comp kinds + the two partner-money mails
  // that matter to a competitor (commission earned, payout sent).
  const emailConfigs = (await listMessageConfigs()).filter(
    (c) =>
      (COMPETITION_KINDS as string[]).includes(c.kind) ||
      c.kind === "affiliate_commission_earned" ||
      c.kind === "affiliate_payout_paid",
  );
  const emailDefaults: Record<string, { subject: string }> = {};
  for (const c of emailConfigs) {
    const entry = EMAIL_REGISTRY[c.kind];
    emailDefaults[c.kind] = {
      subject: entry ? entry.subject(getSamplePayload(c.kind)) : c.label,
    };
  }
  const emailSchedule = parseEmailSchedule(campaign.email_schedule);

  // Setup summary + warnings for the Overview dashboard.
  const prizeCount = Array.isArray(
    (campaign.competition as { prizes?: unknown[] } | null)?.prizes,
  )
    ? (campaign.competition as { prizes: unknown[] }).prizes.length
    : 0;
  const trialProductId =
    (campaign.competition as { host_trial?: { product_id?: string } } | null)
      ?.host_trial?.product_id ?? null;
  const trialName = trialProductId
    ? (membershipProducts.find((p) => p.id === trialProductId)?.name ?? "Set")
    : null;
  const commissionModel =
    (campaign.commission_structure as { model?: string } | null)?.model ??
    "inherit";

  // Warnings the founder should see before launching — each links to where it
  // is fixed.
  const warnings: { text: string; href: string }[] = [];
  if (!campaign.rules_doc_slug) {
    warnings.push({
      text: "No competition rules are bound — required for a compliant public competition.",
      href: "#rules",
    });
  } else if (rulesDoc && !rulesDoc.is_published) {
    warnings.push({
      text: "The bound rules document is a draft — publish it in Legal docs so entrants can read it.",
      href: "#rules",
    });
  }
  if (commissionModel !== "inherit" && ladderText === "Ladder (no rungs)") {
    warnings.push({
      text: "Commission has no rungs set — partners would earn nothing.",
      href: "#setup",
    });
  }
  if (campaign.status === "draft") {
    warnings.push({
      text: "Campaign is a draft — launch it from Setup when the configuration is ready.",
      href: "#setup",
    });
  }

  // ── OVERVIEW dashboard ──────────────────────────────────────────
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
              ? "Paying its rates now"
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

      {warnings.length > 0 ? (
        <section className="rounded-[16px] border border-amber-200 bg-amber-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
            Before you launch
          </div>
          <ul className="mt-2 space-y-1.5">
            {warnings.map((w, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[13px] text-amber-900"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <a href={w.href} className="hover:underline">
                  {w.text}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="am-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-line px-5 py-3.5">
          <div className="smallcaps">Setup at a glance</div>
          <a
            href="#setup"
            className="btn-pri inline-flex h-8 items-center gap-1.5"
          >
            Open setup
          </a>
        </div>
        <dl className="divide-y divide-brand-line">
          <SummaryRow label="Commission" value={ladderText} href="#setup" />
          <SummaryRow label="Scoring" value={competitionText} href="#setup" />
          <SummaryRow
            label="Prizes"
            value={
              prizeCount
                ? `${prizeCount} prize${prizeCount === 1 ? "" : "s"}`
                : "None yet"
            }
            href="#setup"
          />
          <SummaryRow
            label="Rules"
            value={
              rulesDoc
                ? `${rulesDoc.title}${rulesDoc.is_published ? "" : " (draft)"}`
                : "Not bound"
            }
            href="#rules"
          />
          <SummaryRow
            label="Host trial"
            value={trialName ?? "None"}
            href="#setup"
          />
        </dl>
      </section>
    </div>
  );

  // ── SETUP panel (the guided builder) ────────────────────────────
  const setupPanel = (
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
        max_participants: (campaign.max_participants as number | null) ?? null,
        host_offer: (campaign.host_offer as string | null) ?? null,
        hero_image_url: (campaign.hero_image_url as string | null) ?? null,
        commission_structure: (campaign.commission_structure ?? {
          model: "inherit",
        }) as never,
        competition: (campaign.competition ?? {}) as never,
      }}
      enrolledActive={activeEnrolled}
      libraryImages={libraryImages}
      products={membershipProducts}
      resultsPublished={Boolean(results?.publishedAt)}
    />
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
          <div className="smallcaps">Entries</div>
          <p className="mt-0.5 text-[11.5px] text-brand-mute">
            Everyone taking part and their numbers for this competition. Click a
            partner to open their full record for the race.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="ttable">
            <thead>
              <tr>
                <th>Partner</th>
                <th className="r">Live</th>
                <th className="r">Referrals</th>
                <th className="r">Earned</th>
                <th className="r">Prizes</th>
                <th>Status</th>
                <th className="r" />
                <th className="r" />
              </tr>
            </thead>
            <tbody>
              {entryRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-brand-mute">
                    No entries yet.
                  </td>
                </tr>
              ) : (
                entryRows.map((r) => {
                  const href = `/admin/affiliates/campaigns/${campaign.id}/entries/${r.id}`;
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={href} className="group block min-w-0">
                          <div className="truncate text-[13.5px] font-semibold text-brand-ink group-hover:text-brand-primary group-hover:underline">
                            {r.name}
                          </div>
                          <div className="mono truncate text-[11px] text-brand-mute">
                            /r/{r.slug}
                          </div>
                        </Link>
                      </td>
                      <td className="num r font-semibold text-brand-ink">
                        {r.liveListings}
                      </td>
                      <td className="num r text-brand-mute">{r.referrals}</td>
                      <td className="num r font-medium text-brand-ink">
                        {r.earned ? zar(r.earned) : "—"}
                      </td>
                      <td className="num r text-brand-mute">
                        {r.prizePaid || r.prizeOwed ? (
                          <span>
                            {r.prizePaid ? `${zar(r.prizePaid)} paid` : null}
                            {r.prizePaid && r.prizeOwed ? " · " : null}
                            {r.prizeOwed ? (
                              <span className="text-status-pending">
                                {zar(r.prizeOwed)} owed
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span
                          className={`tag ${r.status === "paused" ? "amber" : "gray"}`}
                        >
                          <span className="d" />
                          <span className="capitalize">{r.status}</span>
                        </span>
                        {rulesBound && !r.ruleAccepted ? (
                          <div className="mt-1 text-[10.5px] font-medium text-status-pending">
                            rules not signed
                          </div>
                        ) : null}
                        {r.pausedReason ? (
                          <div className="mt-1 max-w-[18rem] text-[11px] leading-snug text-brand-mute">
                            {r.pausedReason}
                          </div>
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
                      <td className="r">
                        <Link
                          href={href}
                          className="inline-flex items-center gap-0.5 text-[12px] font-medium text-brand-primary hover:underline"
                        >
                          View
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <FloorAwardManager
        campaignId={campaign.id}
        isLadder={isLadderCampaign}
        partners={floorPartners}
        floors={floorRows}
      />
    </div>
  );

  // ── MARKETING panel ─────────────────────────────────────────────
  // This campaign's OWN marketing assets (campaign_id = this campaign). Images
  // are assigned from the shared Wielo media library; the general/default
  // archive lives on the top-level Marketing tab.
  const marketingPanel = (
    <div className="space-y-4">
      <Link
        href="/admin/affiliates/marketing"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-primary hover:underline"
      >
        <Megaphone className="h-3.5 w-3.5" />
        Manage the default-programme archive
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
      <MarketingManager
        assets={(campaignAssets ?? []) as MarketingAsset[]}
        library={libraryImages}
        campaignId={campaign.id}
        campaignName={campaign.name}
      />
    </div>
  );

  // ── RULES & PRIZES panel ────────────────────────────────────────
  const staleAcceptances = acceptanceRows.filter((a) => a.stale).length;
  const rulesDocOptions = (legalDocs ?? []).map((d) => ({
    slug: d.slug as string,
    title: d.title as string,
    version: (d.version as number) ?? 1,
    isPublished: Boolean(d.is_published),
    bodyHtml: (d.body_html as string | null) ?? null,
  }));

  const rulesPanel = (
    <div className="space-y-6">
      <CampaignRulesBinder
        campaignId={campaign.id}
        docs={rulesDocOptions}
        boundSlug={(campaign.rules_doc_slug as string | null) ?? null}
        acceptedCount={acceptanceRows.length}
        staleCount={staleAcceptances}
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
          setup: setupPanel,
          metrics: <CampaignMetricsPanel metrics={metrics} />,
          standings: standingsPanel,
          results: (
            <CampaignResultsPanel
              campaignId={campaign.id}
              campaignSlug={campaign.slug}
              status={campaign.status}
              endsAt={campaign.ends_at as string | null}
              computedAt={results?.computedAt ?? null}
              publishedAt={results?.publishedAt ?? null}
              winners={results?.winners ?? []}
              prizes={results?.prizes ?? []}
            />
          ),
          partners: partnersPanel,
          marketing: marketingPanel,
          email: (
            <CampaignEmailPanel
              campaignId={campaign.id}
              configs={emailConfigs}
              defaults={emailDefaults}
              schedule={emailSchedule}
            />
          ),
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

function SummaryRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-brand-light/50"
    >
      <dt className="text-[12.5px] font-medium text-brand-mute">{label}</dt>
      <dd className="truncate text-right text-[13px] font-semibold text-brand-ink">
        {value}
      </dd>
    </a>
  );
}
