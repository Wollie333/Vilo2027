import type { Metadata } from "next";
import { Flag, Globe } from "lucide-react";

import { getAffiliateForUser } from "@/lib/affiliate/account";
import { getAffiliateTier } from "@/lib/affiliate/tiers";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { CopyLinkButton } from "../_components/CopyLinkButton";
import { LinkBuilderPanel } from "../_components/LinkBuilderPanel";
import {
  ProductRatesTable,
  type RateRow,
} from "../_components/ProductRatesTable";

export const metadata: Metadata = { title: "Affiliate links" };
export const dynamic = "force-dynamic";

const PAID_PLANS = new Set(["basic", "pro", "business"]);

type ProductRow = {
  id: string;
  name: string;
  slug: string | null;
  price: number;
  currency: string;
  billing_cycle: string | null;
  type: string;
  affiliate_type: "none" | "amount" | "percent";
  affiliate_value: number;
  affiliate_duration: "once" | "months" | "forever";
  affiliate_duration_months: number | null;
};

function ptypeOf(type: string): RateRow["ptype"] {
  const t = (type || "").toLowerCase();
  if (t === "subscription") return "subscription";
  if (t.includes("service")) return "service";
  if (t.includes("package") || t.includes("bundle")) return "package";
  return "onceoff";
}

function pctStr(n: number): string {
  const r = Math.round(n * 100) / 100;
  return `${r % 1 === 0 ? r.toFixed(0) : r.toFixed(2).replace(/0$/, "")}%`;
}

export default async function AffiliateLinksPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const account = await getAffiliateForUser(admin, user.id);
  if (!account) return null;

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://wielo.co.za";
  const refUrl = `${baseUrl}/r/${account.slug}`;

  const [
    { data: products },
    tier,
    { count: clickCount },
    { data: referrals },
    { data: commissions },
    { data: enrollments },
  ] = await Promise.all([
    admin
      .from("products")
      .select(
        "id, name, slug, price, currency, billing_cycle, type, affiliate_type, affiliate_value, affiliate_duration, affiliate_duration_months",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    getAffiliateTier(admin, account.id),
    admin
      .from("affiliate_clicks")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_id", account.id),
    admin
      .from("affiliate_referrals")
      .select("id, referred_user_id, campaign_id")
      .eq("affiliate_id", account.id),
    admin
      .from("affiliate_commissions")
      .select("commission_amount, status, campaign_id")
      .eq("affiliate_id", account.id),
    admin
      .from("affiliate_campaign_enrollments")
      .select("campaign_id, status")
      .eq("affiliate_id", account.id)
      .in("status", ["active", "paused"]),
  ]);

  const bonus = tier.current?.bonusPercent ?? 0;
  const mult = 1 + bonus / 100;

  // Which referred hosts are paying (for the per-link "active" count).
  const refs = referrals ?? [];
  const userIds = refs.map((r) => r.referred_user_id);
  const { data: hosts } = userIds.length
    ? await admin.from("hosts").select("id, user_id").in("user_id", userIds)
    : { data: [] as { id: string; user_id: string }[] };
  const hostByUser = new Map((hosts ?? []).map((h) => [h.user_id, h.id]));
  const hostIds = (hosts ?? []).map((h) => h.id);
  const { data: subs } = hostIds.length
    ? await admin
        .from("subscriptions")
        .select("host_id, plan, status")
        .in("host_id", hostIds)
    : {
        data: [] as { host_id: string; plan: string | null; status: string }[],
      };
  const payingHosts = new Set(
    (subs ?? [])
      .filter(
        (s) =>
          s.plan != null &&
          PAID_PLANS.has(s.plan) &&
          ["active", "trialing", "past_due"].includes(s.status),
      )
      .map((s) => s.host_id),
  );
  const isPaying = (uid: string) => {
    const h = hostByUser.get(uid);
    return !!h && payingHosts.has(h);
  };

  // Per-campaign stats (null campaign = default program).
  function statsFor(campaignId: string | null) {
    const rs = refs.filter((r) => (r.campaign_id ?? null) === campaignId);
    const earned = (commissions ?? [])
      .filter(
        (c) => (c.campaign_id ?? null) === campaignId && c.status !== "voided",
      )
      .reduce((s, c) => s + Number(c.commission_amount), 0);
    return {
      signups: rs.length,
      active: rs.filter((r) => isPaying(r.referred_user_id)).length,
      earned,
    };
  }
  const defaultStats = statsFor(null);

  // Enrolled campaigns → campaign links + Your-links rows.
  const enrolledIds = (enrollments ?? []).map((e) => e.campaign_id as string);
  const { data: campaigns } = enrolledIds.length
    ? await admin
        .from("affiliate_campaigns")
        .select("id, slug, name")
        .in("id", enrolledIds)
    : { data: [] as { id: string; slug: string; name: string }[] };

  const campaignLinks = (campaigns ?? []).map((c) => {
    const s = statsFor(c.id);
    return {
      id: c.id,
      name: c.name as string,
      url: `${baseUrl}/c/${c.slug}/${account.slug}`,
      display: `${baseUrl}/c/${c.slug}/${account.slug}`.replace(
        /^https?:\/\//,
        "",
      ),
      ...s,
    };
  });
  const campaignOpts = (campaigns ?? []).map((c) => ({
    slug: c.slug as string,
    name: c.name as string,
  }));

  // Product rate rows (real config × tier bonus).
  const rows = (products ?? []) as ProductRow[];
  const earning = rows.filter((p) => p.affiliate_type !== "none");
  const cycleSuffix = (p: ProductRow) =>
    p.type === "subscription"
      ? p.billing_cycle === "year" || p.billing_cycle === "annual"
        ? " /yr"
        : " /mo"
      : "";
  const durationOf = (p: ProductRow): RateRow["duration"] => {
    if (p.type !== "subscription") return { cls: "gray", label: "Once" };
    if (p.affiliate_duration === "forever")
      return { cls: "green", label: "Lifetime" };
    if (p.affiliate_duration === "months")
      return {
        cls: "indigo",
        label: `Recurring · ${p.affiliate_duration_months ?? 0} mo`,
      };
    return { cls: "gray", label: "First payment" };
  };
  const rateRows: RateRow[] = earning.map((p) => {
    const isPct = p.affiliate_type === "percent";
    const baseRate = isPct
      ? pctStr(Number(p.affiliate_value))
      : formatMoney(Number(p.affiliate_value), p.currency);
    const yourRateNum = Number(p.affiliate_value) * mult;
    const yourRate = isPct
      ? pctStr(yourRateNum)
      : formatMoney(yourRateNum, p.currency);
    const earnNum = isPct ? (Number(p.price) * yourRateNum) / 100 : yourRateNum;
    return {
      id: p.id,
      ptype: ptypeOf(p.type),
      name: p.name,
      subtitle:
        p.type === "subscription"
          ? `${cycleSuffix(p).trim() === "/yr" ? "Yearly" : "Monthly"} subscription`
          : ptypeOf(p.type) === "service"
            ? "Service"
            : ptypeOf(p.type) === "package"
              ? "Package"
              : "Once-off",
      price: formatMoney(Number(p.price), p.currency) + cycleSuffix(p),
      baseRate,
      yourRate,
      duration: durationOf(p),
      youEarn: formatMoney(earnNum, p.currency) + cycleSuffix(p),
      link: `${refUrl}?next=${encodeURIComponent(p.slug ? `/p/${p.slug}` : "/")}`,
    };
  });

  const clicks = clickCount ?? 0;

  return (
    <div>
      {/* YOUR LINKS */}
      <section className="am-card fade overflow-hidden">
        <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
          <div className="smallcaps">Your links</div>
          <span className="text-[11.5px] text-brand-mute">
            Plain link earns your default rates · campaign links earn campaign
            rates
          </span>
        </div>
        <div className="space-y-2.5 p-2.5">
          {/* Default link */}
          <div
            className="brow"
            style={{ cursor: "default", transform: "none" }}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-brand-line bg-brand-light text-brand-secondary">
              <Globe className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold text-brand-ink">
                  Default link
                </span>
                <span className="tag green">
                  <span className="d" />
                  Default program
                </span>
              </div>
              <div className="mono mt-0.5 truncate text-[12px] text-brand-mute">
                {refUrl.replace(/^https?:\/\//, "")}
              </div>
            </div>
            <div className="num hidden shrink-0 text-right text-[11.5px] text-brand-mute md:block">
              {clicks} clicks · {defaultStats.signups} signups
              <br />
              {defaultStats.active} active ·{" "}
              {formatMoney(defaultStats.earned, account.currency)} earned
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <CopyLinkButton value={refUrl} className="btn-ghost h-8" />
            </div>
          </div>
          {/* Campaign links */}
          {campaignLinks.map((c) => (
            <div
              key={c.id}
              className="brow"
              style={{ cursor: "default", transform: "none" }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-[#FCE9B6] bg-[#FFFBEB] text-[#B45309]">
                <Flag className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-brand-ink">
                    {c.name} link
                  </span>
                  <span className="tag amber">
                    <span className="d" />
                    Campaign
                  </span>
                </div>
                <div className="mono mt-0.5 truncate text-[12px] text-brand-mute">
                  {c.display}
                </div>
              </div>
              <div className="num hidden shrink-0 text-right text-[11.5px] text-brand-mute md:block">
                {c.signups} signups · {c.active} active
                <br />
                {formatMoney(c.earned, account.currency)} earned
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <CopyLinkButton value={c.url} className="btn-ghost h-8" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* LINK BUILDER */}
      <LinkBuilderPanel
        baseUrl={baseUrl}
        slug={account.slug}
        products={earning.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
        }))}
        campaigns={campaignOpts}
      />

      {/* PER-PRODUCT RATES */}
      {rateRows.length > 0 ? (
        <ProductRatesTable
          rows={rateRows}
          bonusNote={
            bonus > 0 ? `${tier.current?.name} +${bonus}% bonus applied` : null
          }
        />
      ) : null}
    </div>
  );
}
