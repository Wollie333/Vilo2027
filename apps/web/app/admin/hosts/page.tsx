import Link from "next/link";
import { Search, Star } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = { q?: string; status?: string };

const STATUSES = ["all", "verified", "unverified", "inactive"] as const;

function isStatus(v: string | undefined): v is (typeof STATUSES)[number] {
  return STATUSES.includes((v ?? "") as (typeof STATUSES)[number]);
}

export default async function AdminHostsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requirePermission("hosts.verify");

  const q = (searchParams?.q ?? "").trim();
  const status: (typeof STATUSES)[number] = isStatus(searchParams?.status)
    ? (searchParams!.status as (typeof STATUSES)[number])
    : "all";

  const service = createAdminClient();
  let query = service
    .from("hosts")
    .select(
      "id, user_id, handle, display_name, is_verified, is_active, total_bookings, total_reviews, avg_rating, created_at",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (q) {
    query = query.or(`display_name.ilike.%${q}%,handle.ilike.%${q}%`);
  }
  if (status === "verified") query = query.eq("is_verified", true);
  else if (status === "unverified") query = query.eq("is_verified", false);
  else if (status === "inactive") query = query.eq("is_active", false);

  const { data: rows, count } = await query;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Hosts
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            Every accommodation host on the platform.
          </p>
        </div>
        <p className="text-[12px] text-brand-mute">
          <span className="num font-semibold text-brand-ink">{count ?? 0}</span>{" "}
          matching
        </p>
      </header>

      <form
        action="/admin/hosts"
        method="get"
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by display name or handle"
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
              {s === "all" ? "All hosts" : s[0].toUpperCase() + s.slice(1)}
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
            href="/admin/hosts"
            className="text-xs font-medium text-brand-primary underline-offset-2 hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        {rows && rows.length > 0 ? (
          <ul className="divide-y divide-brand-line">
            {rows.map((h) => (
              <li
                key={h.id}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-brand-light/50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent font-mono text-[11px] font-semibold text-brand-secondary">
                  {h.display_name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p: string) => p[0]?.toUpperCase() ?? "")
                    .join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-brand-ink">
                      {h.display_name}
                    </span>
                    {h.is_verified ? (
                      <span className="inline-flex items-center rounded-pill bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                        Verified
                      </span>
                    ) : null}
                    {!h.is_active ? (
                      <span className="inline-flex items-center rounded-pill border border-status-cancelled/30 bg-status-cancelled/10 px-2 py-0.5 text-[10px] font-medium text-status-cancelled">
                        Inactive
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate font-mono text-[11px] text-brand-mute">
                    @{h.handle}
                  </div>
                </div>
                <div className="hidden items-center gap-1 text-[12px] text-brand-mute sm:flex">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="num">
                    {Number(h.avg_rating ?? 0).toFixed(1)}
                  </span>
                  <span>·</span>
                  <span className="num">{h.total_bookings}</span>
                  <span>bookings</span>
                </div>
                <Link
                  href={`/admin/hosts/${h.id}`}
                  className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-brand-mute">
            No hosts match this search.
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
