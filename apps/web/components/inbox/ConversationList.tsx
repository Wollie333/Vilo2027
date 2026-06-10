"use client";

import { CheckCheck, MessageSquare, Search } from "lucide-react";
import Link from "next/link";

import { InboxAvatar } from "./InboxAvatar";

// Canonical conversation list — the left pane of the two-pane message centre,
// shared by the host inbox and the guest portal. `ConversationList` owns the
// header (title + search + filter chips); callers map their rows to
// `ConversationRow`. Keeping both here means the list looks identical in both
// apps from one source.

export type ChatChipTone = "amber" | "green" | "red" | "indigo" | "neutral";

const CHIP_TONES: Record<ChatChipTone, string> = {
  amber: "border-[#FCE9B6] bg-[#FFFBEB] text-[#B45309]",
  green: "border-[#C7F0DC] bg-[#ECFDF5] text-[#047857]",
  red: "border-[#FBD5D5] bg-[#FEF2F2] text-[#DC2626]",
  indigo: "border-[#D7DBFB] bg-[#EEF0FF] text-[#4F46E5]",
  neutral: "border-brand-line bg-brand-light text-brand-mute",
};

const CHIP_DOTS: Record<ChatChipTone, string> = {
  amber: "bg-status-pending",
  green: "bg-[#10B981]",
  red: "bg-[#EF4444]",
  indigo: "bg-[#6366F1]",
  neutral: "",
};

function fmtRelative(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24)
    return d.toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  const days = Math.floor(hours / 24);
  if (days < 7) return d.toLocaleDateString("en-ZA", { weekday: "short" });
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

export function ConversationList<F extends string>({
  title,
  search,
  onSearchChange,
  searchPlaceholder = "Search conversations",
  filters,
  activeFilter,
  onFilterChange,
  extraHeader,
  children,
  isEmpty,
  emptyText,
}: {
  title: string;
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  filters: { key: F; label: string }[];
  activeFilter: F;
  onFilterChange: (f: F) => void;
  extraHeader?: React.ReactNode;
  children: React.ReactNode;
  isEmpty: boolean;
  emptyText: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="shrink-0 border-b border-brand-line px-4 pb-2.5 pt-4">
        <h1 className="font-display text-[19px] font-extrabold text-brand-ink">
          {title}
        </h1>
        <div className="mt-2.5 flex h-10 items-center gap-2.5 rounded-pill border border-transparent bg-[#F4F8F5] px-3.5 transition focus-within:border-brand-primary focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(16,185,129,.1)]">
          <Search className="h-4 w-4 text-brand-mute" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-[13.5px] text-brand-ink outline-none placeholder:text-brand-mute"
          />
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto">
          {filters.map((f) => {
            const on = activeFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onFilterChange(f.key)}
                className={`shrink-0 rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold transition ${
                  on
                    ? "border-brand-primary bg-brand-accent text-brand-secondary"
                    : "border-brand-line bg-white text-[#2C4A3C] hover:bg-brand-light/60"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        {extraHeader}
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
              <MessageSquare className="h-6 w-6" />
            </div>
            <p className="text-[13px] text-brand-mute">{emptyText}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function ConversationRow({
  href,
  active,
  name,
  avatarUrl = null,
  tintClass,
  chip,
  listingName,
  preview,
  lastAt,
  unread,
}: {
  href: string;
  active: boolean;
  name: string;
  avatarUrl?: string | null;
  tintClass?: string;
  chip?: { label: string; tone: ChatChipTone } | null;
  listingName?: string | null;
  preview: string | null;
  lastAt: string | null;
  unread: number;
}) {
  const isUnread = unread > 0;
  return (
    <Link
      href={href}
      className={`flex gap-3 border-l-[3px] px-4 py-3 transition ${
        active
          ? "border-l-brand-primary bg-[#F0FDF4]"
          : isUnread
            ? "border-l-brand-primary bg-[#F0FDF4]/60 hover:bg-[#F0FDF4]"
            : "border-l-transparent hover:bg-[#F7FBF8]"
      }`}
    >
      <InboxAvatar
        name={name}
        imageUrl={avatarUrl}
        size={48}
        tintClass={tintClass ?? "bg-brand-secondary text-white"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className={`flex-1 truncate text-[14.5px] ${
              isUnread
                ? "font-bold text-brand-ink"
                : "font-semibold text-[#1E3A2E]"
            }`}
          >
            {name}
          </span>
          <span
            className={`shrink-0 font-mono text-[11.5px] ${
              isUnread ? "font-semibold text-brand-primary" : "text-[#8AA89C]"
            }`}
          >
            {fmtRelative(lastAt)}
          </span>
        </div>
        {chip || listingName ? (
          <div className="mt-1 flex items-center gap-1.5">
            {chip ? (
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-pill border px-2 py-0.5 text-[10.5px] font-semibold ${CHIP_TONES[chip.tone]}`}
              >
                {CHIP_DOTS[chip.tone] ? (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${CHIP_DOTS[chip.tone]}`}
                  />
                ) : null}
                {chip.label}
              </span>
            ) : listingName ? (
              <span className="inline-flex shrink-0 items-center rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10.5px] font-medium text-brand-mute">
                {listingName}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`flex-1 truncate text-[13px] ${
              isUnread ? "text-[#3F6155]" : "text-[#7C9B8F]"
            }`}
          >
            {preview ?? "No messages yet."}
          </span>
          {isUnread ? (
            <span className="flex h-[19px] min-w-[19px] shrink-0 items-center justify-center rounded-pill bg-brand-primary px-1.5 font-mono text-[11px] font-bold text-white">
              {unread}
            </span>
          ) : (
            <CheckCheck className="h-[15px] w-[15px] shrink-0 text-[#B7CDC1]" />
          )}
        </div>
      </div>
    </Link>
  );
}
