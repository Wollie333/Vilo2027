import { Link } from "@/i18n/navigation";
import { Search } from "lucide-react";

import { requirePermission } from "@/lib/admin";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

import { AdminTable, type AdminColumn } from "../_components/AdminTable";

export const dynamic = "force-dynamic";

// The app-wide internal ledger: every user-related (booking) transaction across
// the whole platform — money that flows host↔guest. View-only oversight so the
// owner can control the business. (Vilo's OWN revenue lives in the Vilo ledger
// under Subscriptions → Revenue.) Same table design as the host ledger.

const PAGE_SIZE = 200;
const INBOUND = new Set(["deposit", "balance", "addon", "payment", "credit"]);
const STATUSES = ["all", "completed", "pending", "failed", "refunded"] as const;

type SearchParams = {
  q?: string;
  status?: string;
  user?: string;
  listing?: string;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

type BookingEmbed = {
  reference: string;
  listing: { name: string } | { name: string }[] | null;
  host: { display_name: string } | { display_name: string }[] | null;
  guest:
    | { full_name: string | null; email: string | null }
    | { full_name: string | null; email: string | null }[]
    | null;
};

type Row = {
  id: string;
  amount: number;
  currency: string;
  kind: string;
  status: string;
  method: string | null;
  created_at: string;
  captured_at: string | null;
  provider_reference: string | null;
  booking: BookingEmbed | BookingEmbed[] | null;
};

export default async function AdminLedgerPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requirePermission("payments.view");
  const service = createAdminClient();

  const q = (searchParams?.q ?? "").trim();
  const userEmail = (searchParams?.user ?? "").trim();
  const listingId = (searchParams?.listing ?? "").trim();
  const status = (
    STATUSES.includes((searchParams?.status ?? "") as (typeof STATUSES)[number])
      ? searchParams!.status
      : "all"
  ) as (typeof STATUSES)[number];

  // Optional user/listing filters resolve to a set of booking ids first.
  let bookingIdFilter: string[] | null = null;
  if (userEmail) {
    const { data: u } = await service
      .from("user_profiles")
      .select("id")
      .ilike("email", userEmail)
      .maybeSingle();
    const ids = u
      ? ((
          await service.from("bookings").select("id").eq("guest_id", u.id)
        ).data?.map((b) => b.id) ?? [])
      : [];
    bookingIdFilter = ids;
  }
  if (listingId) {
    const ids =
      (
        await service.from("bookings").select("id").eq("listing_id", listingId)
      ).data?.map((b) => b.id) ?? [];
    bookingIdFilter = bookingIdFilter
      ? bookingIdFilter.filter((id) => ids.includes(id))
      : ids;
  }

  let query = service
    .from("payments")
    .select(
      `id, amount, currency, kind, status, method, created_at, captured_at, provider_reference,
       booking:bookings ( reference, listing:listings ( name ), host:hosts ( display_name ),
       guest:user_profiles!bookings_guest_id_fkey ( full_name, email ) )`,
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (status !== "all") query = query.eq("status", status);
  if (q) query = query.ilike("provider_reference", `%${q}%`);
  if (bookingIdFilter) {
    if (bookingIdFilter.length === 0) {
      // No matching bookings → empty result.
      query = query.eq("booking_id", "00000000-0000-0000-0000-000000000000");
    } else {
      query = query.in("booking_id", bookingIdFilter);
    }
  }

  const { data: rowsRaw } = await query;
  const rows = (rowsRaw as Row[] | null) ?? [];

  // KPI band — computed over completed, non-voided payments platform-wide.
  const { data: kpiRows } = await service
    .from("payments")
    .select("amount, kind")
    .eq("status", "completed")
    .is("voided_at", null);
  let collected = 0;
  let refunded = 0;
  for (const p of kpiRows ?? []) {
    const amt = Number(p.amount ?? 0);
    if (INBOUND.has(String(p.kind))) collected += amt;
    else if (p.kind === "refund") refunded += Math.abs(amt);
  }
  const net = collected - refunded;

  const columns: AdminColumn<Row>[] = [
    {
      header: "Date",
      cell: (p) => (
        <span className="text-[12px] text-brand-mute">
          {new Date(p.captured_at ?? p.created_at).toLocaleDateString("en-ZA")}
        </span>
      ),
    },
    {
      header: "Type",
      cell: (p) => (
        <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-brand-mute">
          {p.kind}
        </span>
      ),
    },
    {
      header: "Guest · Host",
      cell: (p) => {
        const b = one(p.booking);
        const guest = b ? one(b.guest) : null;
        const host = b ? one(b.host) : null;
        const listing = b ? one(b.listing) : null;
        return (
          <div className="min-w-0">
            <div className="truncate font-medium text-brand-ink">
              {guest?.full_name || guest?.email || "—"}
              {host ? (
                <span className="text-brand-mute"> · {host.display_name}</span>
              ) : null}
            </div>
            <div className="truncate font-mono text-[11px] text-brand-mute">
              {b?.reference ?? "—"}
              {listing ? ` · ${listing.name}` : ""}
            </div>
          </div>
        );
      },
    },
    {
      header: "Method",
      cell: (p) => (
        <span className="text-[12px] text-brand-mute">{p.method ?? "—"}</span>
      ),
    },
    {
      header: "Status",
      cell: (p) => <StatusPill status={p.status} />,
    },
    {
      header: "Amount",
      align: "right",
      cell: (p) => (
        <span
          className={`num font-mono font-semibold ${
            p.kind === "refund" ? "text-status-cancelled" : "text-brand-ink"
          }`}
        >
          {p.kind === "refund" ? "−" : ""}
          {formatMoney(Math.abs(Number(p.amount)), p.currency)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          App-wide ledger
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Every booking transaction across the platform (host ↔ guest money).
          View-only oversight. Vilo&apos;s own revenue is in{" "}
          <Link
            href="/admin/subscriptions/revenue"
            className="text-brand-primary hover:underline"
          >
            Subscriptions → Revenue
          </Link>
          .
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Collected" value={formatMoney(collected, "ZAR")} />
        <Kpi label="Refunded" value={formatMoney(refunded, "ZAR")} />
        <Kpi label="Net processed" value={formatMoney(net, "ZAR")} />
        <Kpi label="Shown" value={String(rows.length)} />
      </section>

      <form
        action="/admin/ledger"
        method="get"
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Provider reference"
            className="block w-full rounded border border-brand-line bg-white py-2 pl-9 pr-3 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none"
          />
        </div>
        <input
          type="text"
          name="user"
          defaultValue={userEmail}
          placeholder="Filter by user email"
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none"
        />
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
        {listingId ? (
          <input type="hidden" name="listing" value={listingId} />
        ) : null}
        <button
          type="submit"
          className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
        >
          Filter
        </button>
        {q || userEmail || listingId || status !== "all" ? (
          <Link
            href="/admin/ledger"
            className="text-xs font-medium text-brand-primary underline-offset-2 hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <AdminTable
        columns={columns}
        rows={rows}
        getKey={(p) => p.id}
        empty="No transactions match these filters."
      />

      {rows.length >= PAGE_SIZE ? (
        <p className="text-center text-[12px] text-brand-mute">
          Showing the latest {PAGE_SIZE}. Narrow the filters to see more.
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
