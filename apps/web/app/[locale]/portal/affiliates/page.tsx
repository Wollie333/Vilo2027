import type { Metadata } from "next";
import {
  ArrowRight,
  ChevronRight,
  Globe,
  Image as ImageIcon,
  Mail,
  Medal,
  MessageCircle,
  QrCode,
  TrendingUp,
} from "lucide-react";

import {
  ladderRateForBook,
  nextLadderRung,
  type CommissionStructure,
  type LadderBand,
} from "@/lib/affiliate/campaigns";
import { getAffiliateBalance } from "@/lib/affiliate/balance";
import { getAffiliateForUser } from "@/lib/affiliate/account";
import { getAffiliateTier } from "@/lib/affiliate/tiers";
import { round2 } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { AffiliateBaseLink } from "./_components/AffiliateBaseLink";
import { CopyLinkButton } from "./_components/CopyLinkButton";
import { EarningsCalculator } from "./_components/EarningsCalculator";

export const metadata: Metadata = { title: "Affiliates" };
export const dynamic = "force-dynamic";

const PAID_PLANS = new Set(["basic", "pro", "business"]);

function zar(n: number): string {
  return "R " + Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
}
function zarSigned(n: number): string {
  const s = n < 0 ? "−" : "+";
  return (
    s +
    "R " +
    Math.abs(n)
      .toLocaleString("en-ZA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      .replace(/,/g, " ")
  );
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "··";
}
function relDate(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return then.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}
const AV_CLASSES = ["av-1", "av-2", "av-3", "av-4", "av-6", "av-7"];

export default async function AffiliateOverviewPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const account = await getAffiliateForUser(admin, user.id);
  if (!account) return null; // layout shows the terms gate

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://wielo.co.za";
  const refUrl = `${baseUrl}/r/${account.slug}`;
  const refUrlShort = refUrl.replace(/^https?:\/\//, "");

  const [
    balance,
    { count: clickCount },
    { data: referrals },
    { data: commissions },
    { data: planProduct },
    tier,
  ] = await Promise.all([
    getAffiliateBalance(admin, account.id),
    admin
      .from("affiliate_clicks")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_id", account.id),
    admin
      .from("affiliate_referrals")
      .select("id, referred_user_id, bound_at")
      .eq("affiliate_id", account.id)
      .order("bound_at", { ascending: false }),
    admin
      .from("affiliate_commissions")
      .select(
        "id, referral_id, commission_amount, status, entry_type, kind, campaign_id, created_at",
      )
      .eq("affiliate_id", account.id)
      .order("created_at", { ascending: false }),
    admin
      .from("products")
      .select("price, name")
      .eq("slug", "pro")
      .eq("is_active", true)
      .maybeSingle(),
    getAffiliateTier(admin, account.id),
  ]);

  const refs = referrals ?? [];
  const userIds = refs.map((r) => r.referred_user_id);

  const [{ data: profiles }, { data: hosts }] = await Promise.all([
    userIds.length
      ? admin.from("user_profiles").select("id, full_name").in("id", userIds)
      : Promise.resolve({
          data: [] as { id: string; full_name: string | null }[],
        }),
    userIds.length
      ? admin.from("hosts").select("id, user_id").in("user_id", userIds)
      : Promise.resolve({ data: [] as { id: string; user_id: string }[] }),
  ]);

  const nameByUser = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name || "A host"]),
  );
  const hostByUser = new Map((hosts ?? []).map((h) => [h.user_id, h.id]));
  const referralUser = new Map(refs.map((r) => [r.id, r.referred_user_id]));

  // Paying hosts among referrals (active/trialing/past_due on a paid plan).
  const hostIds = (hosts ?? []).map((h) => h.id);
  const { data: subs } = hostIds.length
    ? await admin
        .from("subscriptions")
        .select("host_id, plan, status")
        .in("host_id", hostIds)
    : {
        data: [] as { host_id: string; plan: string | null; status: string }[],
      };
  const payingHostIds = new Set(
    (subs ?? [])
      .filter(
        (s) =>
          s.plan != null &&
          PAID_PLANS.has(s.plan) &&
          ["active", "trialing", "past_due"].includes(s.status),
      )
      .map((s) => s.host_id),
  );
  const paidCount = refs.filter((r) => {
    const hid = hostByUser.get(r.referred_user_id);
    return hid && payingHostIds.has(hid);
  }).length;

  const clicks = clickCount ?? 0;
  const signups = refs.length;

  // This-month earned (positive accruals only).
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const thisMonthEarned = round2(
    (commissions ?? [])
      .filter(
        (c) =>
          c.status !== "voided" &&
          Number(c.commission_amount) > 0 &&
          new Date(c.created_at).getTime() >= monthStart,
      )
      .reduce((s, c) => s + Number(c.commission_amount), 0),
  );

  // Recent commission activity (latest 5 rows).
  const kindLabel = (kind: string | null): string => {
    switch (kind) {
      case "conversion_bonus":
        return "conversion bonus";
      case "setup_fee":
        return "setup fee";
      case "upgrade":
        return "plan upgrade";
      default:
        return "subscription";
    }
  };
  const recent = (commissions ?? []).slice(0, 5).map((c, i) => {
    const uid = referralUser.get(c.referral_id);
    const name = uid ? (nameByUser.get(uid) ?? "A host") : "A host";
    const amt = Number(c.commission_amount);
    const reversed =
      c.entry_type !== "accrual" || amt < 0 || c.status === "voided";
    const tag = reversed
      ? { cls: "gray", label: "Reversed" }
      : c.status === "pending"
        ? { cls: "amber", label: "Pending" }
        : c.status === "paid"
          ? { cls: "green", label: "Paid" }
          : { cls: "green", label: "Cleared" };
    return {
      id: c.id,
      av: AV_CLASSES[i % AV_CLASSES.length],
      initials: initials(name),
      title: reversed ? `Refund · ${name}` : `${name} · ${kindLabel(c.kind)}`,
      sub: `${relDate(c.created_at)} · ${c.campaign_id ? "Founding Race" : "default program"}`,
      amount: zarSigned(amt),
      negative: amt < 0,
      tag,
    };
  });

  // ── Founding Race strip: the partner's first enrolled active competition ──
  const { data: enrollments } = await admin
    .from("affiliate_campaign_enrollments")
    .select("campaign_id, status")
    .eq("affiliate_id", account.id)
    .in("status", ["active", "paused"]);
  const enrolledIds = new Set(
    (enrollments ?? []).map((e) => e.campaign_id as string),
  );

  let race: {
    name: string;
    slug: string;
    endsLabel: string | null;
    rank: number | null;
    ofN: number;
    score: number;
    ratePct: number;
    book: number;
    targetBook: number | null;
    nextRatePct: number | null;
    progressPct: number;
  } | null = null;

  if (enrolledIds.size > 0) {
    const { data: campaigns } = await admin
      .from("affiliate_campaigns")
      .select("id, slug, name, ends_at, commission_structure, competition")
      .eq("status", "active")
      .order("created_at", { ascending: true });
    const c = (campaigns ?? []).find(
      (x) => enrolledIds.has(x.id as string) && x.competition,
    );
    if (c) {
      const cs = (c.commission_structure ?? {
        model: "inherit",
      }) as CommissionStructure;
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
            p_affiliate_id: account.id,
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
      const rankedRows = allRows
        .filter((s) => !pausedIds.has(s.affiliate_id))
        .sort((a, b) => b.active_listings - a.active_listings);
      const iAmPaused = pausedIds.has(account.id);
      const myIdx = rankedRows.findIndex((s) => s.affiliate_id === account.id);
      const score = iAmPaused
        ? (allRows.find((s) => s.affiliate_id === account.id)
            ?.active_listings ?? 0)
        : myIdx >= 0
          ? rankedRows[myIdx].active_listings
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
      race = {
        name: c.name as string,
        slug: c.slug as string,
        endsLabel: c.ends_at
          ? new Date(c.ends_at as string).toLocaleDateString("en-ZA", {
              day: "numeric",
              month: "short",
            })
          : null,
        rank: iAmPaused || myIdx < 0 ? null : myIdx + 1,
        ofN: rankedRows.length,
        score,
        ratePct: Math.round(rate * 100),
        book,
        targetBook: rung ? book + rung.toNext : null,
        nextRatePct: rung ? Math.round(rung.nextRate * 100) : null,
        progressPct,
      };
    }
  }

  const perHostPrice = Number(planProduct?.price ?? 599);
  const planLabel = (planProduct?.name as string | null) ?? "Growth";
  const calcRatePct = race?.ratePct || 20;
  const tierBonus = tier.current?.bonusPercent ?? 0;

  return (
    <div className="space-y-6">
      {/* EARNINGS BAND */}
      <section className="fade grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-brand-line bg-brand-line sm:grid-cols-4">
        <div className="col-span-2 bg-brand-secondary p-4 sm:col-span-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
            Cleared · yours now
          </div>
          <div className="num mt-1.5 font-display text-[24px] font-bold leading-none text-white">
            {zar(balance.available)}
          </div>
          <div className="mt-1 text-[11px] text-brand-accent">
            Ready to pay out
          </div>
        </div>
        <div className="bg-[#FAFCFB] p-4">
          <div className="smallcaps">Pending</div>
          <div className="num mt-1.5 font-display text-[22px] font-bold leading-none text-brand-ink">
            {zar(balance.pending)}
          </div>
          <div className="mt-1 text-[11px] text-brand-mute">
            Clears after the hold window
          </div>
        </div>
        <div className="bg-[#FAFCFB] p-4">
          <div className="smallcaps">Lifetime earned</div>
          <div className="num mt-1.5 font-display text-[22px] font-bold leading-none text-brand-ink">
            {zar(balance.lifetime)}
          </div>
          {thisMonthEarned > 0 ? (
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-status-confirmed">
              <TrendingUp className="h-3 w-3" /> +{zar(thisMonthEarned)} this
              month
            </div>
          ) : (
            <div className="mt-1 text-[11px] text-brand-mute">
              across all time
            </div>
          )}
        </div>
        <div className="bg-[#FAFCFB] p-4">
          <div className="smallcaps">Active referred hosts</div>
          <div className="num mt-1.5 font-display text-[22px] font-bold leading-none text-brand-ink">
            {paidCount}
          </div>
          <div className="mt-1 text-[11px] text-brand-mute">
            {signups} signed up · {paidCount} paying
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* LEFT COLUMN */}
        <div className="min-w-0 space-y-6">
          {/* YOUR LINK */}
          <section className="am-card fade overflow-hidden">
            <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
              <div className="smallcaps">
                Your referral link · default program
              </div>
              <AffiliateBaseLink
                suffix="/products"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-primary hover:underline"
              >
                Link builder <ArrowRight className="h-3.5 w-3.5" />
              </AffiliateBaseLink>
            </div>
            <div className="p-5">
              <div className="copyfield">
                <Globe className="h-4 w-4 shrink-0 text-brand-mute" />
                <span className="mono flex-1 truncate text-[13px] text-brand-ink">
                  {refUrlShort}
                </span>
                <CopyLinkButton value={refUrl} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  className="btn-ghost"
                  href={`https://wa.me/?text=${encodeURIComponent(refUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
                <a
                  className="btn-ghost"
                  href={`mailto:?subject=${encodeURIComponent("Join me on Wielo")}&body=${encodeURIComponent(refUrl)}`}
                >
                  <Mail className="h-3.5 w-3.5" /> Email
                </a>
                <AffiliateBaseLink suffix="/products" className="btn-ghost">
                  <QrCode className="h-3.5 w-3.5" /> QR code
                </AffiliateBaseLink>
                <span className="num ml-auto text-[12px] text-brand-mute">
                  {clicks} clicks · {signups} signups · {paidCount} active
                </span>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-brand-mute">
                Every host who joins through this link earns you your{" "}
                <strong className="text-brand-ink">
                  per-product commission, for as long as they stay
                </strong>
                {tierBonus > 0 ? (
                  <>
                    {" "}
                    — plus your {tier.current?.name} tier bonus (+{tierBonus}%)
                  </>
                ) : null}
                . Hosts you refer through a campaign link earn under that
                campaign instead.
              </p>
            </div>
          </section>

          {/* FOUNDING RACE STRIP */}
          {race ? (
            <section className="am-card fade overflow-hidden">
              <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="smallcaps">{race.name}</span>
                  <span className="tag amber">
                    <span className="d" />
                    Live{race.endsLabel ? ` · ends ${race.endsLabel}` : ""}
                  </span>
                </div>
                <AffiliateBaseLink
                  suffix="/competitions"
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-primary hover:underline"
                >
                  Open race <ArrowRight className="h-3.5 w-3.5" />
                </AffiliateBaseLink>
              </div>
              <div className="grid grid-cols-3 gap-px bg-brand-line">
                <div className="bg-white p-4">
                  <div className="smallcaps">Your rank</div>
                  <div className="num mt-1 font-display text-[20px] font-bold text-brand-ink">
                    {race.rank ? `#${race.rank}` : "—"}{" "}
                    <span className="text-[12px] font-semibold text-brand-mute">
                      of {race.ofN}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-brand-mute">
                    {race.rank ? "in the race" : "paused"}
                  </div>
                </div>
                <div className="bg-white p-4">
                  <div className="smallcaps">Score</div>
                  <div className="num mt-1 font-display text-[20px] font-bold text-brand-ink">
                    {race.score}
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-brand-mute">
                    active listings
                  </div>
                </div>
                <div className="bg-white p-4">
                  <div className="smallcaps">Race rate</div>
                  <div className="num mt-1 font-display text-[20px] font-bold text-brand-ink">
                    {race.ratePct}%
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-brand-mute">
                    {race.targetBook && race.nextRatePct
                      ? `${zar(race.targetBook - race.book)} book to ${race.nextRatePct}%`
                      : "top rate"}
                  </div>
                </div>
              </div>
              {race.targetBook ? (
                <div className="flex items-center gap-3 border-t border-brand-line bg-brand-light/60 px-5 py-3">
                  <div className="flex-1">
                    <div className="pbar">
                      <div style={{ width: `${race.progressPct}%` }} />
                    </div>
                  </div>
                  <span className="num text-[11.5px] font-semibold text-brand-secondary">
                    {zar(race.book)} / {zar(race.targetBook)} monthly book
                  </span>
                </div>
              ) : null}
            </section>
          ) : (
            <AffiliateBaseLink suffix="/competitions" className="brow fade">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-accent text-brand-secondary">
                <Medal className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-brand-ink">
                  Join the Founding Race
                </div>
                <div className="text-[12.5px] text-brand-mute">
                  Compete on the public leaderboard for a higher commission rate
                  and cash prizes.
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-brand-mute" />
            </AffiliateBaseLink>
          )}

          {/* RECENT ACTIVITY */}
          <section className="am-card fade overflow-hidden">
            <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
              <div className="smallcaps">Recent commission activity</div>
              <AffiliateBaseLink
                suffix="/payouts"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-primary hover:underline"
              >
                All statements <ArrowRight className="h-3.5 w-3.5" />
              </AffiliateBaseLink>
            </div>
            <div className="p-2.5">
              {recent.length === 0 ? (
                <div className="px-3 py-8 text-center text-[13px] text-brand-mute">
                  No commission yet — share your link and your first earnings
                  will show up here.
                </div>
              ) : (
                recent.map((r) => (
                  <div key={r.id} className="arow">
                    <div
                      className={`av ${r.av} h-9 w-9 shrink-0 rounded-full text-[11px]`}
                    >
                      {r.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold text-brand-ink">
                        {r.title}
                      </div>
                      <div className="mt-0.5 text-[12px] text-brand-mute">
                        {r.sub}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={`num text-[13.5px] font-bold ${r.negative ? "text-status-cancelled" : "text-brand-ink"}`}
                      >
                        {r.amount}
                      </div>
                      <span className={`tag ${r.tag.cls} mt-1`}>
                        <span className="d" />
                        {r.tag.label}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* RIGHT RAIL */}
        <div className="min-w-0 space-y-6">
          {/* TIER CARD */}
          {tier.current ? (
            <section className="am-card fade overflow-hidden">
              <div className="smallcaps border-b border-brand-line px-5 py-3.5">
                Your tier · default program
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-line bg-[#F1F5F4]">
                    <Medal className="h-5 w-5 text-[#64748B]" />
                  </div>
                  <div>
                    <div className="font-display text-[16px] font-bold text-brand-ink">
                      {tier.current.name}
                    </div>
                    <div className="text-[11.5px] text-brand-mute">
                      {tier.current.bonusPercent > 0
                        ? `+${tier.current.bonusPercent}% bonus on your base rate`
                        : "base commission rate"}
                    </div>
                  </div>
                </div>
                {tier.next ? (
                  <>
                    <div className="mt-4">
                      <div className="pbar">
                        <div
                          style={{
                            width: `${Math.min(100, Math.round((tier.earnings / tier.next.minEarnings) * 100))}%`,
                          }}
                        />
                      </div>
                      <div className="num mt-2 flex justify-between text-[11px] text-brand-mute">
                        <span>{zar(tier.earnings)} lifetime cleared</span>
                        <span>
                          {tier.next.name} at {zar(tier.next.minEarnings)}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-[11.5px] leading-relaxed text-brand-mute">
                      {tier.next.name} adds a +{tier.next.bonusPercent}% bonus
                      to every default-program commission, forever.
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-[11.5px] leading-relaxed text-brand-mute">
                    You&apos;ve reached the top tier — nice work.
                  </p>
                )}
              </div>
            </section>
          ) : null}

          {/* CALCULATOR */}
          <EarningsCalculator
            perHostPrice={perHostPrice}
            ratePct={calcRatePct}
            planLabel={planLabel}
          />

          {/* MARKETING SHORTCUT */}
          <section className="am-card fade overflow-hidden">
            <div className="smallcaps border-b border-brand-line px-5 py-3.5">
              Share-ready assets
            </div>
            <div className="p-2.5">
              <AffiliateBaseLink suffix="/marketing" className="arow">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-accent text-brand-secondary">
                  <ImageIcon className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-brand-ink">
                    Marketing library
                  </div>
                  <div className="mt-0.5 text-[12px] text-brand-mute">
                    Posts, banners &amp; captions
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-brand-mute" />
              </AffiliateBaseLink>
              <AffiliateBaseLink suffix="/products" className="arow">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-accent text-brand-secondary">
                  <QrCode className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-brand-ink">
                    QR &amp; deep links
                  </div>
                  <div className="mt-0.5 text-[12px] text-brand-mute">
                    Build a link for any page or product
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-brand-mute" />
              </AffiliateBaseLink>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
