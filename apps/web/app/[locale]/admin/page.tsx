import {
  AlertTriangle,
  ArrowRight,
  Flag,
  ShieldAlert,
  Wallet,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import { formatZar } from "@/app/[locale]/dashboard/settings/subscription/plans";
import { hasPermission } from "@/lib/admin";
import { buildPlatformReport } from "@/lib/billing/platform-report";
import { createAdminClient } from "@/lib/supabase/admin";

import { AdminKpiCard } from "./_components/AdminKpiCard";

export const dynamic = "force-dynamic";

// The admin Overview is the founder's daily SaaS control centre: it answers
// "how is Wielo-the-business doing and what needs me today" — not host-level
// booking operations (those live on each host's own dashboard). Headline KPIs
// come straight from buildPlatformReport (the single source of truth shared
// with /admin/reporting + the PDF export) so the numbers can never drift.
export default async function AdminOverviewPage() {
  const service = createAdminClient();

  const [
    report,
    { count: flaggedReviews },
    { count: pendingRefunds },
    { count: openDataReqs },
    { data: auditRows },
  ] = await Promise.all([
    buildPlatformReport("30d"),
    service
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("flagged", true),
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

  const k = report.kpis;
  const pastDue = report.statusFunnel
    .filter((s) => s.status === "past_due" || s.status === "restricted")
    .reduce((a, s) => a + s.count, 0);

  // Wielo's own SaaS revenue health — what the subscription business runs on.
  const revenueKpis = [
    {
      label: "MRR",
      value: formatZar(k.mrr),
      sub: `ARR ${formatZar(k.arr)}`,
      href: "/admin/reporting",
    },
    {
      label: "ARPU",
      value: formatZar(k.arpu),
      sub: "per paying host",
      href: "/admin/reporting",
    },
    {
      label: "Paying hosts",
      value: k.payingHosts.toLocaleString(),
      sub: `${k.trials} on trial`,
      href: "/admin/subscriptions",
    },
    {
      label: "Trial conversion",
      value: `${k.trialConversion}%`,
      sub: "trial → paid",
      href: "/admin/reporting",
    },
    {
      label: "Churn rate",
      value: `${k.churnRate}%`,
      sub: `${k.churned} cancelled/expired`,
      href: "/admin/reporting",
    },
    {
      label: "Wielo collected",
      value: formatZar(k.collectedAllTime),
      sub: `${formatZar(k.collectedPeriod)} last 30d`,
      href: "/admin/subscriptions/revenue",
    },
  ];

  // Growth & footprint over the last 30 days.
  const growthKpis = [
    { label: "New users (30d)", value: k.newUsersPeriod.toLocaleString() },
    { label: "Total users", value: k.totalUsers.toLocaleString() },
    { label: "Hosts", value: k.hosts.toLocaleString() },
    { label: "Guests", value: k.guests.toLocaleString() },
    { label: "Active listings", value: k.activeListings.toLocaleString() },
    { label: "Outstanding", value: formatZar(k.outstanding) },
  ];

  const attention = [
    {
      label: "Past-due subscriptions",
      count: pastDue,
      href: "/admin/subscriptions?status=past_due",
      icon: Wallet,
    },
    {
      label: "Flagged reviews",
      count: flaggedReviews ?? 0,
      href: "/admin/reviews",
      icon: Flag,
    },
    {
      label: "Pending refunds",
      count: pendingRefunds ?? 0,
      href: "/admin/payments",
      icon: AlertTriangle,
    },
    {
      label: "Open data requests",
      count: openDataReqs ?? 0,
      href: "/admin/data-requests",
      icon: ShieldAlert,
    },
  ];
  const needsAttention = attention.filter((a) => a.count > 0);

  // The /admin landing is every staff member's home, but Wielo financials + the
  // audit log are not for every role. Gate those sections (non-throwing, so the
  // landing still renders the task counts for all staff). "Needs attention" stays
  // visible to everyone.
  const [canFinancials, canAudit] = await Promise.all([
    hasPermission("payments.view"),
    hasPermission("audit.view"),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Control Centre
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          How Wielo-the-business is doing today. Deep charts live in{" "}
          <Link
            href="/admin/reporting"
            className="text-brand-primary hover:underline"
          >
            Reporting
          </Link>
          . Every admin write is recorded in the audit log.
        </p>
      </header>

      {/* SaaS revenue health — gated on payments.view so lower-privilege staff
          don't see Wielo financials. */}
      {canFinancials && (
        <section>
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Revenue health
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {revenueKpis.map((kpi) => (
              <Link key={kpi.label} href={kpi.href} className="block">
                <AdminKpiCard
                  label={kpi.label}
                  value={kpi.value}
                  sub={kpi.sub}
                />
              </Link>
            ))}
          </div>
        </section>
      )}

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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {needsAttention.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="flex items-center justify-between gap-3 rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 transition-colors hover:bg-amber-100"
              >
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                  <a.icon className="h-4 w-4" /> {a.label}
                </span>
                <span className="num inline-flex items-center gap-1 font-display text-lg font-bold">
                  {a.count} <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Growth & footprint — platform/financial stats, same gate. */}
      {canFinancials && (
        <section>
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Growth &amp; footprint
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {growthKpis.map((kpi) => (
              <AdminKpiCard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
              />
            ))}
          </div>
        </section>
      )}

      {/* Plan mix */}
      {canFinancials && report.plans.length > 0 ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold text-brand-ink">
              Plan mix
            </h2>
            <Link
              href="/admin/subscriptions/plans"
              className="text-[12px] font-medium text-brand-primary hover:underline"
            >
              Manage plans →
            </Link>
          </div>
          <div className="overflow-hidden rounded-card border border-brand-line bg-white">
            <table className="w-full text-[13px]">
              <thead className="border-b border-brand-line text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8AA89C]">
                <tr>
                  <th className="px-4 py-2.5">Plan</th>
                  <th className="px-4 py-2.5 text-right">Subscribers</th>
                  <th className="px-4 py-2.5 text-right">MRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {report.plans.map((p) => (
                  <tr key={p.key} className="hover:bg-brand-light/40">
                    <td className="px-4 py-2.5 font-medium text-brand-ink">
                      {p.name}
                    </td>
                    <td className="num px-4 py-2.5 text-right text-brand-mute">
                      {p.count.toLocaleString()}
                    </td>
                    <td className="num px-4 py-2.5 text-right font-semibold text-brand-ink">
                      {formatZar(p.mrr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Recent admin activity — audit log, gated on audit.view. */}
      {canAudit && (
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
              <thead className="border-b border-brand-line text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8AA89C]">
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
      )}

      {/* Marketplace context — host↔guest money, NOT Wielo revenue. Kept as a
          quiet footnote so SaaS metrics above stay unambiguous. */}
      <p className="text-[11.5px] text-brand-mute">
        Marketplace throughput (booking value flowing host↔guest, not Wielo
        revenue):{" "}
        <span className="font-semibold text-brand-ink">{formatZar(k.gmv)}</span>{" "}
        across {k.bookingCount.toLocaleString()} bookings.
      </p>
    </div>
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
