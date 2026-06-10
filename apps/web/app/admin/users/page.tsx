import Link from "next/link";
import { Search, User } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { throwOnErrorWithCount } from "@/lib/supabase/query";
import { requirePermission } from "@/lib/admin";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; role?: string };

const PAGE_SIZE = 50;
const ROLES = ["all", "guest", "host", "admin"] as const;

function isRole(role: string | undefined): role is (typeof ROLES)[number] {
  return ROLES.includes((role ?? "") as (typeof ROLES)[number]);
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requirePermission("users.view");

  const q = (searchParams?.q ?? "").trim();
  const role: (typeof ROLES)[number] = isRole(searchParams?.role)
    ? (searchParams!.role as (typeof ROLES)[number])
    : "all";

  const service = createAdminClient();
  let query = service
    .from("user_profiles")
    .select(
      "id, full_name, email, role, phone, is_active, created_at, deleted_at",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (q) {
    query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  }
  if (role !== "all") {
    query = query.eq("role", role);
  }

  const { data: rows, count } = await throwOnErrorWithCount(
    query,
    "admin/users",
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Users
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            Every account on the platform — guests, hosts, and staff.
          </p>
        </div>
        <p className="text-[12px] text-brand-mute">
          <span className="num font-semibold text-brand-ink">{count ?? 0}</span>{" "}
          matching
        </p>
      </header>

      <form
        action="/admin/users"
        method="get"
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by email or name"
            className="block w-full rounded border border-brand-line bg-white py-2 pl-9 pr-3 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>
        <select
          name="role"
          defaultValue={role}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r === "all" ? "All roles" : r[0].toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
        >
          Search
        </button>
        {q || role !== "all" ? (
          <Link
            href="/admin/users"
            className="text-xs font-medium text-brand-primary underline-offset-2 hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        {rows && rows.length > 0 ? (
          <ul className="divide-y divide-brand-line">
            {rows.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-brand-light/50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-primary">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-brand-ink">
                      {u.full_name || "—"}
                    </span>
                    <RolePill role={u.role} />
                    {!u.is_active ? (
                      <span className="inline-flex items-center rounded-pill border border-status-cancelled/30 bg-status-cancelled/10 px-2 py-0.5 text-[10px] font-medium text-status-cancelled">
                        Suspended
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate font-mono text-[11px] text-brand-mute">
                    {u.email}
                  </div>
                </div>
                <div className="hidden text-[11px] text-brand-mute sm:block">
                  Joined {new Date(u.created_at).toLocaleDateString("en-ZA")}
                </div>
                <Link
                  href={`/admin/users/${u.id}`}
                  className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-brand-mute">
            No users match this search.
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

function RolePill({ role }: { role: string | null }) {
  const styles: Record<string, string> = {
    admin: "bg-brand-primary/10 text-brand-primary border-brand-primary/30",
    host: "bg-brand-accent text-brand-primary border-brand-primary/20",
    guest: "bg-brand-light text-brand-mute border-brand-line",
  };
  const cls = styles[role ?? ""] ?? styles.guest;
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-medium capitalize ${cls}`}
    >
      {role ?? "user"}
    </span>
  );
}
