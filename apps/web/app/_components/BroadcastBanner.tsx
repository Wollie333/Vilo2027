import { AlertTriangle, Info } from "lucide-react";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";

import { BroadcastAckButton } from "./BroadcastAckButton";

type ActiveBroadcast = {
  id: string;
  severity: string;
  title: string;
  body: string;
  link_url: string | null;
  link_label: string | null;
  requires_ack: boolean;
};

type AckState = {
  acknowledged_at: string | null;
  dismissed_at: string | null;
};

// Server component. Renders sticky/inline banners for critical + warning
// severities. Info-severity broadcasts are surfaced via the bell only
// (handled by useNotifications — they're queried directly via RLS).

export async function BroadcastBanner() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS filters to the user's role + active window.
  const { data: rows } = await supabase
    .from("broadcast_announcements")
    .select("id, severity, title, body, link_url, link_label, requires_ack")
    .in("severity", ["critical", "warning"])
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);

  if (!rows || rows.length === 0) return null;

  const broadcastIds = rows.map((r) => r.id as string);
  const { data: acks } = await supabase
    .from("broadcast_acknowledgements")
    .select("broadcast_id, acknowledged_at, dismissed_at")
    .in("broadcast_id", broadcastIds)
    .eq("user_id", user.id);

  const ackMap = new Map<string, AckState>(
    (acks ?? []).map((a) => [
      a.broadcast_id as string,
      {
        acknowledged_at: a.acknowledged_at as string | null,
        dismissed_at: a.dismissed_at as string | null,
      },
    ]),
  );

  const visible = (rows as ActiveBroadcast[]).filter((b) => {
    const a = ackMap.get(b.id);
    if (!a) return true;
    if (b.severity === "critical") return !a.acknowledged_at;
    return !a.dismissed_at;
  });

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 px-4 pt-3 lg:px-8">
      {visible.map((b) => (
        <BroadcastRow key={b.id} b={b} />
      ))}
    </div>
  );
}

function BroadcastRow({ b }: { b: ActiveBroadcast }) {
  if (b.severity === "critical") {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-card border border-red-300 bg-red-50 p-4 shadow-card"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
        <div className="flex-1">
          <div className="font-display font-bold text-red-900">{b.title}</div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-red-900/90">
            {b.body}
          </p>
          {b.link_url ? (
            <Link
              href={b.link_url}
              className="mt-2 inline-block text-sm font-semibold text-red-900 underline"
            >
              {b.link_label ?? "Read more"}
            </Link>
          ) : null}
        </div>
        <BroadcastAckButton id={b.id} mode="acknowledge" />
      </div>
    );
  }
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-card border border-amber-300 bg-amber-50 p-3 shadow-card"
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
      <div className="flex-1">
        <div className="font-semibold text-amber-900">{b.title}</div>
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-amber-900/90">
          {b.body}
        </p>
        {b.link_url ? (
          <Link
            href={b.link_url}
            className="mt-1 inline-block text-sm font-semibold text-amber-900 underline"
          >
            {b.link_label ?? "Read more"}
          </Link>
        ) : null}
      </div>
      <BroadcastAckButton id={b.id} mode="dismiss" />
    </div>
  );
}
