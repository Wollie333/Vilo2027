import { Link } from "@/i18n/navigation";
import { Search } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { throwOnErrorWithCount } from "@/lib/supabase/query";
import { requirePermission } from "@/lib/admin";

import { AdminTable, type AdminColumn } from "../_components/AdminTable";
import { AdminKpiCard } from "../_components/AdminKpiCard";
import { AdminSegments } from "../_components/AdminSegments";

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
    .from("properties")
    .select(
      `
      id, name, slug, property_type, is_published, is_featured, city, province,
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
    property_type: string;
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

  // KPI + segment counts (all non-deleted listings).
  const { data: allRows } = await service
    .from("properties")
    .select("is_published, is_featured")
    .is("deleted_at", null);
  let total = 0;
  let published = 0;
  let draft = 0;
  let featured = 0;
  for (const l of allRows ?? []) {
    total += 1;
    if (l.is_published) published += 1;
    else draft += 1;
    if (l.is_featured) featured += 1;
  }

  const columns: AdminColumn<Row>[] = [
    {
      header: "Listing",
      cell: (l) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-brand-ink">{l.name}</div>
          <div className="truncate text-[11px] uppercase tracking-wider text-brand-mute">
            {l.property_type}
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
            href={`/property/${l.slug}`}
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
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Listings
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Every accommodation listing on the platform.
        </p>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminKpiCard label="Total listings" value={total} />
        <AdminKpiCard label="Published" value={published} />
        <AdminKpiCard label="Draft" value={draft} />
        <AdminKpiCard label="Featured" value={featured} />
      </section>

      <AdminTable
        columns={columns}
        rows={list}
        getKey={(l) => l.id}
        empty="No listings match this filter."
        topBar={
          <AdminSegments
            param="status"
            current={status}
            options={[
              { key: "all", label: "All", count: total },
              { key: "published", label: "Published", count: published },
              { key: "draft", label: "Draft", count: draft },
              { key: "featured", label: "Featured", count: featured },
            ]}
          />
        }
        toolbar={
          <form
            action="/admin/properties"
            method="get"
            className="flex flex-wrap items-center gap-2"
          >
            {status !== "all" ? (
              <input type="hidden" name="status" value={status} />
            ) : null}
            <div className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-pill border border-transparent bg-white px-3 ring-1 ring-brand-line focus-within:border-brand-primary focus-within:ring-brand-primary/30">
              <Search className="h-4 w-4 text-brand-mute" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search name or city…"
                className="w-full bg-transparent text-[13px] text-brand-ink outline-none placeholder:text-brand-mute"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white hover:bg-brand-secondary"
            >
              Search
            </button>
            {q ? (
              <Link
                href={
                  status === "all"
                    ? "/admin/properties"
                    : `/admin/properties?status=${status}`
                }
                className="text-xs font-medium text-brand-primary underline-offset-2 hover:underline"
              >
                Clear
              </Link>
            ) : null}
          </form>
        }
        footer={
          <div className="text-[12px] tabular-nums text-brand-mute">
            Showing {list.length} of {count ?? list.length}
            {count != null && count > PAGE_SIZE
              ? " — narrow your search to see more"
              : ""}
          </div>
        }
      />
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
