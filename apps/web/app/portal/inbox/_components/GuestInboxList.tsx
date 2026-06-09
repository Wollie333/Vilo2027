"use client";

import { CheckCheck, MessageSquare, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

export type GuestConvRow = {
  id: string;
  status: string;
  isEnquiry: boolean;
  unread: number;
  preview: string | null;
  lastAt: string | null;
  listingName: string | null;
  hostName: string;
  hostAvatarUrl: string | null;
};

type Filter = "all" | "unread" | "enquiries";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "enquiries", label: "Enquiries" },
];

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

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "H"
  );
}

export function GuestInboxList({
  conversations,
}: {
  conversations: GuestConvRow[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const pathname = usePathname();
  const activeId = pathname?.startsWith("/portal/inbox/")
    ? (pathname.split("/")[3] ?? null)
    : null;

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "unread" && c.unread === 0) return false;
      if (filter === "enquiries" && !c.isEnquiry) return false;
      if (
        query &&
        !`${c.hostName} ${c.preview ?? ""} ${c.listingName ?? ""}`
          .toLowerCase()
          .includes(query)
      )
        return false;
      return true;
    });
  }, [conversations, filter, q]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {/* Header: title + search + filter chips */}
      <div className="shrink-0 border-b border-brand-line px-4 pb-2.5 pt-4">
        <h1 className="font-display text-[19px] font-extrabold text-brand-ink">
          Messages
        </h1>
        <div className="mt-2.5 flex h-10 items-center gap-2.5 rounded-pill border border-transparent bg-[#F4F8F5] px-3.5 transition focus-within:border-brand-primary focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(16,185,129,.1)]">
          <Search className="h-4 w-4 text-brand-mute" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search conversations"
            className="flex-1 bg-transparent text-[13.5px] text-brand-ink outline-none placeholder:text-brand-mute"
          />
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
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
      </div>

      {/* Rows */}
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
              <MessageSquare className="h-6 w-6" />
            </div>
            <p className="text-[13px] text-brand-mute">
              {conversations.length === 0
                ? "No conversations yet — message a host from any listing."
                : "No conversations match."}
            </p>
          </div>
        ) : (
          shown.map((c) => {
            const unread = c.unread > 0;
            const active = c.id === activeId;
            return (
              <Link
                key={c.id}
                href={`/portal/inbox/${c.id}`}
                className={`flex gap-3 border-l-[3px] px-4 py-3 transition ${
                  active
                    ? "border-l-brand-primary bg-[#F0FDF4]"
                    : unread
                      ? "border-l-brand-primary bg-[#F0FDF4]/60 hover:bg-[#F0FDF4]"
                      : "border-l-transparent hover:bg-[#F7FBF8]"
                }`}
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full">
                  {c.hostAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.hostAvatarUrl}
                      alt={c.hostName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-brand-secondary text-[14px] font-bold text-white">
                      {initialsOf(c.hostName)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`flex-1 truncate text-[14.5px] ${
                        unread
                          ? "font-bold text-brand-ink"
                          : "font-semibold text-[#1E3A2E]"
                      }`}
                    >
                      {c.hostName}
                    </span>
                    <span
                      className={`shrink-0 font-mono text-[11.5px] ${
                        unread
                          ? "font-semibold text-brand-primary"
                          : "text-[#8AA89C]"
                      }`}
                    >
                      {fmtRelative(c.lastAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    {c.isEnquiry ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-[#FCE9B6] bg-[#FFFBEB] px-2 py-0.5 text-[10.5px] font-semibold text-[#B45309]">
                        <span className="h-1.5 w-1.5 rounded-full bg-status-pending" />
                        Enquiry
                      </span>
                    ) : c.listingName ? (
                      <span className="inline-flex shrink-0 items-center rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10.5px] font-medium text-brand-mute">
                        {c.listingName}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`flex-1 truncate text-[13px] ${
                        unread ? "text-[#3F6155]" : "text-[#7C9B8F]"
                      }`}
                    >
                      {c.preview ?? "No messages yet."}
                    </span>
                    {unread ? (
                      <span className="flex h-[19px] min-w-[19px] shrink-0 items-center justify-center rounded-pill bg-brand-primary px-1.5 font-mono text-[11px] font-bold text-white">
                        {c.unread}
                      </span>
                    ) : (
                      <CheckCheck className="h-[15px] w-[15px] shrink-0 text-[#B7CDC1]" />
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
