import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = { plan?: string; status?: string };

const PLANS = ["all", "free", "basic", "pro", "business"] as const;
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

  const plan: (typeof PLANS)[number] = isOne(PLANS, searchParams?.plan)
    ? (searchParams!.plan as (typeof PLANS)[number])
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

  const { data: rows, count } = await query;

  const { data: distRows } = await service
    .from("subscriptions")
    .select("plan, status");
  const dist: Record<string, number> = {
    free: 0,
    basic: 0,
    pro: 0,
    business: 0,
  };
  for (const r of distRows ?? []) {
    if (r.plan && dist[r.plan as string] != null) {
      dist[r.plan as string]! += 1;
    }
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

      <section className="grid gap-3 sm:grid-cols-4">
        {(["free", "basic", "pro", "business"] as const).map((p) => (
          <div
            key={p}
            className="rounded-card border border-brand-line bg-white p-4 shadow-card"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
              {p}
            </div>
            <div className="num mt-1 font-display text-xl font-bold text-brand-ink">
              {dist[p] ?? 0}
            </div>
          </div>
        ))}
      </section>

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
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {p === "all" ? "All plans" : p[0].toUpperCase() + p.slice(1)}
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

      <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        {list.length > 0 ? (
          <ul className="divide-y divide-brand-line">
            {list.map((s) => {
              const host = Array.isArray(s.host) ? s.host[0] : s.host;
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm hover:bg-brand-light/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-brand-ink">
                        {host?.display_name ?? "—"}
                      </span>
                      <span className="font-mono text-[11px] text-brand-mute">
                        @{host?.handle}
                      </span>
                      <span className="inline-flex items-center rounded-pill border border-brand-primary/30 bg-brand-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-brand-primary">
                        {s.plan}
                      </span>
                      <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-medium capitalize text-brand-mute">
                        {s.status}
                      </span>
                      {s.cancel_at_period_end ? (
                        <span className="inline-flex items-center rounded-pill border border-status-cancelled/30 bg-status-cancelled/10 px-2 py-0.5 text-[10px] font-medium text-status-cancelled">
                          Cancels at period end
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-[11px] text-brand-mute">
                      {s.billing_cycle ?? "—"}
                      {s.current_period_end
                        ? ` · renews ${new Date(s.current_period_end).toLocaleDateString("en-ZA")}`
                        : ""}
                      {s.trial_ends_at
                        ? ` · trial ends ${new Date(s.trial_ends_at).toLocaleDateString("en-ZA")}`
                        : ""}
                    </div>
                  </div>
                  {host ? (
                    <Link
                      href={`/admin/hosts/${host.id}`}
                      className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
                    >
                      Open host
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-brand-mute">
            No subscriptions match this filter.
          </p>
        )}
      </div>

      {count != null && count > PAGE_SIZE ? (
        <p className="text-center text-[12px] text-brand-mute">
          Showing first {PAGE_SIZE} of {count}.
        </p>
      ) : null}
    </div>
  );
}
