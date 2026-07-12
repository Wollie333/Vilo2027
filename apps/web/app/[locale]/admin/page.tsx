import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Flag,
  LifeBuoy,
  Megaphone,
  Package,
  ShieldAlert,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import { hasPermission } from "@/lib/admin";
import {
  buildPlatformReport,
  isReportEnv,
  type ReportEnv,
} from "@/lib/billing/platform-report";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// The admin Overview is the founder's daily SaaS control centre: "how is
// Wielo-the-business doing and what needs me today". Styled to match the host
// dashboard (seamless stat band + attention tiles + clean cards) so it reads
// calm, not like a wall of KPI boxes. Headline numbers come from
// buildPlatformReport (shared with /admin/reporting + the PDF) so they can't drift.
export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams?: { env?: string };
}) {
  const service = createAdminClient();

  const env: ReportEnv = isReportEnv(searchParams?.env)
    ? searchParams.env
    : "live";

  const [
    report,
    { count: flaggedReviews },
    { count: pendingRefunds },
    { count: openDataReqs },
    { count: openReports },
    { data: notifRows },
  ] = await Promise.all([
    buildPlatformReport("30d", Date.now(), env),
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
    // Open (untriaged) listing reports awaiting moderation.
    service
      .from("listing_reports")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "reviewing"]),
    // Latest transactional notifications (finance + support) so staff never miss
    // a payment being initiated, a pending EFT, or a support / cancel request.
    service
      .from("admin_notifications")
      .select("id, category, kind, title, body, href, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const k = report.kpis;
  const pastDue = report.statusFunnel
    .filter((s) => s.status === "past_due" || s.status === "restricted")
    .reduce((a, s) => a + s.count, 0);

  const attention = [
    {
      label: "Past-due subs",
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
      label: "Reported listings",
      count: openReports ?? 0,
      href: "/admin/flagged-listings",
      icon: Flag,
    },
    {
      label: "Pending refunds",
      count: pendingRefunds ?? 0,
      href: "/admin/payments",
      icon: AlertTriangle,
    },
    {
      label: "Data requests",
      count: openDataReqs ?? 0,
      href: "/admin/data-requests",
      icon: ShieldAlert,
    },
  ];
  const openItems = attention.reduce((a, x) => a + x.count, 0);

  const [canFinancials, canAudit] = await Promise.all([
    hasPermission("payments.view"),
    hasPermission("audit.view"),
  ]);

  const dateLabel = new Date().toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="w-full">
      {/* Header + quick jumps */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-[18px] font-extrabold leading-none text-brand-ink">
            Control Centre
          </h1>
          <div className="mt-1.5 text-[12.5px] text-brand-mute">
            {dateLabel} · how Wielo-the-business is doing
            {env !== "live" ? (
              <span className="ml-1.5 font-semibold text-status-pending">
                · {env === "test" ? "test" : "test + live"} revenue view
              </span>
            ) : null}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {canFinancials ? (
            <div className="mr-1 inline-flex items-center rounded-pill border border-brand-line bg-white p-0.5">
              {(["live", "test", "all"] as const).map((e) => (
                <Link
                  key={e}
                  href={e === "live" ? "/admin" : `/admin?env=${e}`}
                  className={`rounded-pill px-2.5 py-1 text-[11.5px] font-semibold capitalize transition-colors ${
                    env === e
                      ? e === "test"
                        ? "bg-status-pending text-white"
                        : "bg-brand-primary text-white"
                      : "text-brand-mute hover:text-brand-ink"
                  }`}
                  title={
                    e === "live"
                      ? "Live revenue only"
                      : e === "test"
                        ? "Test-mode transactions"
                        : "Test + live"
                  }
                >
                  {e === "all" ? "Test + Live" : e}
                </Link>
              ))}
            </div>
          ) : null}
          {QUICK_ACTIONS.map((q) => (
            <IconButton
              key={q.href}
              icon={q.icon}
              label={q.label}
              href={q.href}
            />
          ))}
          <span className="mx-1 hidden h-6 w-px bg-brand-line sm:block" />
          <Link
            href="/admin/reporting"
            className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary"
          >
            <BarChart3 className="h-4 w-4" /> Reporting
          </Link>
        </div>
      </div>

      {/* Revenue health — the SaaS heartbeat. Gated so lower-privilege staff
          don't see Wielo financials. */}
      {canFinancials && (
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-brand-line bg-brand-line sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="MRR">
            <div className="font-display text-[22px] font-bold leading-none text-brand-ink">
              {rand(k.mrr)}
            </div>
            <div className="mt-1 text-[11px] text-brand-mute">
              ARR {rand(k.arr)}
            </div>
          </StatTile>
          <StatTile label="ARPU">
            <div className="font-display text-[22px] font-bold leading-none text-brand-ink">
              {rand(k.arpu)}
            </div>
            <div className="mt-1 text-[11px] text-brand-mute">
              per paying host
            </div>
          </StatTile>
          <StatTile label="Paying hosts">
            <div className="font-display text-[22px] font-bold leading-none text-brand-ink">
              {k.payingHosts.toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-brand-mute">
              {k.trials} on trial · {k.trialConversion}% convert
            </div>
          </StatTile>
          <StatTile label="Churn">
            <div className="font-display text-[22px] font-bold leading-none text-brand-ink">
              {k.churnRate}%
            </div>
            <div className="mt-1 text-[11px] text-brand-mute">
              {k.churned} cancelled/expired
            </div>
          </StatTile>
          <Link
            href="/admin/subscriptions/revenue"
            className="col-span-2 bg-brand-secondary p-4 transition-colors hover:bg-brand-primary sm:col-span-1"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
              Wielo collected
            </div>
            <div className="mt-1.5 font-display text-[20px] font-bold leading-none text-white">
              {rand(k.collectedAllTime)}
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-brand-accent">
              <TrendingUp className="h-3 w-3" />
              {rand(k.collectedPeriod)} last 30d
            </div>
          </Link>
        </section>
      )}

      {/* Needs attention — tone tiles; muted when clear, amber when action due. */}
      <section className="mt-6">
        <div className="mb-2.5 flex items-center gap-2">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Needs attention
          </h2>
          {openItems === 0 ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-status-confirmed">
              <CheckCircle2 className="h-3.5 w-3.5" /> all clear
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[16px] border border-brand-line bg-brand-line sm:grid-cols-2 lg:grid-cols-4">
          {attention.map((a) => (
            <AttentionTile key={a.label} {...a} />
          ))}
        </div>
      </section>

      {/* Growth & footprint — compact secondary band. */}
      {canFinancials && (
        <section className="mt-6">
          <h2 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            Growth &amp; footprint
          </h2>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-brand-line bg-brand-line sm:grid-cols-3 lg:grid-cols-6">
            <MiniStat
              label="New (30d)"
              value={k.newUsersPeriod.toLocaleString()}
            />
            <MiniStat
              label="Total users"
              value={k.totalUsers.toLocaleString()}
            />
            <MiniStat label="Hosts" value={k.hosts.toLocaleString()} />
            <MiniStat label="Guests" value={k.guests.toLocaleString()} />
            <MiniStat
              label="Listings"
              value={k.activeListings.toLocaleString()}
            />
            <MiniStat label="Outstanding" value={rand(k.outstanding)} />
          </div>
        </section>
      )}

      {/* Plan mix + recent activity — two clean cards. */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {canFinancials && report.plans.length > 0 ? (
          <Card
            title="Products"
            actionHref="/admin/products"
            actionLabel="Manage products"
          >
            <table className="w-full text-[13px]">
              <thead className="border-b border-brand-line text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8AA89C]">
                <tr>
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-4 py-2.5 text-right">Active / sold</th>
                  <th className="px-4 py-2.5 text-right">MRR / revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {report.plans.map((p) => (
                  <tr key={p.key} className="hover:bg-brand-light/40">
                    <td className="px-4 py-2.5 font-medium text-brand-ink">
                      {p.name}
                      <span
                        className={`ml-1.5 inline-flex rounded-pill border px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${
                          p.type === "one_off"
                            ? "border-violet-200 bg-violet-50 text-violet-700"
                            : "border-brand-line bg-brand-light text-brand-mute"
                        }`}
                      >
                        {p.type === "one_off" ? "one-off" : "sub"}
                      </span>
                      {p.testOnly ? (
                        <span className="ml-1 inline-flex rounded-pill border border-status-pending/30 bg-status-pending/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-status-pending">
                          test
                        </span>
                      ) : null}
                    </td>
                    <td className="num px-4 py-2.5 text-right text-brand-mute">
                      {p.count.toLocaleString()}
                    </td>
                    <td className="num px-4 py-2.5 text-right font-semibold text-brand-ink">
                      {rand(p.mrr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : null}

        {/* Latest actions — transactional (finance + support) notifications so
            staff never miss a payment being initiated, a pending EFT, or a
            support / cancellation request. Replaces the raw audit feed here (the
            full audit log is still linked). */}
        <Card
          title="Latest actions"
          actionHref={canAudit ? "/admin/audit" : undefined}
          actionLabel={canAudit ? "Audit log" : undefined}
        >
          <ul className="divide-y divide-brand-line">
            {(notifRows ?? []).map((n) => {
              const finance = n.category === "finance";
              const Icon = finance ? CreditCard : LifeBuoy;
              const body = (
                <div
                  className={`flex items-start gap-3 px-4 py-2.5 text-[13px] ${
                    n.is_read ? "" : "bg-brand-light/40"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      finance
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-sky-50 text-sky-600"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {n.is_read ? null : (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary" />
                      )}
                      <span className="truncate font-semibold text-brand-ink">
                        {n.title}
                      </span>
                    </div>
                    {n.body ? (
                      <div className="truncate text-[12px] text-brand-mute">
                        {n.body}
                      </div>
                    ) : null}
                  </div>
                  <span className="ml-auto shrink-0 text-[11px] text-brand-mute">
                    {formatRelative(n.created_at)}
                  </span>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link
                      href={n.href}
                      className="block transition hover:bg-brand-light/60"
                    >
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
            {(notifRows ?? []).length === 0 ? (
              <li className="px-4 py-6 text-center text-[13px] text-brand-mute">
                No financial or support activity yet.
              </li>
            ) : null}
          </ul>
        </Card>
      </div>

      {/* Marketplace context — host↔guest money, NOT Wielo revenue. Quiet footnote. */}
      <p className="mt-6 text-[11.5px] text-brand-mute">
        Marketplace throughput (booking value flowing host↔guest, not Wielo
        revenue):{" "}
        <span className="font-semibold text-brand-ink">{rand(k.gmv)}</span>{" "}
        across {k.bookingCount.toLocaleString()} bookings.
      </p>
    </div>
  );
}

// ─── Header quick-jumps ───────────────────────────────────────────
const QUICK_ACTIONS: { icon: LucideIcon; label: string; href: string }[] = [
  { icon: Users, label: "Users", href: "/admin/users" },
  { icon: Package, label: "Products", href: "/admin/products" },
  { icon: CreditCard, label: "Payments", href: "/admin/payments" },
  { icon: Megaphone, label: "Broadcasts", href: "/admin/broadcasts" },
];

function IconButton({
  icon: Icon,
  label,
  href,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-brand-line bg-white text-brand-secondary shadow-card transition hover:border-[#CDE6D8] hover:bg-[#FAFCFB] hover:text-brand-primary"
    >
      <Icon className="h-[18px] w-[18px]" />
    </Link>
  );
}

function StatTile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#FAFCFB] p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        {label}
      </div>
      <div className="num mt-1 font-display text-[16px] font-bold text-brand-ink">
        {value}
      </div>
    </div>
  );
}

function AttentionTile({
  icon: Icon,
  label,
  count,
  href,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  href: string;
}) {
  const active = count > 0;
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 p-4 transition-colors ${
        active
          ? "bg-amber-50 hover:bg-amber-100"
          : "bg-white hover:bg-[#FAFCFB]"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] ${
          active
            ? "bg-amber-100 text-amber-700"
            : "bg-brand-light text-brand-mute"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span
            className={`num font-display text-[20px] font-bold leading-none ${
              active ? "text-amber-900" : "text-brand-ink"
            }`}
          >
            {count}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-mute">
            {label}
          </span>
        </div>
        <div className="mt-1 text-[12px] text-brand-mute">
          {active ? "needs review" : "all clear"}
        </div>
      </div>
      <ChevronRight
        className={`h-4 w-4 shrink-0 transition-colors ${
          active
            ? "text-amber-400 group-hover:text-amber-600"
            : "text-brand-line group-hover:text-brand-mute"
        }`}
      />
    </Link>
  );
}

function Card({
  title,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-brand-line px-4 py-3">
        <h2 className="font-display text-[14px] font-bold text-brand-ink">
          {title}
        </h2>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="text-[12px] font-medium text-brand-primary hover:underline"
          >
            {actionLabel} →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

// Rand formatter for financial KPIs — always shows "R 0" (never "Free", which
// is the subscription-plan formatter's behaviour and wrong for money totals).
function rand(n: number): string {
  return "R " + Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
}

function formatRelative(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-ZA", {
    month: "short",
    day: "numeric",
  });
}
