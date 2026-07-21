import { ArrowLeft, ExternalLink, Trophy } from "lucide-react";
import { notFound } from "next/navigation";

import {
  AdminTable,
  type AdminColumn,
} from "@/app/[locale]/admin/_components/AdminTable";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import { rateToPct } from "@/lib/affiliate/campaignConfig";
import { createAdminClient } from "@/lib/supabase/admin";

import { CampaignBuilder } from "../_components/CampaignBuilder";

export const dynamic = "force-dynamic";

// WS-1i — the campaign builder. Everything that used to live in a seed
// migration is editable here, alongside the live read-outs (who is enrolled,
// current standings, floors already earned) so the founder can see what a
// change would affect before making it.

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
      "id, slug, name, status, starts_at, ends_at, eligible_partners, eligible_referrals, commission_structure, competition, rules_doc_slug",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!campaign) notFound();

  const [
    { data: legalDocs },
    { data: enrollments },
    { data: rawScores },
    { data: floors },
  ] = await Promise.all([
    service.from("legal_documents").select("slug, title").order("title"),
    service
      .from("affiliate_campaign_enrollments")
      .select("affiliate_id, status, enrolled_at")
      .eq("campaign_id", campaign.id),
    service.rpc("campaign_active_listings", { p_campaign_id: campaign.id }),
    service
      .from("affiliate_campaign_floors")
      .select("affiliate_id, floor_rate, reason, awarded_at")
      .eq("campaign_id", campaign.id),
  ]);

  const scores = (rawScores ?? []) as {
    affiliate_id: string;
    active_listings: number;
  }[];

  // Resolve partner names once for every panel below.
  const affiliateIds = Array.from(
    new Set([
      ...(enrollments ?? []).map((e) => e.affiliate_id),
      ...scores.map((s) => s.affiliate_id),
      ...(floors ?? []).map((f) => f.affiliate_id),
    ]),
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

  const standings = scores
    .slice()
    .sort((a, b) => b.active_listings - a.active_listings)
    .map((s, i) => ({
      rank: i + 1,
      id: s.affiliate_id,
      name: nameById.get(s.affiliate_id)?.name ?? "—",
      slug: nameById.get(s.affiliate_id)?.slug ?? "",
      listings: s.active_listings,
    }));

  const enrolledRows = (enrollments ?? []).map((e) => ({
    id: e.affiliate_id,
    name: nameById.get(e.affiliate_id)?.name ?? "—",
    slug: nameById.get(e.affiliate_id)?.slug ?? "",
    status: e.status as string,
    enrolled_at: e.enrolled_at as string | null,
  }));

  const floorRows = (floors ?? []).map((f) => ({
    id: `${f.affiliate_id}-${f.awarded_at}`,
    name: nameById.get(f.affiliate_id)?.name ?? "—",
    rate: `${rateToPct(Number(f.floor_rate))}%`,
    reason: (f.reason as string | null) ?? "—",
    awarded_at: f.awarded_at as string | null,
  }));

  const standingColumns: AdminColumn<(typeof standings)[number]>[] = [
    { header: "#", cell: (r) => <span className="num">{r.rank}</span> },
    {
      header: "Partner",
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-brand-ink">{r.name}</div>
          <div className="truncate font-mono text-[11px] text-brand-mute">
            /r/{r.slug}
          </div>
        </div>
      ),
    },
    {
      header: "Live listings",
      align: "right",
      cell: (r) => <span className="num font-medium">{r.listings}</span>,
    },
  ];

  const enrolledColumns: AdminColumn<(typeof enrolledRows)[number]>[] = [
    {
      header: "Partner",
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-brand-ink">{r.name}</div>
          <div className="truncate font-mono text-[11px] text-brand-mute">
            /r/{r.slug}
          </div>
        </div>
      ),
    },
    {
      header: "Status",
      cell: (r) => (
        <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-medium capitalize text-brand-mute">
          {r.status}
        </span>
      ),
    },
    {
      header: "Joined",
      cell: (r) => (
        <span className="text-brand-mute">
          {r.enrolled_at
            ? new Date(r.enrolled_at).toLocaleDateString("en-ZA", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "—"}
        </span>
      ),
    },
  ];

  const floorColumns: AdminColumn<(typeof floorRows)[number]>[] = [
    { header: "Partner", cell: (r) => <span>{r.name}</span> },
    {
      header: "Locked rate",
      cell: (r) => <span className="num font-medium">{r.rate}</span>,
    },
    { header: "Why", cell: (r) => <span>{r.reason}</span> },
    {
      header: "Awarded",
      cell: (r) => (
        <span className="text-brand-mute">
          {r.awarded_at
            ? new Date(r.awarded_at).toLocaleDateString("en-ZA", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/affiliates/campaigns"
          className="inline-flex items-center gap-1.5 text-sm text-brand-mute hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          All campaigns
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-brand-ink">
            <Trophy className="h-6 w-6 text-brand-primary" />
            {campaign.name}
          </h1>
          {campaign.status === "active" ? (
            <a
              href={`/competitions/${campaign.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-primary hover:underline"
            >
              View public leaderboard
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </header>

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
          commission_structure: (campaign.commission_structure ?? {
            model: "inherit",
          }) as never,
          competition: (campaign.competition ?? {}) as never,
        }}
        legalDocs={(legalDocs ?? []).map((d) => ({
          slug: d.slug as string,
          title: d.title as string,
        }))}
      />

      <section>
        <h2 className="mb-1 font-display text-lg font-semibold text-brand-ink">
          Live standings
        </h2>
        <p className="mb-3 text-[12.5px] text-brand-mute">
          Live listings from hosts each partner brought in — the same read the
          public leaderboard uses.
        </p>
        <AdminTable
          columns={standingColumns}
          rows={standings}
          getKey={(r) => r.id}
          empty="No scoring activity yet."
        />
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-brand-ink">
          Enrolled partners
        </h2>
        <AdminTable
          columns={enrolledColumns}
          rows={enrolledRows}
          getKey={(r) => r.id}
          empty="Nobody has joined this campaign yet."
        />
      </section>

      <section>
        <h2 className="mb-1 font-display text-lg font-semibold text-brand-ink">
          Commission floors awarded
        </h2>
        <p className="mb-3 text-[12.5px] text-brand-mute">
          Prizes that permanently lock a partner&apos;s minimum rate. These
          survive the campaign ending.
        </p>
        <AdminTable
          columns={floorColumns}
          rows={floorRows}
          getKey={(r) => r.id}
          empty="No floors awarded yet."
        />
      </section>
    </div>
  );
}
