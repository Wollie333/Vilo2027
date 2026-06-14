import { Link } from "@/i18n/navigation";
import { Search } from "lucide-react";

import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { throwOnErrorWithCount } from "@/lib/supabase/query";
import { requirePermission } from "@/lib/admin";

import { AdminTable, type AdminColumn } from "../_components/AdminTable";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = { q?: string; status?: string };

const STATUSES = [
  "all",
  "pending",
  "pending_eft",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled_by_guest",
  "cancelled_by_host",
  "expired",
] as const;

function isStatus(v: string | undefined): v is (typeof STATUSES)[number] {
  return STATUSES.includes((v ?? "") as (typeof STATUSES)[number]);
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requirePermission("bookings.edit");

  const q = (searchParams?.q ?? "").trim();
  const status: (typeof STATUSES)[number] = isStatus(searchParams?.status)
    ? (searchParams!.status as (typeof STATUSES)[number])
    : "all";

  const service = createAdminClient();
  let query = service
    .from("bookings")
    .select(
      `
      id, reference, status, payment_status, payment_method,
      check_in, check_out, total_amount, currency, created_at,
      listing:listings ( name ),
      host:hosts ( display_name, handle ),
      guest:user_profiles!bookings_guest_id_fkey ( full_name, email )
    `,
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (q) {
    query = query.or(
      `reference.ilike.%${q}%,guest_name.ilike.%${q}%,guest_email.ilike.%${q}%`,
    );
  }
  if (status !== "all") query = query.eq("status", status);

  const { data: rows, count } = await throwOnErrorWithCount(
    query,
    "admin/bookings",
  );

  type Row = {
    id: string;
    reference: string;
    status: string;
    payment_status: string | null;
    payment_method: string | null;
    check_in: string | null;
    check_out: string | null;
    total_amount: number;
    currency: string;
    created_at: string;
    listing: { name: string } | { name: string }[] | null;
    host:
      | { display_name: string; handle: string }
      | { display_name: string; handle: string }[]
      | null;
    guest:
      | { full_name: string | null; email: string | null }
      | { full_name: string | null; email: string | null }[]
      | null;
  };

  const list = (rows as Row[] | null) ?? [];

  const columns: AdminColumn<Row>[] = [
    {
      header: "Reference",
      cell: (b) => (
        <span className="font-mono text-[12px] font-semibold text-brand-ink">
          {b.reference}
        </span>
      ),
    },
    { header: "Status", cell: (b) => <StatusPill status={b.status} /> },
    {
      header: "Property · Guest",
      cell: (b) => {
        const listing = Array.isArray(b.listing) ? b.listing[0] : b.listing;
        const host = Array.isArray(b.host) ? b.host[0] : b.host;
        const guest = Array.isArray(b.guest) ? b.guest[0] : b.guest;
        return (
          <div className="min-w-0">
            <div className="truncate font-medium text-brand-ink">
              {listing?.name ?? "—"}
            </div>
            <div className="truncate text-[11px] text-brand-mute">
              {host ? host.display_name : ""}
              {guest?.full_name ? ` · ${guest.full_name}` : ""}
            </div>
          </div>
        );
      },
    },
    {
      header: "Dates",
      cell: (b) => (
        <span className="text-[12px] text-brand-mute">
          {b.check_in ? `${b.check_in} → ${b.check_out}` : "—"}
        </span>
      ),
    },
    {
      header: "Total",
      align: "right",
      cell: (b) => (
        <span className="num font-medium text-brand-ink">
          {formatMoney(Number(b.total_amount), b.currency)}
        </span>
      ),
    },
    {
      header: "",
      align: "right",
      cell: (b) => (
        <Link
          href={`/dashboard/bookings/${b.id}`}
          className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
        >
          Open
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Bookings
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            Every booking on the platform — host, guest, payment status.
          </p>
        </div>
        <p className="text-[12px] text-brand-mute">
          <span className="num font-semibold text-brand-ink">{count ?? 0}</span>{" "}
          matching
        </p>
      </header>

      <form
        action="/admin/bookings"
        method="get"
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by reference or guest"
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
              {s === "all"
                ? "All statuses"
                : s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
        >
          Search
        </button>
        {q || status !== "all" ? (
          <Link
            href="/admin/bookings"
            className="text-xs font-medium text-brand-primary underline-offset-2 hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <AdminTable
        columns={columns}
        rows={list}
        getKey={(b) => b.id}
        empty="No bookings match this search."
      />

      {count != null && count > PAGE_SIZE ? (
        <p className="text-center text-[12px] text-brand-mute">
          Showing first {PAGE_SIZE} of {count}. Narrow your search to see more.
        </p>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed:
      "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
    completed:
      "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
    checked_in:
      "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
    pending:
      "bg-status-pending/10 text-status-pending border-status-pending/30",
    pending_eft:
      "bg-status-pending/10 text-status-pending border-status-pending/30",
    cancelled_by_guest:
      "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
    cancelled_by_host:
      "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
    expired: "bg-brand-light text-brand-mute border-brand-line",
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
