import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const service = createAdminClient();

  const [hostsRes, listingsRes, bookingsRes, refundsRes, auditRes] =
    await Promise.all([
      service
        .from("hosts")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      service
        .from("listings")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      service.from("bookings").select("id", { count: "exact", head: true }),
      service
        .from("refund_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      service
        .from("admin_audit_log")
        .select("id, action, target_type, target_id, admin_id, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const kpis = [
    { label: "Active hosts", value: hostsRes.count ?? 0, href: "/admin/hosts" },
    {
      label: "Live listings",
      value: listingsRes.count ?? 0,
      href: "/admin/listings",
    },
    {
      label: "Total bookings",
      value: bookingsRes.count ?? 0,
      href: "/admin/bookings",
    },
    {
      label: "Pending refunds",
      value: refundsRes.count ?? 0,
      href: "/admin/payments",
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Control Centre
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Founder & platform-staff operations console. Every write is recorded
          in the audit log.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className="rounded-card border border-brand-line bg-white p-5 transition-colors hover:border-brand-primary"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              {k.label}
            </div>
            <div className="num mt-2 font-display text-3xl font-bold text-brand-ink">
              {k.value.toLocaleString()}
            </div>
          </Link>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold text-brand-ink">
            Recent admin activity
          </h2>
          <Link
            href="/admin/audit"
            className="text-[12px] font-medium text-brand-primary hover:underline"
          >
            View audit log →
          </Link>
        </div>
        <div className="overflow-hidden rounded-card border border-brand-line bg-white">
          <table className="w-full text-[13px]">
            <thead className="border-b border-brand-line bg-brand-light text-left text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              <tr>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Target</th>
                <th className="px-4 py-2.5">Admin</th>
              </tr>
            </thead>
            <tbody>
              {(auditRes.data ?? []).map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-brand-line last:border-0"
                >
                  <td className="px-4 py-2.5 text-brand-mute">
                    {formatRelative(row.created_at)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px]">
                    {row.action}
                  </td>
                  <td className="px-4 py-2.5 text-brand-mute">
                    {row.target_type}
                    {row.target_id ? ` · ${row.target_id.slice(0, 8)}` : ""}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-brand-mute">
                    {row.admin_id.slice(0, 8)}
                  </td>
                </tr>
              ))}
              {(auditRes.data ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-brand-mute"
                  >
                    No admin actions logged yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
