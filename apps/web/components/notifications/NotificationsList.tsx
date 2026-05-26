"use client";

import { Bell, CheckCheck, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export type ListNotification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  category_id: string;
  severity: "info" | "default" | "high" | "critical";
  payload: Record<string, unknown> | null;
};

type Props = {
  initial: ListNotification[];
};

// Human labels for the category filter chips. Falls back to a prettified
// version of the id so new categories work without a code change.
const CATEGORY_LABELS: Record<string, string> = {
  bookings: "Bookings",
  payments_refunds: "Payments",
  messages: "Messages",
  reviews: "Reviews",
  calendar_sync: "Calendar",
  subscription: "Subscription",
  account_security: "Security",
  admin_broadcasts: "Announcements",
  marketing_tips: "Tips",
};

function prettify(id: string): string {
  return (
    CATEGORY_LABELS[id] ??
    id
      .split("_")
      .map((s, i) => (i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s))
      .join(" ")
  );
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function severityBorder(
  s: ListNotification["severity"],
  unread: boolean,
): string {
  if (s === "critical")
    return unread ? "border-red-400 bg-red-50" : "border-red-200";
  if (s === "high")
    return unread ? "border-amber-400 bg-amber-50" : "border-amber-200";
  if (unread) return "border-brand-primary bg-brand-accent/30";
  return "border-brand-line bg-white";
}

export function NotificationsList({ initial }: Props) {
  const supabase = React.useMemo(() => createClient(), []);
  const router = useRouter();
  const [items, setItems] = React.useState<ListNotification[]>(initial);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = React.useState<string>("all");

  // Realtime: keep the list in sync with new rows + read-state changes.
  React.useEffect(() => {
    let mounted = true;
    const channel = supabase
      .channel("notifications_list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "in_app_notifications" },
        (msg) => {
          if (!mounted) return;
          setItems((prev) =>
            [msg.new as ListNotification, ...prev].slice(0, 200),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "in_app_notifications" },
        (msg) => {
          if (!mounted) return;
          const updated = msg.new as ListNotification;
          setItems((prev) =>
            prev.map((i) => (i.id === updated.id ? updated : i)),
          );
        },
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const unreadCount = items.filter((i) => !i.read_at).length;

  const categories = React.useMemo(() => {
    const seen = new Map<string, { id: string; unread: number }>();
    for (const it of items) {
      const cur = seen.get(it.category_id) ?? { id: it.category_id, unread: 0 };
      if (!it.read_at) cur.unread += 1;
      seen.set(it.category_id, cur);
    }
    return Array.from(seen.values());
  }, [items]);

  const visible =
    activeTab === "all"
      ? items
      : items.filter((i) => i.category_id === activeTab);

  async function markRead(id: string) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id && !i.read_at
          ? { ...i, read_at: new Date().toISOString() }
          : i,
      ),
    );
    await supabase
      .from("in_app_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
  }

  async function markAllRead() {
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((i) => (i.read_at ? i : { ...i, read_at: now })),
    );
    await supabase
      .from("in_app_notifications")
      .update({ read_at: now })
      .is("read_at", null);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onLinkClick(n: ListNotification) {
    if (!n.read_at) void markRead(n.id);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="text-sm text-brand-mute">
          {items.length} total
          {unreadCount > 0 ? ` · ${unreadCount} unread` : null}
        </div>
        {unreadCount > 0 ? (
          <Button variant="outline" size="sm" onClick={() => markAllRead()}>
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            Mark all read
          </Button>
        ) : null}
      </header>

      {categories.length > 1 ? (
        <nav className="flex flex-wrap gap-1.5">
          <TabChip
            active={activeTab === "all"}
            onClick={() => setActiveTab("all")}
            label="All"
            count={items.length || undefined}
          />
          {categories.map((c) => (
            <TabChip
              key={c.id}
              active={activeTab === c.id}
              onClick={() => setActiveTab(c.id)}
              label={prettify(c.id)}
              count={c.unread > 0 ? c.unread : undefined}
            />
          ))}
        </nav>
      ) : null}

      {visible.length === 0 ? (
        <div className="rounded-card border border-brand-line bg-white px-6 py-12 text-center">
          <Bell className="mx-auto mb-2 h-6 w-6 text-brand-mute" />
          <div className="text-sm font-medium text-brand-ink">
            You&apos;re all caught up
          </div>
          <div className="mt-1 text-xs text-brand-mute">
            {activeTab === "all"
              ? "New activity will show up here as it happens."
              : `Nothing in ${prettify(activeTab)} yet.`}
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((n) => {
            const unread = !n.read_at;
            const isExpanded = expanded.has(n.id);
            const isBroadcast = n.category_id === "admin_broadcasts";
            const truncated = (n.body?.length ?? 0) > 140;
            return (
              <li
                key={n.id}
                className={`rounded-card border p-4 shadow-card transition-colors ${severityBorder(
                  n.severity,
                  unread,
                )}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      unread
                        ? n.severity === "critical"
                          ? "bg-red-600"
                          : n.severity === "high"
                            ? "bg-amber-500"
                            : "bg-brand-primary"
                        : "bg-transparent"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-brand-ink">
                        {n.title}
                      </div>
                      <Badge className="border-0 bg-brand-light text-[10px] uppercase tracking-wide text-brand-mute">
                        {prettify(n.category_id)}
                      </Badge>
                      {isBroadcast ? (
                        <span className="inline-flex items-center rounded-full bg-brand-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-primary">
                          📢 Announcement
                        </span>
                      ) : null}
                    </div>
                    {n.body ? (
                      <p
                        className={`mt-1 whitespace-pre-wrap text-sm text-brand-mute ${
                          !isExpanded && truncated ? "line-clamp-2" : ""
                        }`}
                      >
                        {n.body}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-brand-mute">
                        {timeAgo(n.created_at)}
                      </span>
                      {n.link ? (
                        <button
                          type="button"
                          onClick={() => onLinkClick(n)}
                          className="font-medium text-brand-primary hover:underline"
                        >
                          Open →
                        </button>
                      ) : null}
                      {truncated ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(n.id)}
                          className="inline-flex items-center gap-1 text-brand-mute hover:text-brand-ink"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3 w-3" /> Collapse
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3" /> Expand
                            </>
                          )}
                        </button>
                      ) : null}
                      {unread ? (
                        <button
                          type="button"
                          onClick={() => markRead(n.id)}
                          className="text-brand-mute hover:text-brand-ink"
                        >
                          Mark read
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TabChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-brand-primary text-white"
          : "bg-brand-light text-brand-mute hover:bg-brand-accent hover:text-brand-ink"
      }`}
    >
      <span>{label}</span>
      {count !== undefined ? (
        <span
          className={`rounded-full px-1 text-[10px] font-bold ${
            active
              ? "bg-white text-brand-primary"
              : "bg-brand-primary text-white"
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
