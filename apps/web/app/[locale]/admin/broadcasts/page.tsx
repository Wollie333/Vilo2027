import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { Megaphone, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/admin/requirePermission";
import { createAdminClient } from "@/lib/supabase/admin";
import { throwOnError } from "@/lib/supabase/query";

export const metadata: Metadata = {
  title: "Broadcasts · Admin",
};

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  severity: string;
  audience: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

export default async function BroadcastsListPage() {
  await requirePermission("notifications.broadcast");

  const service = createAdminClient();
  const rows = await throwOnError(
    service
      .from("broadcast_announcements")
      .select(
        "id, severity, audience, title, starts_at, ends_at, cancelled_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    "admin/broadcasts",
  );

  return (
    <section>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-brand-ink">
            <Megaphone className="h-6 w-6 text-brand-primary" /> Broadcasts
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Site-wide announcements. Audience can be all users, hosts only,
            guests only, staff only, or super admins. Critical broadcasts also
            email the audience.
          </p>
        </div>
        <Link href="/admin/broadcasts/new">
          <Button>
            <Plus className="mr-1.5 h-4 w-4" />
            New broadcast
          </Button>
        </Link>
      </header>

      <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <table className="w-full text-sm">
          <thead className="border-b border-brand-line bg-brand-light text-left text-xs font-semibold uppercase tracking-wider text-brand-mute">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Severity</th>
              <th className="px-4 py-2">Audience</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row) => (
              <BroadcastTr key={row.id} row={row as Row} />
            ))}
            {(!rows || rows.length === 0) && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-sm text-brand-mute"
                >
                  No broadcasts yet. Send your first announcement above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BroadcastTr({ row }: { row: Row }) {
  const now = Date.now();
  const startsMs = new Date(row.starts_at).getTime();
  const endsMs = row.ends_at ? new Date(row.ends_at).getTime() : null;
  let status: "scheduled" | "active" | "ended" | "cancelled";
  if (row.cancelled_at) status = "cancelled";
  else if (startsMs > now) status = "scheduled";
  else if (endsMs && endsMs < now) status = "ended";
  else status = "active";

  return (
    <tr className="border-b border-brand-line/60 last:border-b-0 hover:bg-brand-accent/30">
      <td className="px-4 py-3">
        <Link
          href={`/admin/broadcasts/${row.id}`}
          className="font-medium text-brand-ink hover:text-brand-primary"
        >
          {row.title}
        </Link>
      </td>
      <td className="px-4 py-3">
        <SeverityBadge severity={row.severity} />
      </td>
      <td className="px-4 py-3 text-brand-mute">{row.audience}</td>
      <td className="px-4 py-3">
        <StatusBadge status={status} />
      </td>
      <td className="px-4 py-3 text-xs text-brand-mute">
        {new Date(row.created_at).toLocaleString()}
      </td>
    </tr>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { label: string; klass: string }> = {
    info: { label: "Info", klass: "bg-blue-100 text-blue-800" },
    warning: { label: "Warning", klass: "bg-amber-100 text-amber-800" },
    critical: { label: "Critical", klass: "bg-red-100 text-red-800" },
  };
  const s = map[severity] ?? { label: severity, klass: "bg-gray-100" };
  return (
    <Badge className={`${s.klass} border-0 font-semibold`}>{s.label}</Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800",
    scheduled: "bg-sky-100 text-sky-800",
    ended: "bg-gray-100 text-gray-700",
    cancelled: "bg-zinc-100 text-zinc-700 line-through",
  };
  return (
    <Badge className={`${map[status] ?? "bg-gray-100"} border-0 capitalize`}>
      {status}
    </Badge>
  );
}
