"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { useNotifications, type AppNotification } from "./useNotifications";

// Human labels for the in-dropdown category tabs. Falls back to the raw
// id (e.g. "marketing_tips" → "Marketing tips") if a category isn't
// listed here, so new categories work without a code change.
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

function dotClass(
  severity: AppNotification["severity"],
  read: boolean,
): string {
  if (read) return "bg-transparent";
  if (severity === "critical") return "bg-red-600";
  if (severity === "high") return "bg-amber-500";
  return "bg-brand-primary";
}

export function NotificationBell() {
  const { items, categories, unreadCount, loading, markRead, markAllRead } =
    useNotifications();
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<string>("all");
  const router = useRouter();

  const visibleItems =
    activeTab === "all"
      ? items
      : items.filter((i) => i.category_id === activeTab);

  const onItemClick = async (n: AppNotification) => {
    if (!n.read_at) await markRead(n.id);
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            unreadCount > 0
              ? `Notifications (${unreadCount} unread)`
              : "Notifications"
          }
          className="relative inline-flex h-9 w-9 items-center justify-center rounded border border-brand-line bg-white text-brand-ink hover:bg-brand-light"
        >
          <span className="relative inline-flex">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 ? (
              <span
                aria-hidden
                className="absolute -right-[2px] -top-[2px] h-2 w-2 rounded-full bg-status-cancelled ring-2 ring-white"
              />
            ) : null}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[24rem] max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="flex items-center justify-between border-b border-brand-line px-3 py-2">
          <div className="text-sm font-semibold text-brand-ink">
            Notifications
            {unreadCount > 0 ? (
              <span className="ml-2 rounded-full bg-brand-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            ) : null}
          </div>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => markAllRead()}
              className="flex items-center gap-1 text-[11px] font-medium text-brand-primary hover:underline"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          ) : null}
        </div>

        {categories.length > 1 ? (
          <div className="flex gap-1 overflow-x-auto border-b border-brand-line px-2 py-1.5">
            <TabButton
              active={activeTab === "all"}
              onClick={() => setActiveTab("all")}
              label="All"
              count={unreadCount > 0 ? unreadCount : undefined}
            />
            {categories.map((c) => (
              <TabButton
                key={c.id}
                active={activeTab === c.id}
                onClick={() => setActiveTab(c.id)}
                label={prettify(c.id)}
                count={c.unread > 0 ? c.unread : undefined}
              />
            ))}
          </div>
        ) : null}

        <div className="max-h-[60vh] overflow-y-auto py-1">
          {loading ? (
            <div className="p-6 text-center text-xs text-brand-mute">
              Loading…
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="mx-auto mb-2 h-6 w-6 text-brand-mute" />
              <div className="text-sm font-medium text-brand-ink">
                You&apos;re all caught up
              </div>
              <div className="mt-1 text-[11px] text-brand-mute">
                {activeTab === "all"
                  ? "New activity on your bookings, refunds, and reviews will show up here."
                  : `No ${prettify(activeTab).toLowerCase()} notifications yet.`}
              </div>
            </div>
          ) : (
            visibleItems.map((n) => {
              const Element: React.ElementType = n.link ? "button" : "div";
              const props = n.link
                ? { type: "button" as const, onClick: () => onItemClick(n) }
                : {};
              const isBroadcast = n.category_id === "admin_broadcasts";
              return (
                <Element
                  key={n.id}
                  {...props}
                  className={`flex w-full items-start gap-3 px-3 py-2 text-left ${
                    n.link ? "hover:bg-brand-light" : ""
                  } ${!n.read_at ? "bg-brand-accent/30" : ""}`}
                >
                  <span
                    aria-hidden
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotClass(
                      n.severity,
                      Boolean(n.read_at),
                    )}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-brand-ink">
                        {n.title}
                      </div>
                      {isBroadcast ? (
                        <span className="inline-flex items-center rounded-full bg-brand-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-primary">
                          📢 Announcement
                        </span>
                      ) : null}
                    </div>
                    {n.body ? (
                      <div className="mt-0.5 text-[12px] text-brand-mute">
                        {n.body}
                      </div>
                    ) : null}
                    <div className="mt-1 text-[10px] text-brand-mute">
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                </Element>
              );
            })
          )}
        </div>

        <div className="border-t border-brand-line px-3 py-2 text-center">
          <Link
            href="/dashboard/inbox"
            onClick={() => setOpen(false)}
            className="text-[11px] font-medium text-brand-primary hover:underline"
          >
            View all activity →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TabButton({
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
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? "bg-brand-primary text-white"
          : "bg-brand-light text-brand-mute hover:bg-brand-accent hover:text-brand-ink"
      }`}
    >
      <span>{label}</span>
      {count !== undefined ? (
        <span
          className={`rounded-full px-1 text-[9px] font-bold ${
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
