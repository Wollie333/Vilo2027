import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { Plus, Send as SendIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/admin/requirePermission";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Sent notifications · Admin",
};

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  body: string;
  severity: string;
  channels: string[];
  recipient_count: number;
  created_at: string;
  created_by: string;
};

export default async function SentNotificationsPage() {
  await requirePermission("notifications.view_history");
  const service = createAdminClient();

  const { data: rows } = await service
    .from("admin_message_batches")
    .select(
      "id, title, body, severity, channels, recipient_count, created_at, created_by",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  // Optional: resolve creator emails for display.
  const creatorIds = Array.from(
    new Set((rows ?? []).map((r) => r.created_by as string)),
  );
  const emailByUser = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: users } = await service
      .from("user_profiles")
      .select("id, email")
      .in("id", creatorIds);
    for (const u of users ?? []) {
      if (u.email) emailByUser.set(u.id as string, u.email as string);
    }
  }

  return (
    <section>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-brand-ink">
            <SendIcon className="h-6 w-6 text-brand-primary" /> Sent
            notifications
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Direct notifications sent to specific users. Use Broadcasts for
            site-wide announcements.
          </p>
        </div>
        <Link href="/admin/notifications/send">
          <Button>
            <Plus className="mr-1.5 h-4 w-4" />
            New send
          </Button>
        </Link>
      </header>

      <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <table className="w-full text-sm">
          <thead className="border-b border-brand-line text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8AA89C]">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Severity</th>
              <th className="px-4 py-2">Channels</th>
              <th className="px-4 py-2">Recipients</th>
              <th className="px-4 py-2">Sent by</th>
              <th className="px-4 py-2">Sent at</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row) => (
              <BatchRow
                key={row.id}
                row={row as Row}
                creatorEmail={emailByUser.get((row as Row).created_by) ?? "—"}
              />
            ))}
            {(!rows || rows.length === 0) && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-sm text-brand-mute"
                >
                  No sends yet. Send your first direct notification above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BatchRow({ row, creatorEmail }: { row: Row; creatorEmail: string }) {
  return (
    <tr className="border-b border-brand-line/60 last:border-b-0 hover:bg-brand-accent/30">
      <td className="px-4 py-3">
        <div className="font-medium text-brand-ink">{row.title}</div>
        <div className="line-clamp-1 text-xs text-brand-mute">{row.body}</div>
      </td>
      <td className="px-4 py-3">
        <SeverityBadge severity={row.severity} />
      </td>
      <td className="px-4 py-3 text-xs text-brand-mute">
        {(row.channels ?? []).join(", ") || "—"}
      </td>
      <td className="px-4 py-3 text-sm">{row.recipient_count}</td>
      <td className="px-4 py-3 text-xs text-brand-mute">{creatorEmail}</td>
      <td className="px-4 py-3 text-xs text-brand-mute">
        {new Date(row.created_at).toLocaleString()}
      </td>
    </tr>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    info: "bg-blue-100 text-blue-800",
    default: "bg-gray-100 text-gray-800",
    high: "bg-amber-100 text-amber-800",
  };
  return (
    <Badge className={`${map[severity] ?? "bg-gray-100"} border-0 capitalize`}>
      {severity}
    </Badge>
  );
}
