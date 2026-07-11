import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  Coins,
  MousePointerClick,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

import {
  AdminColumn,
  AdminTable,
} from "@/app/[locale]/admin/_components/AdminTable";
import { getAffiliateBalance } from "@/lib/affiliate/balance";
import { getAffiliateForUser } from "@/lib/affiliate/account";
import { commissionLabel } from "@/lib/affiliate/commission";
import { formatMoney, round2 } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { AffiliateLinkBuilder } from "./_components/AffiliateLinkBuilder";
import { ReferralLinkCard } from "./_components/ReferralLinkCard";

export const metadata: Metadata = { title: "Affiliates" };
export const dynamic = "force-dynamic";

const PAID_PLANS = new Set(["basic", "pro", "business"]);

type ReferredRow = {
  id: string;
  name: string;
  email: string | null;
  plan: string;
  paid: boolean;
  joined: string;
  commission: number;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

export default async function AffiliateOverviewPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const account = await getAffiliateForUser(admin, user.id);
  if (!account) return null; // layout shows the terms gate

  const [
    balance,
    { count: clickCount },
    { data: referrals },
    { data: settings },
    { data: productRows },
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
      .from("affiliate_settings")
      .select("min_payout_threshold")
      .eq("id", true)
      .maybeSingle(),
    admin
      .from("products")
      .select("id, name, slug, currency, affiliate_type, affiliate_value")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  // Products the affiliate can build a link for (any active product; the label
  // shows what they'd earn where a commission is configured).
  const productOptions = (productRows ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    slug: (p.slug as string | null) ?? null,
    commissionLabel:
      p.affiliate_type && p.affiliate_type !== "none"
        ? commissionLabel(
            p.affiliate_type as "amount" | "percent",
            Number(p.affiliate_value),
            (p.currency as string) ?? "ZAR",
          )
        : null,
  }));

  const refs = referrals ?? [];
  const userIds = refs.map((r) => r.referred_user_id);

  // Resolve each referred user's profile, their plan (if a host), and the
  // commission earned from them — all in a few batched queries.
  const [{ data: profiles }, { data: hosts }, { data: commissions }] =
    await Promise.all([
      userIds.length
        ? admin
            .from("user_profiles")
            .select("id, full_name, email")
            .in("id", userIds)
        : Promise.resolve({
            data: [] as {
              id: string;
              full_name: string | null;
              email: string | null;
            }[],
          }),
      userIds.length
        ? admin.from("hosts").select("id, user_id").in("user_id", userIds)
        : Promise.resolve({ data: [] as { id: string; user_id: string }[] }),
      admin
        .from("affiliate_commissions")
        .select("referral_id, commission_amount, status")
        .eq("affiliate_id", account.id),
    ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const hostByUser = new Map((hosts ?? []).map((h) => [h.user_id, h.id]));

  // Plan per host (active/trialing subscriptions only).
  const hostIds = (hosts ?? []).map((h) => h.id);
  const { data: subs } = hostIds.length
    ? await admin
        .from("subscriptions")
        .select("host_id, plan, status")
        .in("host_id", hostIds)
    : {
        data: [] as { host_id: string; plan: string | null; status: string }[],
      };
  const planByHost = new Map(
    (subs ?? []).map((s) => [s.host_id, { plan: s.plan, status: s.status }]),
  );

  // Lifetime commission per referral (exclude voided).
  const commByReferral = new Map<string, number>();
  for (const c of commissions ?? []) {
    if (c.status === "voided") continue;
    commByReferral.set(
      c.referral_id,
      (commByReferral.get(c.referral_id) ?? 0) + Number(c.commission_amount),
    );
  }

  const rows: ReferredRow[] = refs.map((r) => {
    const profile = profileById.get(r.referred_user_id);
    const hostId = hostByUser.get(r.referred_user_id);
    const sub = hostId ? planByHost.get(hostId) : undefined;
    const isPaid =
      !!sub &&
      sub.plan != null &&
      PAID_PLANS.has(sub.plan) &&
      ["active", "trialing", "past_due"].includes(sub.status);
    const planLabel = isPaid
      ? (sub!.plan as string).charAt(0).toUpperCase() +
        (sub!.plan as string).slice(1)
      : hostId
        ? "Free"
        : "Guest";
    return {
      id: r.id,
      name: profile?.full_name || "Unnamed",
      email: profile?.email ?? null,
      plan: planLabel,
      paid: isPaid,
      joined: r.bound_at,
      commission: round2(commByReferral.get(r.id) ?? 0),
    };
  });

  const signups = rows.length;
  const paidCount = rows.filter((r) => r.paid).length;
  const freeCount = signups - paidCount;
  const clicks = clickCount ?? 0;
  const threshold =
    account.payout_threshold ?? Number(settings?.min_payout_threshold ?? 0);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://wielo.co.za";

  const columns: AdminColumn<ReferredRow>[] = [
    {
      header: "Referred user",
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-brand-ink">{r.name}</div>
          {r.email ? (
            <div className="truncate text-xs text-brand-mute">{r.email}</div>
          ) : null}
        </div>
      ),
    },
    {
      header: "Plan",
      cell: (r) => (
        <span
          className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium ${
            r.paid
              ? "bg-brand-accent text-brand-secondary"
              : "bg-brand-light text-brand-mute"
          }`}
        >
          {r.plan}
        </span>
      ),
    },
    {
      header: "Joined",
      cell: (r) => <span className="text-brand-mute">{fmtDate(r.joined)}</span>,
    },
    {
      header: "Commission earned",
      align: "right",
      cell: (r) => (
        <span className="font-medium text-brand-ink">
          {formatMoney(r.commission, account.currency)}
        </span>
      ),
    },
  ];

  return (
    <div>
      {/* Affiliate link hero */}
      <ReferralLinkCard baseUrl={baseUrl} slug={account.slug} />

      {/* Link builder — promote any page or product */}
      <div className="mt-5">
        <AffiliateLinkBuilder
          baseUrl={baseUrl}
          slug={account.slug}
          products={productOptions}
        />
      </div>

      {/* Stat band */}
      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-brand-line bg-brand-line md:grid-cols-3 lg:grid-cols-5">
        <Stat
          icon={<MousePointerClick className="h-3.5 w-3.5" />}
          label="Link clicks"
          value={clicks.toLocaleString("en-ZA").replace(/,/g, " ")}
        />
        <Stat
          icon={<UserPlus className="h-3.5 w-3.5" />}
          label="Signups"
          value={String(signups)}
          hint={clicks ? `${pct(signups, clicks)}% of clicks` : undefined}
        />
        <Stat
          icon={<BadgeCheck className="h-3.5 w-3.5" />}
          label="Paid customers"
          value={String(paidCount)}
          hint={`${freeCount} on free`}
        />
        <Stat
          icon={<Coins className="h-3.5 w-3.5" />}
          label="Lifetime earned"
          value={formatMoney(balance.lifetime, balance.currency)}
        />
        <div className="col-span-2 bg-brand-secondary p-4 md:col-span-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
            <Wallet className="h-3.5 w-3.5" /> Payout balance
          </div>
          <div className="num mt-2 font-display text-[26px] font-bold leading-none text-white">
            {formatMoney(balance.available, balance.currency)}
          </div>
          <div className="mt-1.5 text-[11px] text-brand-accent">
            Threshold {formatMoney(threshold, balance.currency)}
          </div>
        </div>
      </div>

      {/* Funnel + how you earn */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card lg:col-span-2">
          <h3 className="font-display text-[15px] font-bold text-brand-ink">
            Your funnel
          </h3>
          <p className="mt-0.5 text-[12.5px] text-brand-mute">All-time</p>
          <div className="mt-4 space-y-3">
            <FunnelBar label="Clicks" value={clicks} width={100} />
            <FunnelBar
              label="Signups"
              value={signups}
              width={pct(signups, clicks)}
            />
            <FunnelBar
              label="Paid customers"
              value={paidCount}
              width={pct(paidCount, clicks)}
            />
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-brand-mute">
            Hosts get a free trial. Commission starts the day a referred host
            begins their first paid month.
          </p>
        </div>

        <div className="rounded-card border border-brand-line bg-[#FAFCFB] p-5 shadow-card">
          <h3 className="font-display text-[15px] font-bold text-brand-ink">
            How you earn
          </h3>
          <ol className="mt-3 space-y-3 text-[12.5px] text-brand-ink">
            {[
              "Share your link with hosts and property owners.",
              "They sign up and start a Wielo subscription.",
              "You earn recurring commission for as long as they stay.",
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-accent text-[11px] font-bold text-brand-secondary">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <Link
            href="/portal/affiliates/products"
            className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-primary hover:text-brand-secondary"
          >
            See what you can promote <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Referred users */}
      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-brand-ink">
          People you&apos;ve referred
        </h2>
        <AdminTable
          columns={columns}
          rows={rows}
          getKey={(r) => r.id}
          empty="No referrals yet — share your link to get started."
        />
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-[#FAFCFB] p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        {icon}
        {label}
      </div>
      <div className="num mt-2 font-display text-[26px] font-bold leading-none text-brand-ink">
        {value}
      </div>
      {hint ? (
        <div className="mt-1.5 text-[11px] text-brand-mute">{hint}</div>
      ) : null}
    </div>
  );
}

function FunnelBar({
  label,
  value,
  width,
}: {
  label: string;
  value: number;
  width: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="font-medium text-brand-ink">{label}</span>
        <span className="num text-brand-mute">
          {value.toLocaleString("en-ZA").replace(/,/g, " ")}
        </span>
      </div>
      <div className="mt-1.5 h-2.5 rounded-pill bg-brand-light">
        <div
          className="h-full rounded-pill bg-brand-primary"
          style={{ width: `${Math.max(width, value > 0 ? 2 : 0)}%` }}
        />
      </div>
    </div>
  );
}
