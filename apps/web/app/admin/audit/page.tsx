import Link from "next/link";

import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SearchParams = {
  admin?: string;
  action?: string;
  target_type?: string;
  since?: string;
  page?: string;
};

const PAGE_SIZE = 50;

const TARGET_TYPES = [
  "host",
  "guest",
  "user",
  "booking",
  "listing",
  "review",
  "subscription",
  "feature_override",
  "platform_setting",
  "platform_staff",
  "staff_member",
  "impersonation",
  "permission_denied",
] as const;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission("audit.view");
  const service = createAdminClient();

  const page = Math.max(1, Number(searchParams.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = service
    .from("admin_audit_log")
    .select(
      "id, admin_id, impersonating, action, target_type, target_id, payload, ip_address, created_at, user_profiles!admin_audit_log_admin_id_fkey(email)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (searchParams.admin) query = query.eq("admin_id", searchParams.admin);
  if (searchParams.action) query = query.eq("action", searchParams.action);
  if (searchParams.target_type)
    query = query.eq("target_type", searchParams.target_type);
  if (searchParams.since) query = query.gte("created_at", searchParams.since);

  const { data, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Audit log
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Immutable record of every admin action. {count?.toLocaleString() ?? 0}{" "}
          entries total.
        </p>
      </header>

      <form className="grid gap-3 rounded-card border border-brand-line bg-white p-4 lg:grid-cols-5">
        <label className="text-[12px] font-medium text-brand-mute">
          Admin user id
          <input
            type="text"
            name="admin"
            defaultValue={searchParams.admin ?? ""}
            placeholder="uuid"
            className="mt-1 w-full rounded-md border border-brand-line px-2 py-1.5 font-mono text-[12px]"
          />
        </label>
        <label className="text-[12px] font-medium text-brand-mute">
          Action
          <input
            type="text"
            name="action"
            defaultValue={searchParams.action ?? ""}
            placeholder="e.g. listing.update_basic"
            className="mt-1 w-full rounded-md border border-brand-line px-2 py-1.5 font-mono text-[12px]"
          />
        </label>
        <label className="text-[12px] font-medium text-brand-mute">
          Target type
          <select
            name="target_type"
            defaultValue={searchParams.target_type ?? ""}
            className="mt-1 w-full rounded-md border border-brand-line bg-white px-2 py-1.5 text-[12px]"
          >
            <option value="">All</option>
            {TARGET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] font-medium text-brand-mute">
          Since
          <input
            type="datetime-local"
            name="since"
            defaultValue={searchParams.since ?? ""}
            className="mt-1 w-full rounded-md border border-brand-line px-2 py-1.5 text-[12px]"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-md bg-brand-primary px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-primary/90"
          >
            Apply
          </button>
          <Link
            href="/admin/audit"
            className="rounded-md border border-brand-line px-3 py-1.5 text-[12px] font-semibold text-brand-mute hover:bg-brand-light"
          >
            Reset
          </Link>
        </div>
      </form>

      <div className="overflow-hidden rounded-card border border-brand-line bg-white">
        <table className="w-full text-[13px]">
          <thead className="border-b border-brand-line bg-brand-light text-left text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            <tr>
              <th className="px-4 py-2.5">When</th>
              <th className="px-4 py-2.5">Admin</th>
              <th className="px-4 py-2.5">Action</th>
              <th className="px-4 py-2.5">Target</th>
              <th className="px-4 py-2.5">Impersonating</th>
              <th className="px-4 py-2.5">IP</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => {
              const profile = row.user_profiles as {
                email?: string | null;
              } | null;
              return (
                <tr
                  key={row.id}
                  className="border-b border-brand-line align-top last:border-0"
                >
                  <td className="px-4 py-2.5 text-brand-mute">
                    {new Date(row.created_at).toLocaleString("en-ZA")}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-brand-ink">
                    {profile?.email ?? row.admin_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px]">
                    <span
                      className={
                        row.action === "permission_denied"
                          ? "rounded-pill bg-status-cancelled/10 px-2 py-0.5 text-status-cancelled"
                          : ""
                      }
                    >
                      {row.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-brand-mute">
                    <div className="font-mono text-[11px]">
                      {row.target_type}
                    </div>
                    {row.target_id ? (
                      <div className="font-mono text-[11px]">
                        {row.target_id.slice(0, 8)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-brand-mute">
                    {row.impersonating ? row.impersonating.slice(0, 8) : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-brand-mute">
                    {(row.ip_address as string | null) ?? "—"}
                  </td>
                </tr>
              );
            })}
            {(data ?? []).length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-brand-mute"
                >
                  No matching audit entries.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-[12px] text-brand-mute">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={{ query: { ...searchParams, page: page - 1 } }}
                className="rounded-md border border-brand-line px-3 py-1.5 text-brand-ink hover:bg-brand-light"
              >
                ← Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={{ query: { ...searchParams, page: page + 1 } }}
                className="rounded-md border border-brand-line px-3 py-1.5 text-brand-ink hover:bg-brand-light"
              >
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
