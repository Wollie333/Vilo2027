import { requirePermission } from "@/lib/admin";
import { fetchWieloLedger, wieloLedgerStats } from "@/lib/billing/wielo-ledger";
import { getAllPlans } from "@/lib/plans/getPlans";
import { getSubscriptionProducts } from "@/lib/products/getProducts";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatZar } from "@/app/[locale]/dashboard/settings/subscription/plans";

import { Link } from "@/i18n/navigation";

import { ManualEntryForm } from "./ManualEntryForm";

export const dynamic = "force-dynamic";

const STATUSES = ["all", "completed", "pending", "failed"] as const;
const TYPES = ["all", "charge", "refund", "credit", "adjustment"] as const;

const TYPE_TONE: Record<string, string> = {
  charge:
    "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
  refund:
    "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
  credit: "bg-amber-100 text-amber-800 border-amber-300",
  adjustment: "bg-brand-light text-brand-mute border-brand-line",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminRevenuePage({
  searchParams,
}: {
  searchParams?: {
    user?: string;
    plan?: string;
    status?: string;
    type?: string;
  };
}) {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const planFilter = (searchParams?.plan ?? "").trim();
  const userEmail = (searchParams?.user ?? "").trim();
  const statusFilter = STATUSES.includes(
    (searchParams?.status ?? "") as (typeof STATUSES)[number],
  )
    ? (searchParams!.status as (typeof STATUSES)[number])
    : "all";
  const typeFilter = TYPES.includes(
    (searchParams?.type ?? "") as (typeof TYPES)[number],
  )
    ? (searchParams!.type as (typeof TYPES)[number])
    : "all";

  // Resolve a user email → id for the user filter.
  let userId: string | undefined;
  if (userEmail) {
    const { data: u } = await service
      .from("user_profiles")
      .select("id")
      .ilike("email", userEmail)
      .maybeSingle();
    userId = u?.id ?? "00000000-0000-0000-0000-000000000000";
  }

  const [rows, plans, products, { data: subs }] = await Promise.all([
    fetchWieloLedger(service, {
      limit: 1000,
      userId,
      plan: planFilter || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      type: typeFilter === "all" ? undefined : typeFilter,
      // Live revenue only — test-key transactions are inspected via Payments.
      environment: "live",
    }),
    getAllPlans(),
    getSubscriptionProducts(),
    service
      .from("subscriptions")
      .select("plan, billing_cycle, status, product_id"),
  ]);

  const stats = wieloLedgerStats(rows);

  // MRR from active, paying subscriptions. Product-first (the current model):
  // read the real price from the linked PRODUCT; fall back to the legacy plan
  // price only for subscriptions not yet linked to a product. Annual /12.
  const planPrice = new Map(plans.map((p) => [p.key, p]));
  const productPrice = new Map(products.map((p) => [p.id, p]));
  let mrr = 0;
  let payingHosts = 0;
  for (const s of subs ?? []) {
    if (s.status !== "active") continue;
    let monthly: number | null = null;
    const prod = s.product_id ? productPrice.get(s.product_id) : undefined;
    if (prod && !prod.isFree) {
      monthly = prod.billingCycle === "annual" ? prod.price / 12 : prod.price;
    } else if (!s.product_id) {
      const pd = planPrice.get(s.plan as string);
      if (pd && !pd.isFree) {
        monthly = s.billing_cycle === "annual" ? pd.annual / 12 : pd.monthly;
      }
    }
    if (monthly == null) continue;
    mrr += monthly;
    payingHosts += 1;
  }
  const arr = mrr * 12;

  const recent = rows.slice(0, 100);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Wielo revenue ledger
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Every transaction between a user and Wielo — product &amp;
          subscription purchases, refunds, credits and manual adjustments,
          straight from{" "}
          <code className="rounded bg-brand-light px-1 py-0.5 text-[11px]">
            platform_ledger
          </code>
          . Booking money goes directly to hosts and is not shown here.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="MRR" value={formatZar(Math.round(mrr))} />
        <Kpi label="ARR" value={formatZar(Math.round(arr))} />
        <Kpi label="Collected" value={formatZar(Math.round(stats.collected))} />
        <Kpi label="Refunded" value={formatZar(Math.round(stats.refunded))} />
        <Kpi label="Net to Wielo" value={formatZar(Math.round(stats.net))} />
        <Kpi label="Paying hosts" value={String(payingHosts)} />
      </section>

      {/* Manual entry */}
      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-bold text-brand-ink">
          Post a manual entry
        </h2>
        <p className="mb-4 mt-1 text-[13px] text-brand-mute">
          Record a goodwill credit, write-off, off-platform charge or correction
          against a host&apos;s Wielo account. Audited.
        </p>
        <ManualEntryForm />
      </section>

      {/* Filters */}
      <form
        action="/admin/subscriptions/revenue"
        method="get"
        className="flex flex-wrap items-center gap-2"
      >
        <input
          type="text"
          name="user"
          defaultValue={userEmail}
          placeholder="Filter by user email"
          className="min-w-[14rem] flex-1 rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none"
        />
        <select
          name="plan"
          defaultValue={planFilter}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink"
        >
          <option value="">All plans</option>
          {plans.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          name="type"
          defaultValue={typeFilter}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t === "all" ? "All types" : t}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={statusFilter}
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
          Filter
        </button>
        {userEmail ||
        planFilter ||
        typeFilter !== "all" ||
        statusFilter !== "all" ? (
          <Link
            href="/admin/subscriptions/revenue"
            className="text-xs font-medium text-brand-primary underline-offset-2 hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {/* Ledger list */}
      <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        {recent.length > 0 ? (
          <ul className="divide-y divide-brand-line">
            {recent.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"
              >
                <span
                  className={`inline-flex w-20 justify-center rounded-pill border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                    TYPE_TONE[t.type] ?? TYPE_TONE.adjustment
                  }`}
                >
                  {t.type}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-brand-ink">
                    {t.userName || t.userEmail || "—"}
                    {t.hostHandle ? (
                      <span className="ml-1.5 font-mono text-[11px] text-brand-mute">
                        @{t.hostHandle}
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate text-[11px] text-brand-mute">
                    {fmtDate(t.date)}
                    {t.plan ? ` · ${t.plan}` : ""}
                    {t.billingCycle ? ` · ${t.billingCycle}` : ""}
                    {t.provider ? ` · ${t.provider}` : ""}
                    {t.status !== "completed" ? ` · ${t.status}` : ""}
                    {t.reason ? ` · ${t.reason}` : ""}
                  </div>
                </div>
                <div
                  className={`num shrink-0 font-mono text-sm font-semibold ${
                    t.amount < 0 ? "text-status-cancelled" : "text-brand-ink"
                  }`}
                >
                  {t.amount < 0 ? "−" : ""}
                  {formatZar(Math.abs(t.amount))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-brand-mute">
            No Wielo transactions yet. Subscription purchases will appear here
            once live billing is connected; you can also post manual entries
            above.
          </p>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div className="num mt-1 font-display text-lg font-bold text-brand-ink">
        {value}
      </div>
    </div>
  );
}
