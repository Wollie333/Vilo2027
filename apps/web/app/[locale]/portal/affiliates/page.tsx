import type { Metadata } from "next";
import { BadgePercent, MousePointerClick, Users, Wallet } from "lucide-react";

import {
  AdminColumn,
  AdminTable,
} from "@/app/[locale]/admin/_components/AdminTable";
import { getAffiliateBalance } from "@/lib/affiliate/balance";
import { getAffiliateForUser } from "@/lib/affiliate/account";
import { getBrandName } from "@/lib/brand";
import { formatMoney, round2 } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

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

export default async function AffiliateOverviewPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const account = await getAffiliateForUser(admin, user.id);
  if (!account) return null; // layout shows the terms gate

  const [brand, balance, { count: clickCount }, { data: referrals }] =
    await Promise.all([
      getBrandName(),
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
    ]);

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
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://vilo.co.za";

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
      {/* Hero */}
      <div
        className="overflow-hidden rounded-card text-white shadow-card"
        style={{
          backgroundImage:
            "linear-gradient(145deg, #030806 0%, #0a1510 50%, #051209 100%)",
        }}
      >
        <div className="grid gap-6 p-7 sm:p-9 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/80">
              Affiliate dashboard
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Earn with {brand}.
            </h1>
            <p className="mt-2 max-w-md text-sm text-white/70">
              Share your link, grab marketing material, and track every click,
              signup and rand you&apos;ve earned.
            </p>
            <div className="mt-5">
              <ReferralLinkCard baseUrl={baseUrl} slug={account.slug} />
            </div>
          </div>
          <div className="flex flex-col justify-center rounded-card border border-white/10 bg-white/[0.04] p-6">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
              Payout-ready balance
            </div>
            <div className="mt-1 font-display text-4xl font-bold">
              {formatMoney(balance.available, balance.currency)}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-white/50">Pending</div>
                <div className="font-semibold">
                  {formatMoney(balance.pending, balance.currency)}
                </div>
              </div>
              <div>
                <div className="text-white/50">Paid out</div>
                <div className="font-semibold">
                  {formatMoney(balance.paid, balance.currency)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<MousePointerClick className="h-4 w-4" />}
          label="Link clicks"
          value={String(clickCount ?? 0)}
        />
        <Stat
          icon={<Users className="h-4 w-4" />}
          label="Signups"
          value={String(signups)}
        />
        <Stat
          icon={<BadgePercent className="h-4 w-4" />}
          label="Paid customers"
          value={`${paidCount}`}
          hint={`${freeCount} free`}
        />
        <Stat
          icon={<Wallet className="h-4 w-4" />}
          label="Lifetime earned"
          value={formatMoney(balance.lifetime, balance.currency)}
        />
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
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-center gap-2 text-brand-mute">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="mt-3 font-display text-3xl font-bold text-brand-ink">
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-xs text-brand-mute">{hint}</div>
      ) : null}
    </div>
  );
}
