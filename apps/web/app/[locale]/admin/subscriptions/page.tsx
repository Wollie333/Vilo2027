import { Link } from "@/i18n/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { throwOnErrorWithCount } from "@/lib/supabase/query";
import { requirePermission } from "@/lib/admin";
import { getInternalCatalog } from "@/lib/products/getProducts";

import { AdminStatBand } from "../_components/AdminStatBand";
import { AdminTable, type AdminColumn } from "../_components/AdminTable";
import { SubsTabs } from "./_SubsTabs";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = { plan?: string; status?: string };

const STATUSES = [
  "all",
  "active",
  "trialing",
  "past_due",
  "restricted",
  "cancelled",
  "expired",
] as const;

function isOne<T extends ReadonlyArray<string>>(
  values: T,
  v: string | undefined,
): v is T[number] {
  return values.includes((v ?? "") as T[number]);
}

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requirePermission("subscriptions.edit");

  // Plan filter options are the REAL active membership products (the plans hosts
  // subscribe to), from the live products catalog — not the legacy plans table.
  const catalog = await getInternalCatalog();
  const seenKey = new Set<string>();
  const allPlans = catalog
    .filter((p) => p.productType === "membership" && p.planKey)
    .map((p) => ({ key: p.planKey as string, name: p.name }))
    .filter((p) => (seenKey.has(p.key) ? false : (seenKey.add(p.key), true)));
  const planKeys = ["all", ...allPlans.map((p) => p.key)];
  const planNameByKey = new Map(allPlans.map((p) => [p.key, p.name]));

  const plan: string = planKeys.includes(searchParams?.plan ?? "")
    ? searchParams!.plan!
    : "all";
  const status: (typeof STATUSES)[number] = isOne(
    STATUSES,
    searchParams?.status,
  )
    ? (searchParams!.status as (typeof STATUSES)[number])
    : "all";

  const service = createAdminClient();
  let query = service
    .from("subscriptions")
    .select(
      `
      id, plan, billing_cycle, status, trial_ends_at, current_period_end,
      cancel_at_period_end, created_at,
      host:hosts ( id, handle, display_name )
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (plan !== "all") query = query.eq("plan", plan);
  if (status !== "all") query = query.eq("status", status);

  const { data: rows, count } = await throwOnErrorWithCount(
    query,
    "admin/subscriptions",
  );

  const { data: distRows } = await service
    .from("subscriptions")
    .select("plan, status");
  const dist: Record<string, number> = {};
  for (const p of allPlans) dist[p.key] = 0;
  for (const r of distRows ?? []) {
    if (r.plan) dist[r.plan as string] = (dist[r.plan as string] ?? 0) + 1;
  }

  type Row = {
    id: string;
    plan: string;
    billing_cycle: string | null;
    status: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    created_at: string;
    host:
      | { id: string; handle: string; display_name: string }
      | { id: string; handle: string; display_name: string }[]
      | null;
  };

  const list = (rows as Row[] | null) ?? [];

  const columns: AdminColumn<Row>[] = [
    {
      header: "Host",
      cell: (s) => {
        const h = Array.isArray(s.host) ? s.host[0] : s.host;
        return (
          <div className="min-w-0">
            <div className="truncate font-medium text-brand-ink">
              {h?.display_name ?? "—"}
            </div>
            <div className="truncate font-mono text-[11px] text-brand-mute">
              @{h?.handle}
            </div>
          </div>
        );
      },
    },
    {
      header: "Plan",
      cell: (s) => (
        <span className="inline-flex items-center rounded-pill border border-brand-primary/30 bg-brand-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-brand-primary">
          {s.plan}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (s) => (
        <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-medium capitalize text-brand-mute">
          {s.status}
        </span>
      ),
    },
    {
      header: "Billing",
      cell: (s) => (
        <span className="text-[12px] text-brand-mute">
          {s.billing_cycle ?? "—"}
          {s.current_period_end
            ? ` · renews ${new Date(s.current_period_end).toLocaleDateString("en-ZA")}`
            : ""}
        </span>
      ),
    },
    {
      header: "",
      align: "right",
      cell: (s) => {
        const h = Array.isArray(s.host) ? s.host[0] : s.host;
        return h ? (
          <Link
            href={`/admin/hosts/${h.id}`}
            className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
          >
            Open host
          </Link>
        ) : null;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Subscriptions
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Plan distribution + per-host subscription state.
        </p>
      </header>

      <SubsTabs />

      <AdminStatBand
        cols={allPlans.length >= 6 ? 6 : allPlans.length >= 5 ? 5 : 4}
        stats={allPlans.map((p) => ({
          label: p.name,
          value: dist[p.key] ?? 0,
        }))}
      />

      <form
        action="/admin/subscriptions"
        method="get"
        className="flex flex-wrap items-center gap-2"
      >
        <select
          name="plan"
          defaultValue={plan}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink"
        >
          {planKeys.map((p) => (
            <option key={p} value={p}>
              {p === "all" ? "All plans" : (planNameByKey.get(p) ?? p)}
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
              {s === "all" ? "All statuses" : s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
        >
          Apply
        </button>
        {plan !== "all" || status !== "all" ? (
          <Link
            href="/admin/subscriptions"
            className="text-xs font-medium text-brand-primary underline-offset-2 hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <AdminTable
        columns={columns}
        rows={list}
        getKey={(s) => s.id}
        empty="No subscriptions match this filter."
      />

      {count != null && count > PAGE_SIZE ? (
        <p className="text-center text-[12px] text-brand-mute">
          Showing first {PAGE_SIZE} of {count}.
        </p>
      ) : null}
    </div>
  );
}
