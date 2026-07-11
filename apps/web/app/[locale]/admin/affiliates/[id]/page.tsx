import {
  ArrowLeft,
  BadgeCheck,
  Coins,
  MousePointerClick,
  UserPlus,
  Wallet,
} from "lucide-react";
import { notFound } from "next/navigation";

import { Link } from "@/i18n/navigation";
import {
  AdminTable,
  type AdminColumn,
} from "@/app/[locale]/admin/_components/AdminTable";
import { requirePermission } from "@/lib/admin";
import { summariseCommissions } from "@/lib/affiliate/balance";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PAID_PLANS = new Set(["basic", "pro", "business"]);

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Admin per-affiliate funnel: clicks → signups → paid customers → commission,
// with the referred users and payout history. The affiliate tables stay the
// source of truth; this is a read-only drill-down from the affiliate list.
export default async function AdminAffiliateFunnelPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const { data: account } = await service
    .from("affiliate_accounts")
    .select("id, user_id, slug, status, currency, created_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!account) notFound();

  const [
    { data: owner },
    { count: clickCount },
    { data: referrals },
    { data: commissions },
    { data: payouts },
  ] = await Promise.all([
    service
      .from("user_profiles")
      .select("full_name, email")
      .eq("id", account.user_id)
      .maybeSingle(),
    service
      .from("affiliate_clicks")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_id", account.id),
    service
      .from("affiliate_referrals")
      .select("id, referred_user_id, bound_at")
      .eq("affiliate_id", account.id)
      .order("bound_at", { ascending: false }),
    service
      .from("affiliate_commissions")
      .select(
        "referral_id, status, entry_type, payout_id, commission_amount, currency",
      )
      .eq("affiliate_id", account.id),
    service
      .from("affiliate_payouts")
      .select(
        "id, method, status, gross_amount, fee_amount, net_amount, currency, requested_at, processed_at",
      )
      .eq("affiliate_id", account.id)
      .order("requested_at", { ascending: false }),
  ]);

  const refs = referrals ?? [];
  const userIds = refs.map((r) => r.referred_user_id);
  const [{ data: profiles }, { data: hosts }] = await Promise.all([
    userIds.length
      ? service
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
      ? service.from("hosts").select("id, user_id").in("user_id", userIds)
      : Promise.resolve({ data: [] as { id: string; user_id: string }[] }),
  ]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const hostByUser = new Map((hosts ?? []).map((h) => [h.user_id, h.id]));
  const hostIds = (hosts ?? []).map((h) => h.id);
  const { data: subs } = hostIds.length
    ? await service
        .from("subscriptions")
        .select("host_id, plan, status")
        .in("host_id", hostIds)
    : {
        data: [] as { host_id: string; plan: string | null; status: string }[],
      };
  const planByHost = new Map(
    (subs ?? []).map((s) => [s.host_id, { plan: s.plan, status: s.status }]),
  );

  const commByReferral = new Map<string, number>();
  for (const c of commissions ?? []) {
    if (c.status === "voided") continue;
    commByReferral.set(
      c.referral_id,
      (commByReferral.get(c.referral_id) ?? 0) + Number(c.commission_amount),
    );
  }

  const rows = refs.map((r) => {
    const profile = profileById.get(r.referred_user_id);
    const hostId = hostByUser.get(r.referred_user_id);
    const sub = hostId ? planByHost.get(hostId) : undefined;
    const isPaid =
      !!sub &&
      sub.plan != null &&
      PAID_PLANS.has(sub.plan) &&
      ["active", "trialing", "past_due"].includes(sub.status);
    return {
      id: r.id,
      name: profile?.full_name || "Unnamed",
      email: profile?.email ?? null,
      paid: isPaid,
      plan: isPaid ? (sub!.plan as string) : hostId ? "free" : "guest",
      joined: r.bound_at,
      commission: commByReferral.get(r.id) ?? 0,
    };
  });

  const bal = summariseCommissions(
    (commissions ?? []).map((c) => ({
      status: c.status,
      entry_type: c.entry_type,
      payout_id: c.payout_id,
      commission_amount: Number(c.commission_amount),
      currency: c.currency,
    })),
    account.currency,
  );

  const clicks = clickCount ?? 0;
  const signups = rows.length;
  const paidCount = rows.filter((r) => r.paid).length;

  const refColumns: AdminColumn<(typeof rows)[number]>[] = [
    {
      header: "Referred user",
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-brand-ink">{r.name}</div>
          {r.email ? (
            <div className="truncate text-[11px] text-brand-mute">
              {r.email}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      header: "Plan",
      cell: (r) => (
        <span
          className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium capitalize ${
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
      header: "Commission",
      align: "right",
      cell: (r) => (
        <span className="font-medium text-brand-ink">
          {formatMoney(r.commission, account.currency)}
        </span>
      ),
    },
  ];

  const payoutColumns: AdminColumn<NonNullable<typeof payouts>[number]>[] = [
    {
      header: "Requested",
      cell: (p) => (
        <span className="text-brand-mute">{fmtDate(p.requested_at)}</span>
      ),
    },
    {
      header: "Method",
      cell: (p) => <span className="capitalize">{p.method}</span>,
    },
    {
      header: "Net",
      align: "right",
      cell: (p) => (
        <span className="font-medium text-brand-ink">
          {formatMoney(Number(p.net_amount), p.currency)}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (p) => (
        <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-medium capitalize text-brand-mute">
          {p.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/affiliates"
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to affiliates
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-brand-ink">
              {owner?.full_name || "Affiliate"}
            </h1>
            <p className="mt-0.5 font-mono text-[12px] text-brand-mute">
              /r/{account.slug}
              {owner?.email ? ` · ${owner.email}` : ""}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-semibold ${
              account.status === "active"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-600"
            }`}
          >
            {account.status === "active" ? "Active partner" : "Suspended"}
          </span>
        </div>
      </div>

      {/* Funnel stat band */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-brand-line bg-brand-line md:grid-cols-3 lg:grid-cols-5">
        <Stat
          icon={<MousePointerClick className="h-3.5 w-3.5" />}
          label="Link clicks"
          value={String(clicks)}
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
          hint={`${signups - paidCount} on free`}
        />
        <Stat
          icon={<Coins className="h-3.5 w-3.5" />}
          label="Lifetime earned"
          value={formatMoney(bal.lifetime, account.currency)}
        />
        <div className="col-span-2 bg-brand-secondary p-4 md:col-span-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
            <Wallet className="h-3.5 w-3.5" /> Available
          </div>
          <div className="num mt-2 font-display text-[26px] font-bold leading-none text-white">
            {formatMoney(bal.available, account.currency)}
          </div>
          <div className="mt-1.5 text-[11px] text-brand-accent">
            {formatMoney(bal.pending, account.currency)} pending
          </div>
        </div>
      </div>

      {/* Funnel bars */}
      <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h3 className="font-display text-[15px] font-bold text-brand-ink">
          Funnel
        </h3>
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
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-brand-ink">
          Referred users
        </h2>
        <AdminTable
          columns={refColumns}
          rows={rows}
          getKey={(r) => r.id}
          empty="No referrals yet."
        />
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-brand-ink">
          Payouts
        </h2>
        <AdminTable
          columns={payoutColumns}
          rows={payouts ?? []}
          getKey={(p) => p.id}
          empty="No payouts yet."
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
        <span className="num text-brand-mute">{value}</span>
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
