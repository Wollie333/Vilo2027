import {
  AlertTriangle,
  ArrowRight,
  CreditCard,
  Home as HomeIcon,
  TrendingUp,
  Users as UsersIcon,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import { formatZar } from "@/app/[locale]/dashboard/settings/subscription/plans";
import { getAllPlans } from "@/lib/plans/getPlans";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const service = createAdminClient();

  const [
    plans,
    { data: subs },
    { data: profiles },
    { count: listingsCount },
    { count: bookingsCount },
    { data: collectedRows },
    { count: pendingRefunds },
    { count: openDataReqs },
    { data: auditRows },
  ] = await Promise.all([
    getAllPlans(),
    service.from("subscriptions").select("plan, billing_cycle, status"),
    service.from("user_profiles").select("role").is("deleted_at", null),
    service
      .from("listings")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    service.from("bookings").select("id", { count: "exact", head: true }),
    service
      .from("payments")
      .select("amount, kind")
      .eq("status", "completed")
      .is("voided_at", null),
    service
      .from("refund_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    service
      .from("data_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    service
      .from("admin_audit_log")
      .select("id, action, target_type, target_id, admin_id, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // MRR + paying hosts + past-due (Vilo revenue health).
  const priceMap = new Map(plans.map((p) => [p.key, p]));
  let mrr = 0;
  let payingHosts = 0;
  let pastDue = 0;
  for (const s of subs ?? []) {
    if (s.status === "past_due" || s.status === "restricted") pastDue += 1;
    if (s.status !== "active") continue;
    const pd = priceMap.get(s.plan as string);
    if (!pd || pd.isFree) continue;
    mrr += s.billing_cycle === "annual" ? pd.annual / 12 : pd.monthly;
    payingHosts += 1;
  }

  // Users split.
  let hosts = 0;
  let guests = 0;
  for (const u of profiles ?? []) {
    if (u.role === "host") hosts += 1;
    else if (u.role === "guest") guests += 1;
  }
  const totalUsers = profiles?.length ?? 0;

  // GMV processed (booking value flowing host↔guest).
  const INBOUND = new Set(["deposit", "balance", "addon", "payment", "credit"]);
  let collected = 0;
  for (const p of collectedRows ?? []) {
    if (INBOUND.has(String(p.kind))) collected += Number(p.amount ?? 0);
  }

  const kpis = [
    {
      label: "MRR",
      value: formatZar(Math.round(mrr)),
      icon: TrendingUp,
      href: "/admin/reporting",
    },
    {
      label: "Paying hosts",
      value: String(payingHosts),
      icon: UsersIcon,
      href: "/admin/subscriptions",
    },
    {
      label: "Total users",
      value: totalUsers.toLocaleString(),
      icon: UsersIcon,
      href: "/admin/users",
    },
    {
      label: "Collected (platform)",
      value: formatZar(Math.round(collected)),
      icon: CreditCard,
      href: "/admin/ledger",
    },
    {
      label: "Live listings",
      value: (listingsCount ?? 0).toLocaleString(),
      icon: HomeIcon,
      href: "/admin/listings",
    },
    {
      label: "Bookings",
      value: (bookingsCount ?? 0).toLocaleString(),
      icon: HomeIcon,
      href: "/admin/bookings",
    },
  ];

  const attention = [
    {
      label: "Past-due subscriptions",
      count: pastDue,
      href: "/admin/subscriptions?status=past_due",
    },
    {
      label: "Pending refunds",
      count: pendingRefunds ?? 0,
      href: "/admin/payments",
    },
    {
      label: "Open data requests",
      count: openDataReqs ?? 0,
      href: "/admin/data-requests",
    },
  ];
  const needsAttention = attention.filter((a) => a.count > 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Control Centre
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Founder &amp; platform-staff operations console. Every write is
          recorded in the audit log.
        </p>
      </header>

      {/* Headline KPIs */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className="rounded-card border border-brand-line bg-white p-5 transition-colors hover:border-brand-primary"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              <k.icon className="h-3.5 w-3.5" /> {k.label}
            </div>
            <div className="num mt-2 font-display text-2xl font-bold text-brand-ink">
              {k.value}
            </div>
          </Link>
        ))}
      </section>

      {/* Needs attention */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-brand-ink">
          Needs attention
        </h2>
        {needsAttention.length === 0 ? (
          <div className="rounded-card border border-brand-line bg-white px-5 py-6 text-sm text-brand-mute">
            All clear — nothing needs action right now.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {needsAttention.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="flex items-center justify-between gap-3 rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 transition-colors hover:bg-amber-100"
              >
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                  <AlertTriangle className="h-4 w-4" /> {a.label}
                </span>
                <span className="num inline-flex items-center gap-1 font-display text-lg font-bold">
                  {a.count} <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Users at a glance */}
      <section className="grid gap-3 sm:grid-cols-3">
        <MiniStat label="Hosts" value={hosts} href="/admin/users?role=host" />
        <MiniStat
          label="Guests"
          value={guests}
          href="/admin/users?role=guest"
        />
        <MiniStat
          label="Past-due subs"
          value={pastDue}
          href="/admin/subscriptions?status=past_due"
        />
      </section>

      {/* Recent admin activity */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold text-brand-ink">
            Recent admin activity
          </h2>
          <Link
            href="/admin/audit"
            className="text-[12px] font-medium text-brand-primary hover:underline"
          >
            View audit log →
          </Link>
        </div>
        <div className="overflow-hidden rounded-card border border-brand-line bg-white">
          <table className="w-full text-[13px]">
            <thead className="bg-brand-light/60 text-left text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              <tr>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Target</th>
                <th className="px-4 py-2.5">Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {(auditRows ?? []).map((row) => (
                <tr key={row.id} className="hover:bg-brand-light/40">
                  <td className="px-4 py-2.5 text-brand-mute">
                    {formatRelative(row.created_at)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px]">
                    {row.action}
                  </td>
                  <td className="px-4 py-2.5 text-brand-mute">
                    {row.target_type}
                    {row.target_id ? ` · ${row.target_id.slice(0, 8)}` : ""}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-brand-mute">
                    {row.admin_id.slice(0, 8)}
                  </td>
                </tr>
              ))}
              {(auditRows ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-brand-mute"
                  >
                    No admin actions logged yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MiniStat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-card border border-brand-line bg-white p-4 transition-colors hover:border-brand-primary"
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div className="num mt-1 font-display text-xl font-bold text-brand-ink">
        {value.toLocaleString()}
      </div>
    </Link>
  );
}

function formatRelative(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
