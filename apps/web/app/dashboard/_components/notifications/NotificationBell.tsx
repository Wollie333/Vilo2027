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

export function NotificationBell() {
  const { items, unreadCount, loading, markRead, markAllRead } =
    useNotifications();
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

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
        className="w-[22rem] max-w-[calc(100vw-2rem)] p-0"
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

        <div className="max-h-[60vh] overflow-y-auto py-1">
          {loading ? (
            <div className="p-6 text-center text-xs text-brand-mute">
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="mx-auto mb-2 h-6 w-6 text-brand-mute" />
              <div className="text-sm font-medium text-brand-ink">
                You&apos;re all caught up
              </div>
              <div className="mt-1 text-[11px] text-brand-mute">
                New activity on your bookings, refunds, and reviews will show up
                here.
              </div>
            </div>
          ) : (
            items.map((n) => {
              const Element: React.ElementType = n.link ? "button" : "div";
              const props = n.link
                ? { type: "button" as const, onClick: () => onItemClick(n) }
                : {};
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
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      n.read_at ? "bg-transparent" : "bg-brand-primary"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-brand-ink">
                      {n.title}
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
