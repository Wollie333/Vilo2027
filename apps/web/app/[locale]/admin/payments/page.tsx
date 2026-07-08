import { Search } from "lucide-react";

import { getBrandName } from "@/lib/brand";
import {
  fetchWieloLedger,
  wieloLedgerStats,
  type WieloTxn,
} from "@/lib/billing/wielo-ledger";
import { getAllPlans } from "@/lib/plans/getPlans";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin";

import { AdminStatBand } from "../_components/AdminStatBand";
import { AdminTable, type AdminColumn } from "../_components/AdminTable";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = {
  q?: string;
  status?: string;
  type?: string;
  env?: string;
};

const STATUSES = ["all", "pending", "completed", "failed"] as const;
const TYPES = ["all", "charge", "refund", "credit", "adjustment"] as const;
// Default to live so real test purchases stay visible (pick "Test") without
// polluting the numbers the founder looks at day-to-day.
const ENVS = ["live", "test", "all"] as const;

function isStatus(v: string | undefined): v is (typeof STATUSES)[number] {
  return STATUSES.includes((v ?? "") as (typeof STATUSES)[number]);
}
function isType(v: string | undefined): v is (typeof TYPES)[number] {
  return TYPES.includes((v ?? "") as (typeof TYPES)[number]);
}
function isEnv(v: string | undefined): v is (typeof ENVS)[number] {
  return ENVS.includes((v ?? "") as (typeof ENVS)[number]);
}

// The admin Payments tab is every payment USERS make to Wielo for Wielo products
// (subscriptions + service products) — i.e. the platform_ledger, read through
// the shared fetchWieloLedger SSOT. It is NOT host↔guest booking money (that is
// the host's own ledger, never Wielo revenue).
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requirePermission("payments.view");
  const brandName = await getBrandName();

  const q = (searchParams?.q ?? "").trim().toLowerCase();
  const status: (typeof STATUSES)[number] = isStatus(searchParams?.status)
    ? (searchParams!.status as (typeof STATUSES)[number])
    : "all";
  const type: (typeof TYPES)[number] = isType(searchParams?.type)
    ? (searchParams!.type as (typeof TYPES)[number])
    : "all";
  const env: (typeof ENVS)[number] = isEnv(searchParams?.env)
    ? (searchParams!.env as (typeof ENVS)[number])
    : "live";

  const service = createAdminClient();
  const [all, plans] = await Promise.all([
    fetchWieloLedger(service, { limit: 10_000 }),
    getAllPlans(),
  ]);
  const planName = new Map(plans.map((p) => [p.key, p.name]));

  // Scope to the chosen environment first so KPIs + table never mix test money
  // into the live numbers (live is the default).
  const envScoped =
    env === "all" ? all : all.filter((r) => r.environment === env);

  // KPIs reflect the whole (env-scoped) ledger, independent of the other filters.
  const stats = wieloLedgerStats(envScoped);

  let filtered = envScoped;
  if (status !== "all") filtered = filtered.filter((r) => r.status === status);
  if (type !== "all") filtered = filtered.filter((r) => r.type === type);
  if (q) {
    filtered = filtered.filter((r) =>
      [r.userName, r.userEmail, r.providerReference, r.plan, r.reason]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }
  const total = filtered.length;
  const list = filtered.slice(0, PAGE_SIZE);

  const productLabel = (r: WieloTxn): string => {
    if (r.plan)
      return `${planName.get(r.plan) ?? r.plan}${
        r.billingCycle ? ` · ${r.billingCycle}` : ""
      }`;
    return r.reason ?? "—";
  };

  const columns: AdminColumn<WieloTxn>[] = [
    {
      header: "Amount",
      cell: (r) => (
        <span
          className={`num font-medium ${
            r.amount < 0 ? "text-status-cancelled" : "text-brand-ink"
          }`}
        >
          {formatMoney(r.amount, r.currency)}
        </span>
      ),
    },
    { header: "Status", cell: (r) => <StatusPill status={r.status} /> },
    { header: "Type", cell: (r) => <TypePill type={r.type} /> },
    {
      header: "Product",
      cell: (r) => (
        <span className="text-[12.5px] text-brand-ink">{productLabel(r)}</span>
      ),
    },
    {
      header: "User",
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-medium text-brand-ink">
            {r.userName ?? r.userEmail ?? "—"}
          </div>
          {r.userName && r.userEmail ? (
            <div className="truncate text-[11px] text-brand-mute">
              {r.userEmail}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      header: "Provider",
      cell: (r) => (
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-brand-mute">
            {r.provider ?? "—"}
          </div>
          {r.providerReference ? (
            <div className="truncate font-mono text-[11px] text-brand-mute">
              {r.providerReference}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      header: "Date",
      cell: (r) => (
        <span className="text-[12px] text-brand-mute">
          {new Date(r.date).toLocaleDateString("en-ZA")}
        </span>
      ),
    },
    // Only worth a column when test + live are shown together.
    ...(env === "all"
      ? [
          {
            header: "Env",
            cell: (r: WieloTxn) =>
              r.environment === "test" ? (
                <span className="inline-flex items-center rounded-pill border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                  Test
                </span>
              ) : (
                <span className="text-[11px] text-brand-mute">Live</span>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Payments
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Every payment users make to {brandName} for subscriptions and add-on
          products. Host↔guest booking money lives on each host&rsquo;s own
          dashboard — it is never Wielo revenue.
        </p>
        {env === "test" ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-pill border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            Test mode — these are Paystack test-key transactions, excluded from
            live revenue.
          </p>
        ) : null}
      </header>

      {/* KPI band */}
      <AdminStatBand
        cols={3}
        stats={[
          { label: "Collected", value: formatMoney(stats.collected, "ZAR") },
          {
            label: "Pending",
            value: formatMoney(stats.pending, "ZAR"),
            tone: stats.pending > 0 ? "amber" : "default",
          },
          { label: "Refunded", value: formatMoney(stats.refunded, "ZAR") },
        ]}
      />

      <form
        action="/admin/payments"
        method="get"
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <input
            type="search"
            name="q"
            defaultValue={searchParams?.q ?? ""}
            placeholder="Search user, email, plan or reference"
            className="block w-full rounded border border-brand-line bg-white py-2 pl-9 pr-3 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>
        <select
          name="env"
          defaultValue={env}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink"
        >
          {ENVS.map((s) => (
            <option key={s} value={s}>
              {s === "live" ? "Live" : s === "test" ? "Test" : "Test + Live"}
            </option>
          ))}
        </select>
        <select
          name="type"
          defaultValue={type}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink"
        >
          {TYPES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All types" : s}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
        >
          Search
        </button>
      </form>

      <AdminTable
        columns={columns}
        rows={list}
        getKey={(r) => r.id}
        empty="No payments match this search."
      />

      {total > PAGE_SIZE ? (
        <p className="text-center text-[12px] text-brand-mute">
          Showing first {PAGE_SIZE} of {total}. Narrow your search to see more.
        </p>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed:
      "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
    pending:
      "bg-status-pending/10 text-status-pending border-status-pending/30",
    failed:
      "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
  };
  const cls = map[status] ?? "bg-brand-light text-brand-mute border-brand-line";
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {status}
    </span>
  );
}

function TypePill({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-brand-mute">
      {type}
    </span>
  );
}
