import Link from "next/link";
import { Search } from "lucide-react";

import { getBrandName } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = { q?: string; status?: string };

const STATUSES = [
  "all",
  "pending",
  "completed",
  "failed",
  "refunded",
  "partially_refunded",
] as const;

function isStatus(v: string | undefined): v is (typeof STATUSES)[number] {
  return STATUSES.includes((v ?? "") as (typeof STATUSES)[number]);
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requirePermission("payments.view");
  const brandName = await getBrandName();

  const q = (searchParams?.q ?? "").trim();
  const status: (typeof STATUSES)[number] = isStatus(searchParams?.status)
    ? (searchParams!.status as (typeof STATUSES)[number])
    : "all";

  const service = createAdminClient();
  let query = service
    .from("payments")
    .select(
      `
      id, amount, currency, status, method, provider_reference,
      captured_at, refunded_amount, created_at,
      booking:bookings ( id, reference, host:hosts ( display_name ) )
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (q) {
    query = query.or(`provider_reference.ilike.%${q}%`);
  }
  if (status !== "all") query = query.eq("status", status);

  const { data: rows, count } = await query;

  // KPI tiles: collected (sum completed), pending (count), failed (count)
  const [{ data: collected }, { count: pendingCount }, { count: failedCount }] =
    await Promise.all([
      service.from("payments").select("amount").eq("status", "completed"),
      service
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      service
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
    ]);
  const totalCollected = (collected ?? []).reduce(
    (sum, p) => sum + Number(p.amount ?? 0),
    0,
  );

  type Row = {
    id: string;
    amount: number;
    currency: string;
    status: string;
    method: string;
    provider_reference: string | null;
    captured_at: string | null;
    refunded_amount: number | null;
    created_at: string;
    booking:
      | {
          id: string;
          reference: string;
          host: { display_name: string } | { display_name: string }[] | null;
        }
      | {
          id: string;
          reference: string;
          host: { display_name: string } | { display_name: string }[] | null;
        }[]
      | null;
  };

  const list = (rows as Row[] | null) ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Payments
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Every payment processed through {brandName} — Paystack, PayPal, manual
          EFT.
        </p>
      </header>

      {/* KPI tiles */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Total collected"
          value={formatMoney(totalCollected, "ZAR")}
        />
        <Kpi label="Pending" value={String(pendingCount ?? 0)} />
        <Kpi label="Failed" value={String(failedCount ?? 0)} />
      </section>

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
            defaultValue={q}
            placeholder="Search by provider reference"
            className="block w-full rounded border border-brand-line bg-white py-2 pl-9 pr-3 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>
        <select
          name="status"
          defaultValue={status}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All" : s.replace(/_/g, " ")}
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

      <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        {list.length > 0 ? (
          <ul className="divide-y divide-brand-line">
            {list.map((p) => {
              const booking = Array.isArray(p.booking)
                ? p.booking[0]
                : p.booking;
              const host = booking
                ? Array.isArray(booking.host)
                  ? booking.host[0]
                  : booking.host
                : null;
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm hover:bg-brand-light/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="num font-medium text-brand-ink">
                        {formatMoney(Number(p.amount), p.currency)}
                      </span>
                      <StatusPill status={p.status} />
                      <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-brand-mute">
                        {p.method}
                      </span>
                    </div>
                    <div className="truncate font-mono text-[11px] text-brand-mute">
                      {p.provider_reference ?? "—"}
                      {booking ? ` · ${booking.reference}` : ""}
                      {host ? ` · ${host.display_name}` : ""}
                    </div>
                  </div>
                  <div className="hidden text-right text-[11px] text-brand-mute sm:block">
                    {p.captured_at
                      ? new Date(p.captured_at).toLocaleDateString("en-ZA")
                      : new Date(p.created_at).toLocaleDateString("en-ZA")}
                  </div>
                  {booking ? (
                    <Link
                      href={`/dashboard/bookings/${booking.id}`}
                      className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
                    >
                      Booking
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-brand-mute">
            No payments match this search.
          </p>
        )}
      </div>

      {count != null && count > PAGE_SIZE ? (
        <p className="text-center text-[12px] text-brand-mute">
          Showing first {PAGE_SIZE} of {count}. Narrow your search to see more.
        </p>
      ) : null}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div className="num mt-1 font-display text-xl font-bold text-brand-ink">
        {value}
      </div>
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
    refunded: "bg-brand-light text-brand-mute border-brand-line",
    partially_refunded:
      "bg-status-pending/10 text-status-pending border-status-pending/30",
  };
  const cls = map[status] ?? "bg-brand-light text-brand-mute border-brand-line";
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
