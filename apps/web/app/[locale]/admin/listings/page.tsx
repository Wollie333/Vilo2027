import { Link } from "@/i18n/navigation";
import { Search } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { throwOnErrorWithCount } from "@/lib/supabase/query";
import { requirePermission } from "@/lib/admin";

import { AdminTable, type AdminColumn } from "../_components/AdminTable";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = { q?: string; status?: string };

const STATUSES = ["all", "published", "draft", "featured"] as const;

function isStatus(v: string | undefined): v is (typeof STATUSES)[number] {
  return STATUSES.includes((v ?? "") as (typeof STATUSES)[number]);
}

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requirePermission("listings.edit");

  const q = (searchParams?.q ?? "").trim();
  const status: (typeof STATUSES)[number] = isStatus(searchParams?.status)
    ? (searchParams!.status as (typeof STATUSES)[number])
    : "all";

  const service = createAdminClient();
  let query = service
    .from("listings")
    .select(
      `
      id, name, slug, listing_type, is_published, is_featured, city, province,
      base_price, currency, created_at,
      host:hosts ( id, handle, display_name )
    `,
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (q) {
    query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%`);
  }
  if (status === "published") query = query.eq("is_published", true);
  else if (status === "draft") query = query.eq("is_published", false);
  else if (status === "featured") query = query.eq("is_featured", true);

  const { data: rows, count } = await throwOnErrorWithCount(
    query,
    "admin/listings",
  );

  type Row = {
    id: string;
    name: string;
    slug: string | null;
    listing_type: string;
    is_published: boolean;
    is_featured: boolean;
    city: string | null;
    province: string | null;
    base_price: number;
    currency: string;
    created_at: string;
    host:
      | { id: string; handle: string; display_name: string }
      | { id: string; handle: string; display_name: string }[]
      | null;
  };

  const list = (rows as Row[] | null) ?? [];

  const columns: AdminColumn<Row>[] = [
    {
      header: "Listing",
      cell: (l) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-brand-ink">{l.name}</div>
          <div className="truncate text-[11px] uppercase tracking-wider text-brand-mute">
            {l.listing_type}
          </div>
        </div>
      ),
    },
    {
      header: "Host",
      cell: (l) => {
        const host = Array.isArray(l.host) ? l.host[0] : l.host;
        return host ? (
          <Link
            href={`/admin/hosts/${host.id}`}
            className="text-[12px] text-brand-primary hover:underline"
          >
            {host.display_name}
          </Link>
        ) : (
          <span className="text-brand-mute">—</span>
        );
      },
    },
    {
      header: "Location",
      cell: (l) => (
        <span className="text-[12px] text-brand-mute">
          {[l.city, l.province].filter(Boolean).join(", ") || "—"}
        </span>
      ),
    },
    {
      header: "From",
      align: "right",
      cell: (l) => (
        <span className="num font-medium text-brand-ink">
          R{" "}
          {Math.round(Number(l.base_price))
            .toLocaleString("en-ZA")
            .replace(/,/g, " ")}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (l) =>
        l.is_featured ? (
          <Pill tone="primary">Featured</Pill>
        ) : l.is_published ? (
          <Pill tone="good">Published</Pill>
        ) : (
          <Pill tone="pending">Draft</Pill>
        ),
    },
    {
      header: "",
      align: "right",
      cell: (l) =>
        l.slug ? (
          <Link
            href={`/listing/${l.slug}`}
            target="_blank"
            className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
          >
            View
          </Link>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Listings
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            Every accommodation listing on the platform.
          </p>
        </div>
        <p className="text-[12px] text-brand-mute">
          <span className="num font-semibold text-brand-ink">{count ?? 0}</span>{" "}
          matching
        </p>
      </header>

      <form
        action="/admin/listings"
        method="get"
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name or city"
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
              {s === "all" ? "All listings" : s[0].toUpperCase() + s.slice(1)}
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
            href="/admin/listings"
            className="text-xs font-medium text-brand-primary underline-offset-2 hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <AdminTable
        columns={columns}
        rows={list}
        getKey={(l) => l.id}
        empty="No listings match this search."
      />

      {count != null && count > PAGE_SIZE ? (
        <p className="text-center text-[12px] text-brand-mute">
          Showing first {PAGE_SIZE} of {count}. Narrow your search to see more.
        </p>
      ) : null}
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "good" | "pending" | "primary";
}) {
  const cls =
    tone === "good"
      ? "bg-status-confirmed/10 text-status-confirmed"
      : tone === "primary"
        ? "bg-brand-primary/10 text-brand-primary"
        : "bg-status-pending/10 text-status-pending";
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {children}
    </span>
  );
}
