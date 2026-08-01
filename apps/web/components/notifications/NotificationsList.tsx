"use client";

import {
  ArrowRight,
  BellOff,
  Calendar,
  Check,
  CheckCheck,
  CreditCard,
  FileText,
  type LucideIcon,
  Megaphone,
  MessageSquare,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { SupportAccessRequestModal } from "@/components/notifications/SupportAccessRequestModal";
import { createClient } from "@/lib/supabase/client";

// A support-access request notification opens a decide-popup instead of
// navigating; the grant id lives on the payload.
function grantIdOf(n: {
  kind: string;
  payload: Record<string, unknown> | null;
}) {
  if (n.kind !== "support_access_request") return null;
  const id = n.payload?.grant_id;
  return typeof id === "string" ? id : null;
}

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

// Visual buckets — the 11 DB categories collapse into these display groups, each
// with its own icon + tint (ported from the founder's Notifications design). An
// unknown category falls back to "system" so a new category still renders.
type Bucket = {
  key: string;
  label: string;
  Icon: LucideIcon;
  bg: string;
  fg: string;
};
const BUCKETS: Record<string, Bucket> = {
  bookings: {
    key: "bookings",
    label: "Bookings",
    Icon: Calendar,
    bg: "#ECFDF5",
    fg: "#047857",
  },
  quote: {
    key: "quote",
    label: "Quote requests",
    Icon: FileText,
    bg: "#ECFAFF",
    fg: "#0369A1",
  },
  message: {
    key: "message",
    label: "Messages",
    Icon: MessageSquare,
    bg: "#EEF0FF",
    fg: "#4F46E5",
  },
  payment: {
    key: "payment",
    label: "Payments",
    Icon: CreditCard,
    bg: "#FFFBEB",
    fg: "#B45309",
  },
  review: {
    key: "review",
    label: "Reviews",
    Icon: Star,
    bg: "#FEF9EC",
    fg: "#A16207",
  },
  system: {
    key: "system",
    label: "System",
    Icon: ShieldCheck,
    bg: "#F4F7F5",
    fg: "#5B7065",
  },
  announcement: {
    key: "announcement",
    label: "Announcements",
    Icon: Megaphone,
    bg: "#F0FDF4",
    fg: "#064E3B",
  },
  looking: {
    key: "looking",
    label: "Looking for",
    Icon: Search,
    bg: "#FDF2F8",
    fg: "#9D174D",
  },
};
const BUCKET_ORDER = [
  "bookings",
  "quote",
  "message",
  "payment",
  "review",
  "system",
  "announcement",
  "looking",
];
const CATEGORY_TO_BUCKET: Record<string, string> = {
  bookings: "bookings",
  quote_requests: "quote",
  messages: "message",
  payments_refunds: "payment",
  reviews: "review",
  calendar_sync: "system",
  subscription: "system",
  account_security: "system",
  admin_broadcasts: "announcement",
  marketing_tips: "announcement",
  looking_for: "looking",
};
function bucketOf(categoryId: string): Bucket {
  return BUCKETS[CATEGORY_TO_BUCKET[categoryId] ?? "system"] ?? BUCKETS.system!;
}

// Time buckets for the grouped feed.
const GROUP_ORDER = ["Today", "Yesterday", "Earlier this week", "Older"];
function timeGroup(iso: string): string {
  const t = new Date(iso).getTime();
  const now = new Date();
  const startToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  if (t >= startToday) return "Today";
  if (t >= startToday - 86_400_000) return "Yesterday";
  if (t >= startToday - 7 * 86_400_000) return "Earlier this week";
  return "Older";
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
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

export function NotificationsList({ initial }: Props) {
  const supabase = React.useMemo(() => createClient(), []);
  const router = useRouter();
  const [items, setItems] = React.useState<ListNotification[]>(initial);
  const [activeCat, setActiveCat] = React.useState<string>("all");
  const [mode, setMode] = React.useState<"all" | "unread">("all");
  const [accessReq, setAccessReq] = React.useState<{
    grantId: string;
    title: string;
    body: string | null;
  } | null>(null);

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

  // Per-bucket totals for the filter chips (only buckets with items show).
  const bucketCounts = React.useMemo(() => {
    const c = new Map<string, number>();
    for (const it of items) {
      const k = bucketOf(it.category_id).key;
      c.set(k, (c.get(k) ?? 0) + 1);
    }
    return c;
  }, [items]);

  const visible = items.filter(
    (i) =>
      (activeCat === "all" || bucketOf(i.category_id).key === activeCat) &&
      (mode === "all" || !i.read_at),
  );

  // Group the visible items by time bucket, preserving GROUP_ORDER.
  const grouped = React.useMemo(() => {
    const byGroup = new Map<string, ListNotification[]>();
    for (const n of visible) {
      const g = timeGroup(n.created_at);
      const arr = byGroup.get(g) ?? [];
      arr.push(n);
      byGroup.set(g, arr);
    }
    return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
      name: g,
      items: byGroup.get(g)!,
    }));
  }, [visible]);

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

  function onRowClick(n: ListNotification) {
    if (!n.read_at) void markRead(n.id);
    // Support-access requests open a decide-popup (Accept / Decline / Report)
    // instead of navigating to the settings page.
    const grantId = grantIdOf(n);
    if (grantId) {
      setAccessReq({ grantId, title: n.title, body: n.body });
      return;
    }
    if (n.link) router.push(n.link);
  }

  return (
    <div className="space-y-5">
      {/* Sub-header: counts + read filter + mark-all */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="num text-[12.5px] text-brand-mute">
          {items.length} total
          {unreadCount > 0 ? ` · ${unreadCount} unread` : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded-full border border-brand-line bg-brand-light p-0.5 text-[12px] font-semibold">
            <button
              type="button"
              onClick={() => setMode("all")}
              className={`rounded-full px-3 py-1.5 transition ${
                mode === "all"
                  ? "bg-white text-brand-secondary shadow-sm"
                  : "text-brand-mute hover:text-brand-ink"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setMode("unread")}
              className={`rounded-full px-3 py-1.5 transition ${
                mode === "unread"
                  ? "bg-white text-brand-secondary shadow-sm"
                  : "text-brand-mute hover:text-brand-ink"
              }`}
            >
              Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
            </button>
          </div>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => markAllRead()}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-brand-line bg-white px-3.5 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
            >
              <CheckCheck className="h-4 w-4 text-brand-primary" />
              Mark all read
            </button>
          ) : null}
        </div>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <CatChip
          active={activeCat === "all"}
          onClick={() => setActiveCat("all")}
          label="All"
          count={items.length}
        />
        {BUCKET_ORDER.map((k) => {
          const n = bucketCounts.get(k) ?? 0;
          if (n === 0) return null;
          return (
            <CatChip
              key={k}
              active={activeCat === k}
              onClick={() => setActiveCat(k)}
              label={BUCKETS[k]!.label}
              count={n}
            />
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-card border border-brand-line bg-white px-8 py-16 text-center shadow-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
            <BellOff className="h-5 w-5 text-brand-mute" />
          </div>
          <div className="mt-4 font-display text-[15px] font-bold text-brand-ink">
            You&apos;re all caught up
          </div>
          <div className="mt-1 text-[13px] text-brand-mute">
            {mode === "unread"
              ? "No unread notifications."
              : activeCat === "all"
                ? "New activity will show up here as it happens."
                : "Nothing here matches this filter."}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <section key={g.name}>
              <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                {g.name}
              </div>
              <div className="divide-y divide-brand-line overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
                {g.items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    onClick={() => onRowClick(n)}
                    onMarkRead={() => markRead(n.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <SupportAccessRequestModal
        open={!!accessReq}
        grantId={accessReq?.grantId ?? null}
        title={accessReq?.title}
        body={accessReq?.body}
        onOpenChange={(v) => {
          if (!v) setAccessReq(null);
        }}
      />
    </div>
  );
}

function NotificationRow({
  n,
  onClick,
  onMarkRead,
}: {
  n: ListNotification;
  onClick: () => void;
  onMarkRead: () => void;
}) {
  const unread = !n.read_at;
  const bucket = bucketOf(n.category_id);
  const Icon = bucket.Icon;
  const actionable = Boolean(n.link) || n.kind === "support_access_request";

  return (
    <div
      onClick={onClick}
      className={`group relative flex items-start gap-3.5 px-4 py-3.5 transition ${
        actionable ? "cursor-pointer" : ""
      } ${unread ? "bg-[#F7FCF9] hover:bg-[#F0FAF4]" : "hover:bg-[#FAFCFB]"}`}
    >
      {unread ? (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px] rounded-r-[3px] bg-brand-primary"
        />
      ) : null}
      <span
        className="mt-0.5 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px]"
        style={{ background: bucket.bg, color: bucket.fg }}
      >
        <Icon className="h-[17px] w-[17px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`truncate text-[14px] ${
              unread ? "font-bold text-brand-ink" : "font-medium text-[#3A5A4E]"
            }`}
          >
            {n.title}
          </span>
          <span className="num ml-auto shrink-0 text-[12px] text-brand-mute">
            {timeAgo(n.created_at)}
          </span>
        </div>
        {n.body ? (
          <div className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[13px] leading-snug text-brand-mute">
            {n.body}
          </div>
        ) : null}
        {actionable ? (
          <div className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-primary">
            {n.kind === "support_access_request" ? "Review request" : "View"}
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        ) : null}
      </div>
      {unread ? (
        <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            title="Mark as read"
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead();
            }}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-transparent text-brand-mute transition hover:border-brand-line hover:bg-white hover:text-brand-secondary"
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CatChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 text-[12.5px] font-semibold transition ${
        active
          ? "border-brand-secondary bg-brand-secondary text-white"
          : "border-brand-line bg-white text-brand-mute hover:bg-brand-light hover:text-brand-ink"
      }`}
      style={{ height: 32 }}
    >
      {label}
      <span
        className={`num rounded-full px-1.5 py-px text-[11px] font-bold ${
          active
            ? "bg-white/20 text-brand-accent"
            : "bg-brand-light text-brand-mute"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
