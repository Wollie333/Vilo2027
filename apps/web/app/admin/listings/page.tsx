import Link from "next/link";
import { Search } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin";

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

  const { data: rows, count } = await query;

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

      <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        {list.length > 0 ? (
          <ul className="divide-y divide-brand-line">
            {list.map((l) => {
              const host = Array.isArray(l.host) ? l.host[0] : l.host;
              return (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-brand-light/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-brand-ink">
                        {l.name}
                      </span>
                      <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-brand-mute">
                        {l.listing_type}
                      </span>
                      {l.is_published ? (
                        <span className="inline-flex items-center rounded-pill bg-status-confirmed/10 px-2 py-0.5 text-[10px] font-medium text-status-confirmed">
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-pill bg-status-pending/10 px-2 py-0.5 text-[10px] font-medium text-status-pending">
                          Draft
                        </span>
                      )}
                      {l.is_featured ? (
                        <span className="inline-flex items-center rounded-pill bg-brand-primary/10 px-2 py-0.5 text-[10px] font-medium text-brand-primary">
                          Featured
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-[11px] text-brand-mute">
                      {host ? (
                        <Link
                          href={`/admin/hosts/${host.id}`}
                          className="text-brand-primary underline-offset-2 hover:underline"
                        >
                          {host.display_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {l.city ? ` · ${l.city}` : ""}
                      {l.province ? `, ${l.province}` : ""}
                    </div>
                  </div>
                  <div className="hidden text-right text-[12px] text-brand-mute sm:block">
                    From{" "}
                    <span className="num font-medium text-brand-ink">
                      R{" "}
                      {Math.round(Number(l.base_price))
                        .toLocaleString("en-ZA")
                        .replace(/,/g, " ")}
                    </span>{" "}
                    / night
                  </div>
                  <div className="flex items-center gap-2">
                    {l.slug ? (
                      <Link
                        href={`/listing/${l.slug}`}
                        target="_blank"
                        className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
                      >
                        View
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-brand-mute">
            No listings match this search.
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
