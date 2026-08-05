import { AlertTriangle, Info, Megaphone } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";

import { BroadcastAckButton } from "./BroadcastAckButton";
import { BroadcastLink } from "./BroadcastLink";

// Local copy — must NOT be imported from BroadcastLink ("use client"): a plain
// function exported from a client module is a non-callable client reference on
// the server, which throws when this server component renders a link.
function isExternalUrl(href: string): boolean {
  return /^https?:\/\//.test(href);
}

type ActiveBroadcast = {
  id: string;
  severity: string;
  title: string;
  body: string;
  link_url: string | null;
  link_label: string | null;
  banner_dismiss_mode: string;
};

type AckState = {
  acknowledged_at: string | null;
  dismissed_at: string | null;
};

// Server component. Renders banners for any broadcast the admin explicitly
// switched on (show_banner) whose surfaces include 'dashboard'. Severity now
// drives ONLY the colour; whether it's a banner and how it's dismissed are
// independent, admin-chosen settings. Broadcasts with show_banner = false are
// bell-only (surfaced by useNotifications via RLS).
//
// Mounted on every app shell: dashboard (host), admin, and the guest portal.

export async function BroadcastBanner() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS (broadcast_recipients_select) filters to the user's role + active
  // window. We add the explicit banner gate: switched on + dashboard surface.
  const { data: rows } = await supabase
    .from("broadcast_announcements")
    .select(
      "id, severity, title, body, link_url, link_label, banner_dismiss_mode, banner_surfaces",
    )
    .eq("show_banner", true)
    .contains("banner_surfaces", ["dashboard"])
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
    // persistent → always shows; acknowledge → hide once acknowledged;
    // dismissible → hide once dismissed.
    if (b.banner_dismiss_mode === "persistent") return true;
    if (b.banner_dismiss_mode === "acknowledge") return !a.acknowledged_at;
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

// Severity → colour tokens. Severity is now purely visual.
const SEVERITY_STYLES: Record<
  string,
  {
    container: string;
    icon: string;
    title: string;
    body: string;
    link: string;
    Icon: typeof Info;
    role: "alert" | "status";
  }
> = {
  critical: {
    container: "border-red-300 bg-red-50",
    icon: "text-red-700",
    title: "text-red-900",
    body: "text-red-900/90",
    link: "text-red-900",
    Icon: AlertTriangle,
    role: "alert",
  },
  warning: {
    container: "border-amber-300 bg-amber-50",
    icon: "text-amber-700",
    title: "text-amber-900",
    body: "text-amber-900/90",
    link: "text-amber-900",
    Icon: Info,
    role: "status",
  },
  info: {
    container: "border-blue-300 bg-blue-50",
    icon: "text-blue-700",
    title: "text-blue-900",
    body: "text-blue-900/90",
    link: "text-blue-900",
    Icon: Megaphone,
    role: "status",
  },
};

function BroadcastRow({ b }: { b: ActiveBroadcast }) {
  const s = SEVERITY_STYLES[b.severity] ?? SEVERITY_STYLES.info;
  const { Icon } = s;
  return (
    <div
      role={s.role}
      className={`flex items-start gap-3 rounded-card border p-4 shadow-card ${s.container}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${s.icon}`} />
      <div className="flex-1">
        <div className={`font-display font-bold ${s.title}`}>{b.title}</div>
        <p className={`mt-1 whitespace-pre-wrap text-sm ${s.body}`}>{b.body}</p>
        {b.link_url ? (
          <BroadcastLink
            broadcastId={b.id}
            href={b.link_url}
            external={isExternalUrl(b.link_url)}
            className={`mt-2 inline-block text-sm font-semibold underline ${s.link}`}
          >
            {b.link_label ?? "Read more"}
          </BroadcastLink>
        ) : null}
      </div>
      {b.banner_dismiss_mode === "acknowledge" ? (
        <BroadcastAckButton id={b.id} mode="acknowledge" />
      ) : b.banner_dismiss_mode === "dismissible" ? (
        <BroadcastAckButton id={b.id} mode="dismiss" />
      ) : null}
    </div>
  );
}
