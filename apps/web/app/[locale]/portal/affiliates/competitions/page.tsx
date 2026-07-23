import type { Metadata } from "next";

import {
  describeCommissionStructure,
  ladderRateForBook,
  nextLadderRung,
  type CommissionStructure,
  type LadderBand,
} from "@/lib/affiliate/campaigns";
import { getAffiliateForUser } from "@/lib/affiliate/account";
import { getPublishedLegalDocument } from "@/lib/legalDocuments";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { AffiliateBaseLink } from "../_components/AffiliateBaseLink";
import {
  CampaignJoinCard,
  type OpenCampaign,
} from "../_components/CampaignJoinCard";

export const metadata: Metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

function zar(n: number): string {
  return "R " + Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
}
function dateLabel(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return d > 0 ? d : 0;
}

export default async function AffiliateCampaignsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const me = await getAffiliateForUser(admin, user.id);
  if (!me) return null;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://wielo.co.za";

  const [{ data: campaigns }, { data: enrollments }, { data: commissions }] =
    await Promise.all([
      admin
        .from("affiliate_campaigns")
        .select(
          "id, slug, name, status, starts_at, ends_at, commission_structure, competition, rules_doc_slug",
        )
        .in("status", ["active", "ended"])
        .order("created_at", { ascending: true }),
      admin
        .from("affiliate_campaign_enrollments")
        .select("campaign_id, status")
        .eq("affiliate_id", me.id),
      admin
        .from("affiliate_commissions")
        .select("commission_amount, status, campaign_id")
        .eq("affiliate_id", me.id),
    ]);

  const enrolledIds = new Set(
    (enrollments ?? [])
      .filter((e) => e.status === "active" || e.status === "paused")
      .map((e) => e.campaign_id as string),
  );
  const earnedByCampaign = (id: string) =>
    (commissions ?? [])
      .filter((c) => c.campaign_id === id && c.status !== "voided")
      .reduce((s, c) => s + Number(c.commission_amount), 0);

  const enrolledCards: {
    id: string;
    name: string;
    slug: string;
    hasCompetition: boolean;
    endsLabel: string | null;
    daysLeft: number | null;
    rank: number | null;
    ofN: number;
    score: number;
    ratePct: number;
    earned: number;
    toNextLabel: string | null;
    progressPct: number;
    link: string;
  }[] = [];
  const openCards: OpenCampaign[] = [];

  for (const c of campaigns ?? []) {
    const cs = (c.commission_structure ?? {
      model: "inherit",
    }) as CommissionStructure;
    const hasCompetition = Boolean(c.competition);
    const rulesVersion = c.rules_doc_slug
      ? ((await getPublishedLegalDocument(c.rules_doc_slug))?.version ?? null)
      : null;

    if (enrolledIds.has(c.id as string) && c.status === "active") {
      const bands: LadderBand[] = cs.model === "ladder" ? (cs.bands ?? []) : [];
      const [{ data: scores }, { data: pausedHere }, { data: bookData }] =
        await Promise.all([
          admin.rpc("campaign_active_listings", { p_campaign_id: c.id }),
          admin
            .from("affiliate_campaign_enrollments")
            .select("affiliate_id")
            .eq("campaign_id", c.id)
            .eq("status", "paused"),
          admin.rpc("campaign_ladder_book", {
            p_affiliate_id: me.id,
            p_campaign_id: c.id,
            p_asof: new Date().toISOString(),
          }),
        ]);
      const pausedIds = new Set(
        (pausedHere ?? []).map((p) => p.affiliate_id as string),
      );
      const allRows = (
        (scores ?? []) as { affiliate_id: string; active_listings: number }[]
      ).filter((s) => s.active_listings > 0);
      const ranked = allRows
        .filter((s) => !pausedIds.has(s.affiliate_id))
        .sort((a, b) => b.active_listings - a.active_listings);
      const iAmPaused = pausedIds.has(me.id);
      const myIdx = ranked.findIndex((s) => s.affiliate_id === me.id);
      const score = iAmPaused
        ? (allRows.find((s) => s.affiliate_id === me.id)?.active_listings ?? 0)
        : myIdx >= 0
          ? ranked[myIdx].active_listings
          : 0;
      const book = Number(bookData ?? 0);
      const rate = bands.length ? ladderRateForBook(bands, book) : 0;
      const rung = bands.length ? nextLadderRung(bands, book) : null;
      let progressPct = 100;
      if (rung && bands.length) {
        const sorted = [...bands].sort(
          (a, b) =>
            (a.max ?? Number.POSITIVE_INFINITY) -
            (b.max ?? Number.POSITIVE_INFINITY),
        );
        const idx = sorted.findIndex(
          (b) => b.max !== null && book <= (b.max ?? 0),
        );
        const floor = idx > 0 ? (sorted[idx - 1]!.max ?? 0) : 0;
        const ceiling = sorted[idx]?.max ?? floor;
        const span = Math.max(1, ceiling - floor);
        progressPct = Math.max(
          0,
          Math.min(100, Math.round(((book - floor) / span) * 100)),
        );
      }
      enrolledCards.push({
        id: c.id as string,
        name: c.name as string,
        slug: c.slug as string,
        hasCompetition,
        endsLabel: dateLabel(c.ends_at as string | null),
        daysLeft: daysLeft(c.ends_at as string | null),
        rank: iAmPaused || myIdx < 0 ? null : myIdx + 1,
        ofN: ranked.length,
        score,
        ratePct: Math.round(rate * 100),
        earned: earnedByCampaign(c.id as string),
        toNextLabel:
          rung && bands.length
            ? `${zar(rung.toNext)} to the ${Math.round(rung.nextRate * 100)}% rung`
            : null,
        progressPct,
        link: `${appUrl}/c/${c.slug}/${me.slug}`,
      });
    } else if (!enrolledIds.has(c.id as string)) {
      const runs =
        [
          dateLabel(c.starts_at as string | null),
          dateLabel(c.ends_at as string | null),
        ]
          .filter(Boolean)
          .join(" – ") || "Open-ended";
      openCards.push({
        id: c.id as string,
        name: c.name as string,
        description: describeCommissionStructure(cs),
        commission: describeCommissionStructure(cs),
        runs,
        hasCompetition,
        status: c.status === "ended" ? "ended" : "open",
        rulesHref: c.rules_doc_slug ? `/legal/${c.rules_doc_slug}` : null,
        rulesVersion,
        endedResult: null,
        stillEarning:
          earnedByCampaign(c.id as string) > 0
            ? `${zar(earnedByCampaign(c.id as string))} earned to date`
            : null,
      });
    }
  }

  return (
    <div>
      <p className="fade max-w-2xl text-[13px] leading-relaxed text-brand-mute">
        Campaigns are extra programs you can join on top of your default link.
        Each has its own link, its own commission structure, and sometimes a
        competition. Hosts you refer through a campaign link keep earning you
        that campaign&apos;s rates for life — even after the campaign ends.
      </p>

      {/* YOUR CAMPAIGNS */}
      {enrolledCards.length > 0 ? (
        <>
          <div className="smallcaps fade mt-5">Your campaigns</div>
          <section className="fade mt-2.5 space-y-3">
            {enrolledCards.map((c) => (
              <AffiliateBaseLink
                key={c.id}
                suffix={`/race/${c.slug}`}
                className="brow block overflow-hidden !p-0"
              >
                <div className="flex flex-col sm:flex-row">
                  <div className="flex shrink-0 flex-col justify-between gap-4 bg-brand-dark p-5 sm:w-[220px]">
                    <div>
                      <span className="tag amber">
                        <span className="d" />
                        Live{c.hasCompetition ? " · competition" : ""}
                      </span>
                    </div>
                    <div>
                      <div className="font-display text-[18px] font-extrabold leading-tight text-white">
                        {c.name}
                      </div>
                      <div className="mt-1 text-[11.5px] text-white/60">
                        {c.endsLabel
                          ? `Ends ${c.endsLabel}${c.daysLeft != null ? ` · ${c.daysLeft} days left` : ""}`
                          : "Open-ended"}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 p-5">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <Stat
                        label="Your rank"
                        value={c.rank ? `#${c.rank}` : "—"}
                        sub={`of ${c.ofN}`}
                      />
                      <Stat label="Score" value={String(c.score)} />
                      <Stat label="Current rate" value={`${c.ratePct}%`} />
                      <Stat label="Earned here" value={zar(c.earned)} />
                    </div>
                    {c.toNextLabel ? (
                      <div className="mt-4 flex items-center gap-3">
                        <div className="flex-1">
                          <div className="pbar">
                            <div style={{ width: `${c.progressPct}%` }} />
                          </div>
                        </div>
                        <span className="num whitespace-nowrap text-[11px] font-semibold text-brand-secondary">
                          {c.toNextLabel}
                        </span>
                      </div>
                    ) : null}
                    <div className="mt-4 flex items-center gap-2">
                      <span className="btn-pri pointer-events-none h-8 px-4 text-[12px]">
                        Open race
                      </span>
                      <span className="mono truncate text-[11.5px] text-brand-mute">
                        {c.link.replace(/^https?:\/\//, "")}
                      </span>
                    </div>
                  </div>
                </div>
              </AffiliateBaseLink>
            ))}
          </section>
        </>
      ) : null}

      {/* OPEN TO JOIN */}
      {openCards.length > 0 ? (
        <>
          <div className="smallcaps fade mt-7">Open to join</div>
          <section className="fade mt-2.5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {openCards.map((c) => (
              <CampaignJoinCard key={c.id} c={c} />
            ))}
          </section>
        </>
      ) : null}

      {enrolledCards.length === 0 && openCards.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-brand-line bg-white p-8 text-center text-sm text-brand-mute">
          No campaigns are running right now. Check back soon.
        </div>
      ) : null}

      {/* HOW LAYERS WORK */}
      <section className="am-card fade mt-7 overflow-hidden">
        <div className="smallcaps border-b border-brand-line px-5 py-3.5">
          How campaigns and your default link work together
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 text-[12.5px] leading-relaxed sm:grid-cols-3">
          {[
            [
              "One host, one program",
              "Each referred host belongs to whichever link they signed up through — plain or campaign. Never both.",
            ],
            [
              "First link wins",
              "Once a host is yours, they're yours forever. A later campaign link can't move them.",
            ],
            [
              "Rates outlive the race",
              "Competitions end; commission doesn't. Campaign-referred hosts pay campaign rates for life.",
            ],
          ].map(([title, body], i) => (
            <div key={i} className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-accent font-display text-[13px] font-bold text-brand-secondary">
                {i + 1}
              </div>
              <div>
                <div className="font-semibold text-brand-ink">{title}</div>
                <div className="mt-0.5 text-brand-mute">{body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="smallcaps">{label}</div>
      <div className="num mt-1 font-display text-[18px] font-bold text-brand-ink">
        {value}
        {sub ? (
          <span className="text-[11px] font-semibold text-brand-mute">
            {" "}
            {sub}
          </span>
        ) : null}
      </div>
    </div>
  );
}
