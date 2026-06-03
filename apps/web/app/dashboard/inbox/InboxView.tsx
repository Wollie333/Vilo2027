"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarCheck,
  CheckCheck,
  ClipboardList,
  ExternalLink,
  Inbox as InboxIcon,
  KeyRound,
  Link as LinkIcon,
  MessageCircleQuestion,
  MoreHorizontal,
  Paperclip,
  PenSquare,
  Phone,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  Search,
  SendHorizontal,
  Smile,
  Sparkles,
  Star,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

import {
  archiveConversationAction,
  markConversationReadAction,
  sendMessageAction,
  unarchiveConversationAction,
} from "./actions";
import { PipelineControl } from "./PipelineControl";

export type ConversationRow = {
  id: string;
  status: "open" | "resolved" | "archived";
  isEnquiry: boolean;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
  guestId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  listingName: string | null;
  bookingReference: string | null;
  bookingStatus: string | null;
  checkIn: string | null;
  checkOut: string | null;
};

export type MessageRow = {
  id: string;
  senderId: string | null;
  body: string | null;
  attachmentUrl: string | null;
  attachmentType: "image" | "pdf" | "other" | null;
  attachmentFilename: string | null;
  isSystem: boolean;
  systemEvent: string | null;
  readByHost: boolean;
  createdAt: string;
};

export type ThreadContext = {
  conversationId: string;
  status: "open" | "resolved" | "archived";
  isEnquiry: boolean;
  createdAt: string;
  guest: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
  } | null;
  listing: { id: string; name: string; slug: string | null } | null;
  booking: {
    id: string;
    reference: string;
    status: string;
    checkIn: string | null;
    checkOut: string | null;
    nights: number | null;
    guests: number | null;
    total: number | null;
    currency: string;
  } | null;
  pipelineStage: PipelineStage | null;
  quote: {
    id: string;
    status: string;
    quoteNumber: string | null;
    total: number;
    currency: string;
  } | null;
};

export type TemplateRow = { id: string; title: string; body: string };

export type Counts = {
  all: number;
  unread: number;
  enquiries: number;
  open: number;
  archived: number;
  unread_total: number;
  pipeline: {
    new_quote: number;
    quote_sent: number;
    negotiating: number;
    accepted: number;
    declined: number;
    lost: number;
  };
};

type PipelineStage =
  | "new_quote"
  | "quote_sent"
  | "negotiating"
  | "accepted"
  | "declined"
  | "lost";
type Folder =
  | "all"
  | "unread"
  | "enquiries"
  | "open"
  | "archived"
  | PipelineStage;

const FOLDERS: {
  key: Exclude<Folder, PipelineStage>;
  label: string;
  icon: typeof InboxIcon;
}[] = [
  { key: "all", label: "All inbox", icon: InboxIcon },
  { key: "unread", label: "Unread", icon: MessageCircleQuestion },
  { key: "enquiries", label: "Enquiries", icon: MessageCircleQuestion },
  { key: "open", label: "Open", icon: KeyRound },
  { key: "archived", label: "Archived", icon: Archive },
];

const PIPELINE: { key: PipelineStage; label: string; dot: string }[] = [
  { key: "new_quote", label: "New quote", dot: "bg-status-pending" },
  { key: "quote_sent", label: "Quote sent", dot: "bg-brand-primary" },
  { key: "negotiating", label: "Negotiating", dot: "bg-status-completed" },
  { key: "accepted", label: "Accepted", dot: "bg-status-confirmed" },
  { key: "declined", label: "Declined", dot: "bg-status-cancelled" },
  { key: "lost", label: "Lost", dot: "bg-brand-mute" },
];

function initialsFrom(name: string | null, email: string | null): string {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+|@|\./).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (today.getTime() - that.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) {
    return `Today · ${d.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "short" })}`;
  }
  if (diffDays === 1) {
    return `Yesterday · ${d.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "short" })}`;
  }
  return d.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: diffDays > 365 ? "numeric" : undefined,
  });
}

function fmtZAR(amount: number | null, currency: string): string {
  if (amount == null) return "—";
  const symbol = currency === "ZAR" ? "R " : "";
  return `${symbol}${Math.round(amount).toLocaleString("en-ZA").replace(/,/g, " ")}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function InboxView({
  hostInitials,
  hostName,
  folder,
  counts,
  search,
  conversations,
  selectedId,
  messages,
  context,
}: {
  hostInitials: string;
  hostName: string;
  folder: Folder;
  counts: Counts;
  search: string;
  conversations: ConversationRow[];
  selectedId: string | null;
  messages: MessageRow[];
  context: ThreadContext | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [showPaneMobile, setShowPaneMobile] = useState(false);
  const [foldersHidden, setFoldersHidden] = useState(false);
  const [searchInput, setSearchInput] = useState(search);

  // Persist the folder-rail visibility preference across visits.
  useEffect(() => {
    if (localStorage.getItem("vilo:inbox:foldersHidden") === "1") {
      setFoldersHidden(true);
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("vilo:inbox:foldersHidden", foldersHidden ? "1" : "0");
  }, [foldersHidden]);

  // Mark selected conversation as read on mount/selection change.
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId) return;
    if (markedRef.current === selectedId) return;
    const sel = conversations.find((c) => c.id === selectedId);
    if (!sel || sel.unreadCount === 0) {
      markedRef.current = selectedId;
      return;
    }
    markedRef.current = selectedId;
    void markConversationReadAction(selectedId).then((r) => {
      if (!r.ok) toast.error(r.error);
    });
  }, [selectedId, conversations]);

  // Auto-scroll the thread to the bottom when messages change.
  const threadRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages.length, selectedId]);

  // Realtime: refresh on any messages/conversations change the host can see.
  // RLS filters server-side; we just need a soft refresh whenever something
  // moves. router.refresh() re-runs the server component without a full
  // navigation, so derived counts and the selected thread both update.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("inbox-host")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations" },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const navigateWith = useCallback(
    (next: Partial<Record<"c" | "f" | "q", string | null>>) => {
      const u = new URLSearchParams(params?.toString() ?? "");
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === "") u.delete(k);
        else u.set(k, v);
      }
      router.push(`/dashboard/inbox?${u.toString()}`);
    },
    [params, router],
  );

  // Debounce search input → URL.
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => {
      navigateWith({ q: searchInput.trim() || null });
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput, search, navigateWith]);

  const groups = useMemo(() => groupByDay(conversations), [conversations]);
  const messageDays = useMemo(() => groupMessagesByDay(messages), [messages]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-white">
      {/* ── Folders rail (only xl+, when not hidden) ────────── */}
      <aside
        className={`hidden w-56 shrink-0 flex-col overflow-y-auto border-r border-brand-line bg-white ${
          foldersHidden ? "" : "xl:flex"
        }`}
      >
        <div className="px-4 pb-3 pt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
              Folders
            </span>
            <button
              type="button"
              onClick={() => setFoldersHidden(true)}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-brand-mute hover:bg-brand-light hover:text-brand-ink"
              title="Hide folders"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-0.5">
            {FOLDERS.map((f) => {
              const Icon = f.icon;
              const active = folder === f.key;
              const count = counts[f.key as keyof Counts] as number | undefined;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => navigateWith({ f: f.key, c: null })}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-[13px] transition-colors ${
                    active
                      ? "bg-brand-accent font-semibold text-brand-secondary"
                      : "text-brand-ink hover:bg-brand-light"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-4 w-4" /> {f.label}
                  </span>
                  {count !== undefined && count > 0 ? (
                    <span
                      className={`num rounded-pill px-2 py-0.5 text-[10.5px] font-semibold ${
                        active
                          ? "bg-brand-secondary text-white"
                          : "border border-brand-line bg-white text-brand-mute"
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pipeline — sorts enquiry threads by deal stage */}
        <div className="border-t border-brand-line px-4 pb-3 pt-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Pipeline
          </div>
          <div className="space-y-0.5">
            {PIPELINE.map((p) => {
              const active = folder === p.key;
              const count = counts.pipeline?.[p.key] ?? 0;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => navigateWith({ f: p.key, c: null })}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-[13px] transition-colors ${
                    active
                      ? "bg-brand-accent font-semibold text-brand-secondary"
                      : "text-brand-ink hover:bg-brand-light"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${p.dot}`} />
                    {p.label}
                  </span>
                  {count > 0 ? (
                    <span
                      className={`num rounded-pill px-2 py-0.5 text-[10.5px] font-semibold ${
                        active
                          ? "bg-brand-secondary text-white"
                          : "border border-brand-line bg-white text-brand-mute"
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-auto border-t border-brand-line px-4 py-4">
          <div
            className="block rounded-card bg-brand-light p-3 opacity-70"
            aria-disabled="true"
            title="Coming soon"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-secondary">
                <Sparkles className="h-3.5 w-3.5" /> Quick replies
              </div>
              <span className="rounded-pill bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-mute">
                Soon
              </span>
            </div>
            <div className="mt-1 text-[11px] text-brand-mute">
              Save common replies once, reuse them everywhere.
            </div>
          </div>
        </div>
      </aside>

      {/* ── Conversation list ───────────────────────────────── */}
      <section
        className={`flex w-full min-w-0 shrink-0 flex-col border-r border-brand-line bg-white md:w-[360px] lg:w-[400px] ${
          selectedId ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="mid-head sticky top-0 z-10 border-b border-brand-line bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            {foldersHidden ? (
              <button
                type="button"
                onClick={() => setFoldersHidden(false)}
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded border border-brand-line bg-white text-brand-ink hover:bg-brand-light xl:inline-flex"
                title="Show folders"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            ) : null}
            <div className="flex h-9 flex-1 items-center gap-2 rounded border border-brand-line bg-brand-light/60 px-3 focus-within:border-brand-primary focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-primary/15">
              <Search className="h-4 w-4 text-brand-mute" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search guests, listings, refs…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-brand-mute"
              />
            </div>
          </div>

          {/* Folder chips (always visible — folder rail is xl+ only) */}
          <div className="thin-scroll mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {FOLDERS.map((f) => {
              const active = folder === f.key;
              const count = counts[f.key as keyof Counts] as number | undefined;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => navigateWith({ f: f.key, c: null })}
                  className={`shrink-0 rounded-pill px-3 py-1 text-[12px] transition-colors ${
                    active
                      ? "bg-brand-secondary font-semibold text-white"
                      : "border border-brand-line text-brand-ink hover:bg-brand-light"
                  }`}
                >
                  {f.label}
                  {count != null && count > 0 ? (
                    <span
                      className={`num ml-1.5 ${active ? "opacity-70" : "font-bold"}`}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <EmptyList folder={folder} search={search} />
          ) : (
            groups.map(({ label, items }) => (
              <div key={label}>
                <div className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                  {label}
                </div>
                {items.map((c) => (
                  <ConvRow
                    key={c.id}
                    conv={c}
                    selected={selectedId === c.id}
                    onSelect={() => navigateWith({ c: c.id })}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Thread view ─────────────────────────────────────── */}
      <section
        className={`flex min-w-0 flex-1 bg-white ${selectedId ? "flex" : "hidden md:flex"}`}
      >
        {!context ? (
          <EmptyThread hasAny={conversations.length > 0} />
        ) : (
          <>
            <div className="flex min-w-0 flex-1 flex-col">
              {/* Thread header */}
              <div className="flex shrink-0 items-center gap-3 border-b border-brand-line px-5 py-3">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded text-brand-ink hover:bg-brand-light md:hidden"
                  onClick={() => navigateWith({ c: null })}
                  title="Back to inbox"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <Avatar
                  initials={initialsFrom(
                    context.guest?.fullName ?? null,
                    context.guest?.email ?? null,
                  )}
                  size={40}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-display text-[15px] font-semibold text-brand-ink">
                      {context.guest?.fullName ||
                        context.guest?.email ||
                        "Guest"}
                    </div>
                    {context.isEnquiry ? (
                      <Pill tone="pending">Enquiry</Pill>
                    ) : null}
                    {context.status === "archived" ? (
                      <Pill tone="cancelled">Archived</Pill>
                    ) : null}
                  </div>
                  <div className="text-[12px] text-brand-mute">
                    {context.guest?.email ?? "—"}
                    {context.guest?.phone ? ` · ${context.guest.phone}` : ""}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  {context.guest?.phone ? (
                    <a
                      href={`tel:${context.guest.phone}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded border border-brand-line bg-white text-brand-ink hover:bg-brand-light"
                      title="Call"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded border border-brand-line bg-white text-brand-ink hover:bg-brand-light"
                    title="Star"
                  >
                    <Star className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r =
                          context.status === "archived"
                            ? await unarchiveConversationAction(
                                context.conversationId,
                              )
                            : await archiveConversationAction(
                                context.conversationId,
                              );
                        if (!r.ok) toast.error(r.error);
                        else {
                          toast.success(
                            context.status === "archived"
                              ? "Unarchived"
                              : "Archived",
                          );
                          if (context.status !== "archived") {
                            navigateWith({ c: null });
                          }
                        }
                      })
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded border border-brand-line bg-white text-brand-ink hover:bg-brand-light"
                    title={
                      context.status === "archived" ? "Unarchive" : "Archive"
                    }
                  >
                    {context.status === "archived" ? (
                      <ArchiveRestore className="h-4 w-4" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                  </button>
                  {context.booking ? (
                    <Link
                      href={`/dashboard/bookings/${context.booking.id}`}
                      className="hidden h-9 items-center justify-center gap-1.5 rounded border border-brand-line bg-white px-3 text-sm text-brand-ink hover:bg-brand-light md:inline-flex"
                    >
                      <User className="h-4 w-4" /> Booking
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded border border-brand-line bg-white text-brand-ink hover:bg-brand-light"
                    title="More"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPaneMobile((s) => !s)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded border border-brand-line bg-white text-brand-ink hover:bg-brand-light xl:hidden"
                    title="Show booking details"
                  >
                    <PanelRightOpen className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Booking summary banner */}
              {context.booking || context.listing ? (
                <div className="flex shrink-0 flex-wrap items-center gap-4 border-b border-brand-line bg-brand-light/60 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded bg-brand-accent text-brand-secondary">
                      <CalendarCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                        {context.isEnquiry ? "Enquiry for" : "Booking"}
                      </div>
                      <div className="text-sm font-semibold text-brand-ink">
                        {context.listing?.name ?? "—"}
                        {context.booking?.checkIn ? (
                          <>
                            {" · "}
                            {fmtDate(context.booking.checkIn)}
                            {" – "}
                            {fmtDate(context.booking.checkOut)}
                          </>
                        ) : null}
                        {context.booking?.guests ? (
                          <>
                            {" · "}
                            {context.booking.guests}{" "}
                            {context.booking.guests === 1 ? "guest" : "guests"}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {context.booking ? (
                    <div className="ml-auto hidden items-center gap-3 md:flex">
                      <div className="text-right">
                        <div className="text-[11px] text-brand-mute">Total</div>
                        <div className="num font-display text-base font-bold text-brand-ink">
                          {fmtZAR(
                            context.booking.total,
                            context.booking.currency,
                          )}
                        </div>
                      </div>
                      <Link
                        href={`/dashboard/bookings/${context.booking.id}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded border border-brand-line bg-white px-4 text-sm font-medium text-brand-ink hover:bg-brand-light"
                      >
                        Open booking
                      </Link>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Messages */}
              <div
                ref={threadRef}
                className="thin-scroll thread-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6"
              >
                {messages.length === 0 ? (
                  <div className="mx-auto max-w-md rounded-card border border-dashed border-brand-line bg-white p-8 text-center text-sm text-brand-mute">
                    No messages yet. Send the first reply below.
                  </div>
                ) : (
                  messageDays.map(({ label, items }) => (
                    <div key={label} className="space-y-5">
                      <div className="flex items-center gap-2.5 text-[11px] font-medium text-brand-mute">
                        <span className="h-px flex-1 bg-brand-line" />
                        <span>{label}</span>
                        <span className="h-px flex-1 bg-brand-line" />
                      </div>
                      {items.map((m) => (
                        <MessageBubble
                          key={m.id}
                          msg={m}
                          guestInitials={initialsFrom(
                            context.guest?.fullName ?? null,
                            context.guest?.email ?? null,
                          )}
                          hostInitials={hostInitials}
                        />
                      ))}
                    </div>
                  ))
                )}
              </div>

              {/* Composer */}
              <Composer
                conversationId={context.conversationId}
                hostName={hostName}
              />
            </div>

            {/* Context pane */}
            <BookingPane
              context={context}
              visibleOnMobile={showPaneMobile}
              onClose={() => setShowPaneMobile(false)}
            />
          </>
        )}
      </section>
    </div>
  );
}

// ── Conversation row ────────────────────────────────────────
function ConvRow({
  conv,
  selected,
  onSelect,
}: {
  conv: ConversationRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const unread = conv.unreadCount > 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex w-full gap-3 border-b border-[#ECF4EF] px-4 py-3.5 text-left transition-colors ${
        selected ? "bg-brand-accent" : "hover:bg-brand-light"
      }`}
    >
      {selected ? (
        <span className="absolute bottom-0 left-0 top-0 w-[3px] bg-brand-primary" />
      ) : null}
      <Avatar
        initials={initialsFrom(conv.guestName, conv.guestEmail)}
        size={40}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div
            className={`truncate text-sm ${
              unread ? "font-bold text-brand-ink" : "text-brand-ink"
            }`}
          >
            {conv.guestName || conv.guestEmail || "Guest"}
          </div>
          <div className="shrink-0 text-[11px] text-brand-mute">
            {relativeTime(conv.lastMessageAt ?? conv.createdAt)}
          </div>
        </div>
        <div className="mb-1.5 truncate text-[11px] text-brand-mute">
          {conv.listingName ?? "—"}
          {conv.checkIn ? ` · ${fmtDate(conv.checkIn)}` : ""}
        </div>
        <div
          className={`line-clamp-2 text-[12.5px] leading-snug ${
            unread ? "font-medium text-brand-ink" : "text-brand-mute"
          }`}
        >
          {conv.lastMessagePreview || (
            <span className="italic text-brand-mute">No messages yet</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {conv.isEnquiry ? <Pill tone="pending">Enquiry</Pill> : null}
          {conv.bookingStatus === "confirmed" ? (
            <Pill tone="confirmed">Confirmed</Pill>
          ) : null}
          {conv.bookingStatus === "pending_eft" ||
          conv.bookingStatus === "pending_eft_review" ? (
            <Pill tone="pending">Awaiting payment</Pill>
          ) : null}
          {conv.bookingStatus === "completed" ? (
            <Pill tone="completed">Completed</Pill>
          ) : null}
          {conv.status === "archived" ? (
            <Pill tone="cancelled">Archived</Pill>
          ) : null}
          {unread ? (
            <span className="num ml-auto rounded-pill bg-brand-primary px-1.5 py-0.5 text-[10px] font-bold leading-[1.4] text-white">
              {conv.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

// ── Message bubble ──────────────────────────────────────────
function MessageBubble({
  msg,
  guestInitials,
  hostInitials,
}: {
  msg: MessageRow;
  guestInitials: string;
  hostInitials: string;
}) {
  if (msg.isSystem) {
    return (
      <div className="flex items-center justify-center">
        <span className="rounded-pill border border-brand-line bg-brand-light/80 px-3 py-1 text-[11px] font-medium text-brand-mute">
          {msg.body || msg.systemEvent || "System event"}
        </span>
      </div>
    );
  }

  // We don't carry viewer-id into the bubble; messages the host authored
  // are inserted with read_by_host=true, which is the cleanest marker here.
  const isFromHost = msg.senderId != null && msg.readByHost === true;

  return (
    <div
      className={`flex max-w-[78%] gap-2.5 ${isFromHost ? "ml-auto flex-row-reverse" : "mr-auto"}`}
    >
      <Avatar initials={isFromHost ? hostInitials : guestInitials} size={32} />
      <div className="min-w-0">
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-[1.55] shadow-[0_1px_1px_rgba(6,78,59,0.04)] ${
            isFromHost
              ? "rounded-br-sm bg-brand-secondary text-white"
              : "rounded-bl-sm border border-brand-line bg-white text-brand-ink"
          }`}
        >
          {msg.body ? (
            <p className="whitespace-pre-wrap">{msg.body}</p>
          ) : msg.attachmentFilename ? (
            <span className="inline-flex items-center gap-1.5 text-[13px]">
              <Paperclip className="h-3.5 w-3.5" />
              {msg.attachmentFilename}
            </span>
          ) : (
            <span className="italic opacity-75">(empty)</span>
          )}
          {msg.attachmentUrl && msg.body ? (
            <a
              href={msg.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-2 inline-flex items-center gap-1.5 text-[12px] underline ${
                isFromHost ? "text-brand-accent" : "text-brand-primary"
              }`}
            >
              <Paperclip className="h-3 w-3" />
              {msg.attachmentFilename ?? "Attachment"}
            </a>
          ) : null}
        </div>
        <div
          className={`mt-1 flex items-center gap-1.5 text-[11px] text-brand-mute ${
            isFromHost ? "justify-end" : ""
          }`}
        >
          {isFromHost ? (
            <CheckCheck className="h-3 w-3 text-brand-primary" />
          ) : null}
          {timeOfDay(msg.createdAt)}
        </div>
      </div>
    </div>
  );
}

// ── Composer ────────────────────────────────────────────────
function Composer({
  conversationId,
  hostName,
}: {
  conversationId: string;
  hostName: string;
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const router = useRouter();

  async function send() {
    const body = value.trim();
    if (!body || sending) return;
    setSending(true);
    const res = await sendMessageAction({
      conversation_id: conversationId,
      body,
    });
    setSending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setValue("");
    router.refresh();
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="shrink-0 border-t border-brand-line bg-white px-5 py-3">
      {/* Quick replies — coming-soon placeholder; visuals only, no actions. */}
      <div
        className="thin-scroll -mt-0.5 flex items-center gap-2 overflow-x-auto pb-2 opacity-70"
        aria-disabled="true"
      >
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
          Quick replies
        </span>
        <span
          className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-pill border border-brand-line bg-brand-light px-3 py-1 text-[12px] font-medium text-brand-mute"
          title="Coming soon"
        >
          Confirm dates
        </span>
        <span
          className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-pill border border-brand-line bg-brand-light px-3 py-1 text-[12px] font-medium text-brand-mute"
          title="Coming soon"
        >
          Check-in details
        </span>
        <span
          className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-pill border border-brand-line bg-brand-light px-3 py-1 text-[12px] font-medium text-brand-mute"
          title="Coming soon"
        >
          Banking details
        </span>
        <span
          className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-pill border border-dashed border-brand-line bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-mute"
          title="Coming soon"
        >
          Soon
        </span>
      </div>

      <div className="rounded-card border border-brand-line bg-white transition-shadow focus-within:border-brand-primary focus-within:ring-4 focus-within:ring-brand-primary/15">
        <textarea
          ref={textareaRef}
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder={`Reply as ${hostName}… (Shift+Enter for new line)`}
          className="w-full resize-none bg-transparent px-4 pb-2 pt-3 text-sm text-brand-ink outline-none placeholder:text-brand-mute"
        />
        <div className="flex items-center gap-1 border-t border-brand-line px-2 pb-2 pt-1">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-brand-mute hover:bg-brand-light"
            title="Attach (coming soon)"
            disabled
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-brand-mute hover:bg-brand-light"
            title="Insert booking link (coming soon)"
            disabled
          >
            <LinkIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-brand-mute hover:bg-brand-light"
            title="Emoji (coming soon)"
            disabled
          >
            <Smile className="h-4 w-4" />
          </button>

          <span className="mx-1 h-5 w-px bg-brand-line" />

          <span className="hidden text-[11px] text-brand-mute sm:inline">
            Enter to send · Shift+Enter for newline
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => void send()}
              disabled={!value.trim() || sending}
              className="inline-flex h-9 items-center gap-1.5 rounded bg-brand-primary px-4 text-sm font-medium text-white transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
              <SendHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Booking context pane ────────────────────────────────────
function BookingPane({
  context,
  visibleOnMobile,
  onClose,
}: {
  context: ThreadContext;
  visibleOnMobile: boolean;
  onClose: () => void;
}) {
  return (
    <aside
      className={`thin-scroll w-[340px] shrink-0 flex-col overflow-y-auto border-l border-brand-line bg-white ${
        visibleOnMobile
          ? "fixed inset-y-0 right-0 z-30 flex shadow-2xl xl:static xl:shadow-none"
          : "hidden xl:flex"
      }`}
    >
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-brand-line bg-white/95 px-5 py-3 backdrop-blur">
        <ClipboardList className="h-4 w-4 text-brand-primary" />
        <div className="font-display text-[13.5px] font-semibold text-brand-ink">
          Guest &amp; booking
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded text-brand-mute hover:bg-brand-light xl:hidden"
          title="Hide details"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-brand-line px-5 pb-5 pt-6 text-center">
        <Avatar
          initials={initialsFrom(
            context.guest?.fullName ?? null,
            context.guest?.email ?? null,
          )}
          size={64}
          className="mx-auto"
        />
        <div className="mt-3 font-display text-lg font-bold text-brand-ink">
          {context.guest?.fullName || "Guest"}
        </div>
        {context.guest?.email ? (
          <div className="text-xs text-brand-mute">{context.guest.email}</div>
        ) : null}
        {context.guest?.phone ? (
          <div className="text-xs text-brand-mute">{context.guest.phone}</div>
        ) : null}

        <div className="mt-4 flex items-center justify-center gap-2">
          {context.isEnquiry ? <Pill tone="pending">Enquiry</Pill> : null}
          {context.status === "open" ? (
            <Pill tone="confirmed">Open</Pill>
          ) : null}
          {context.status === "resolved" ? (
            <Pill tone="completed">Resolved</Pill>
          ) : null}
          {context.status === "archived" ? (
            <Pill tone="cancelled">Archived</Pill>
          ) : null}
        </div>
      </div>

      {context.isEnquiry || context.pipelineStage || context.quote ? (
        <PipelineControl
          conversationId={context.conversationId}
          stage={context.pipelineStage}
          quote={context.quote}
        />
      ) : null}

      {context.booking ? (
        <div className="border-b border-brand-line px-5 py-5">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Booking
          </div>
          <dl className="space-y-2 text-[12.5px]">
            <Row label="Reference">
              <span className="font-mono text-brand-ink">
                {context.booking.reference}
              </span>
            </Row>
            <Row label="Listing">{context.listing?.name ?? "—"}</Row>
            <Row label="Check in">{fmtDate(context.booking.checkIn)}</Row>
            <Row label="Check out">{fmtDate(context.booking.checkOut)}</Row>
            {context.booking.nights ? (
              <Row label="Nights">
                <span className="num">{context.booking.nights}</span>
              </Row>
            ) : null}
            {context.booking.guests ? (
              <Row label="Guests">
                <span className="num">{context.booking.guests}</span>
              </Row>
            ) : null}
            <div className="my-2 border-t border-brand-line" />
            <Row label="Total">
              <span className="num font-display font-bold text-brand-ink">
                {fmtZAR(context.booking.total, context.booking.currency)}
              </span>
            </Row>
            <Row label="Status">
              <span className="text-[11px] uppercase tracking-wider text-brand-mute">
                {context.booking.status}
              </span>
            </Row>
          </dl>

          <div className="mt-4 space-y-2">
            <Link
              href={`/dashboard/bookings/${context.booking.id}`}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded bg-brand-primary text-sm font-medium text-white hover:bg-brand-secondary"
            >
              <ExternalLink className="h-4 w-4" /> Open booking
            </Link>
          </div>
        </div>
      ) : context.listing ? (
        <div className="border-b border-brand-line px-5 py-5">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Listing
          </div>
          <div className="text-sm font-semibold text-brand-ink">
            {context.listing.name}
          </div>
          {context.listing.slug ? (
            <Link
              href={`/listings/${context.listing.slug}`}
              className="mt-1 inline-flex items-center gap-1 text-[12px] text-brand-primary hover:underline"
            >
              View public page <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="px-5 py-5">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
          Thread
        </div>
        <div className="text-[12.5px] text-brand-mute">
          Opened{" "}
          {new Date(context.createdAt).toLocaleDateString("en-ZA", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </div>
      </div>
    </aside>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-brand-mute">{label}</dt>
      <dd className="text-right text-brand-ink">{children}</dd>
    </div>
  );
}

// ── Avatar & Pill ───────────────────────────────────────────
const AVATAR_TINTS = [
  "bg-brand-secondary text-white",
  "bg-brand-primary text-brand-dark",
  "bg-brand-dark text-white",
  "bg-[#4A7C6A] text-white",
  "bg-brand-accent text-brand-secondary",
  "bg-[#F59E0B] text-white",
  "bg-[#6366F1] text-white",
  "bg-[#EF4444] text-white",
] as const;

function tintFor(initials: string): string {
  let h = 0;
  for (let i = 0; i < initials.length; i++)
    h = (h * 31 + initials.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

function Avatar({
  initials,
  size,
  className = "",
}: {
  initials: string;
  size: number;
  className?: string;
}) {
  const fontSize =
    size >= 56 ? "text-[18px]" : size >= 40 ? "text-[12px]" : "text-[10px]";
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-display font-bold ${tintFor(initials)} ${fontSize} ${className}`}
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}

type PillTone = "confirmed" | "pending" | "cancelled" | "completed";
function Pill({
  tone,
  children,
}: {
  tone: PillTone;
  children: React.ReactNode;
}) {
  const styles: Record<PillTone, string> = {
    confirmed: "bg-brand-accent text-[#065F46]",
    pending: "bg-[#FEF3C7] text-[#92400E]",
    cancelled: "bg-[#FEE2E2] text-[#991B1B]",
    completed: "bg-[#E0E7FF] text-[#3730A3]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2 py-[1px] text-[10.5px] font-semibold leading-[1.4] ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

// ── Empty states ────────────────────────────────────────────
function EmptyList({ folder, search }: { folder: Folder; search: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
        <InboxIcon className="h-6 w-6" />
      </div>
      <div className="font-display text-base font-semibold text-brand-ink">
        {search
          ? "Nothing matches that search"
          : folder === "archived"
            ? "Nothing archived"
            : folder === "unread"
              ? "You're all caught up"
              : folder === "enquiries"
                ? "No new enquiries"
                : "No conversations yet"}
      </div>
      <p className="mx-auto mt-1 max-w-xs text-[12.5px] text-brand-mute">
        {search
          ? "Try a different name, reference, or listing."
          : "When guests message you about a booking or enquiry, it will show up here."}
      </p>
    </div>
  );
}

function EmptyThread({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <PenSquare className="h-6 w-6" />
        </div>
        <div className="font-display text-lg font-bold text-brand-ink">
          {hasAny ? "Pick a conversation" : "No messages yet"}
        </div>
        <p className="mt-1 text-sm text-brand-mute">
          {hasAny
            ? "Choose a thread from the list to read and reply."
            : "When a guest sends you an enquiry or message, it lands here."}
        </p>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────
function groupByDay(items: ConversationRow[]): {
  label: string;
  items: ConversationRow[];
}[] {
  const today = startOfDay(new Date());
  const yesterday = startOfDay(new Date(today.getTime() - 86_400_000));
  const week = startOfDay(new Date(today.getTime() - 6 * 86_400_000));

  const buckets: Record<string, ConversationRow[]> = {
    Today: [],
    Yesterday: [],
    "This week": [],
    Earlier: [],
  };

  for (const it of items) {
    const ref = it.lastMessageAt ?? it.createdAt;
    const t = startOfDay(new Date(ref));
    if (t.getTime() === today.getTime()) buckets["Today"].push(it);
    else if (t.getTime() === yesterday.getTime()) buckets["Yesterday"].push(it);
    else if (t.getTime() >= week.getTime()) buckets["This week"].push(it);
    else buckets["Earlier"].push(it);
  }

  return Object.entries(buckets)
    .filter(([, arr]) => arr.length > 0)
    .map(([label, arr]) => ({ label, items: arr }));
}

function groupMessagesByDay(items: MessageRow[]): {
  label: string;
  items: MessageRow[];
}[] {
  const out: { label: string; items: MessageRow[] }[] = [];
  let currentKey = "";
  for (const m of items) {
    const key = startOfDay(new Date(m.createdAt)).toISOString();
    if (key !== currentKey) {
      out.push({ label: dayLabel(m.createdAt), items: [] });
      currentKey = key;
    }
    out[out.length - 1].items.push(m);
  }
  return out;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
