"use client";

import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowUp,
  BadgeCheck,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Hourglass,
  Inbox as InboxIcon,
  KeyRound,
  MailOpen,
  MessageSquareText,
  Paperclip,
  Phone,
  ReceiptText,
  RotateCw,
  Search,
  Sparkles,
  Star,
  User,
  X,
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

import {
  ThreadQuoteCard,
  type ThreadBooking,
  type ThreadQuote,
} from "@/components/inbox/ThreadQuoteCard";
import { firstQuoteMessageIds } from "@/components/inbox/quote-thread";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

import {
  archiveConversationAction,
  assignConversationAction,
  markConversationReadAction,
  sendMessageAction,
  setFollowUpAction,
  setPipelineStageAction,
  togglePinAction,
  unarchiveConversationAction,
} from "./actions";
import { ConversationNotes, type ConvNote } from "./ConversationNotes";
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
  quoteId: string | null;
  readByHost: boolean;
  readByGuest: boolean;
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
  listing: {
    id: string;
    name: string;
    slug: string | null;
    city: string | null;
    province: string | null;
    maxGuests: number | null;
    bedrooms: number | null;
  } | null;
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
  pinned: boolean;
  followUpAt: string | null;
  assignedTo: string | null;
  quote: {
    id: string;
    status: string;
    quoteNumber: string | null;
    total: number;
    currency: string;
    validUntil: string | null;
    viewCount: number;
    lastViewedAt: string | null;
  } | null;
  notes: ConvNote[];
};

export type TemplateRow = { id: string; title: string; body: string };
export type Assignee = { id: string; name: string };
export type ListingRef = { id: string; name: string };

export type Counts = {
  all: number;
  unread: number;
  needs_reply: number;
  follow_up: number;
  enquiries: number;
  open: number;
  archived: number;
  starred: number;
  booked: number;
  past: number;
  unread_total: number;
  pipeline: {
    new_quote: number;
    quote_sent: number;
    negotiating: number;
    accepted: number;
    declined: number;
    lost: number;
  };
  pipelineValue: Record<string, number>;
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
  | "needs_reply"
  | "follow_up"
  | "enquiries"
  | "open"
  | "archived"
  | "starred"
  | "booked"
  | "past"
  | PipelineStage;

// Folder rail — the Gmail-style left nav. Wired to real folders only.
const RAIL_FOLDERS: {
  key: Exclude<Folder, PipelineStage>;
  label: string;
  icon: typeof InboxIcon;
}[] = [
  { key: "all", label: "Inbox", icon: InboxIcon },
  { key: "unread", label: "Unread", icon: MailOpen },
  { key: "starred", label: "Starred", icon: Star },
  { key: "follow_up", label: "Follow up", icon: Clock },
  { key: "enquiries", label: "Enquiries", icon: AlertTriangle },
  { key: "archived", label: "Archived", icon: Archive },
];

// Tabs — mirror the mock's strip, each mapped to a real folder query.
const TABS: { key: Folder; label: string; countKey: keyof Counts }[] = [
  { key: "all", label: "All", countKey: "all" },
  { key: "enquiries", label: "Enquiries", countKey: "enquiries" },
  { key: "booked", label: "Booked", countKey: "booked" },
  { key: "needs_reply", label: "Action needed", countKey: "needs_reply" },
  { key: "past", label: "Past", countKey: "past" },
];

const PIPELINE: { key: PipelineStage; label: string; dot: string }[] = [
  { key: "new_quote", label: "New quote", dot: "bg-status-pending" },
  { key: "quote_sent", label: "Quote sent", dot: "bg-brand-primary" },
  { key: "negotiating", label: "Negotiating", dot: "bg-status-completed" },
  { key: "accepted", label: "Accepted", dot: "bg-status-confirmed" },
  { key: "declined", label: "Declined", dot: "bg-status-cancelled" },
  { key: "lost", label: "Lost", dot: "bg-brand-mute" },
];

// Stable per-listing dot colours for the rail.
const LISTING_DOTS = [
  "#10B981",
  "#6366F1",
  "#F59E0B",
  "#EF4444",
  "#064E3B",
  "#0EA5E9",
] as const;

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

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Derive a status chip for a conversation row / thread header.
type ChipTone = "green" | "amber" | "red" | "indigo" | "gray";
function chipFor(c: {
  isEnquiry: boolean;
  status: string;
  bookingStatus: string | null;
}): { tone: ChipTone; label: string } | null {
  if (c.status === "archived") return { tone: "gray", label: "Archived" };
  if (c.isEnquiry) return { tone: "amber", label: "Enquiry" };
  switch (c.bookingStatus) {
    case "confirmed":
      return { tone: "green", label: "Confirmed" };
    case "pending_eft":
    case "pending_eft_review":
      return { tone: "amber", label: "Awaiting payment" };
    case "completed":
      return { tone: "indigo", label: "Completed" };
    case "cancelled":
      return { tone: "red", label: "Cancelled" };
    default:
      return null;
  }
}

export function InboxView({
  hostInitials,
  hostName,
  hostAvatarUrl,
  selfUserId,
  folder,
  counts,
  search,
  listings,
  listingFilter,
  page,
  pageSize,
  total,
  conversations,
  selectedId,
  messages,
  context,
  quotesById,
  bookingsById,
  templates,
  assignees,
}: {
  hostInitials: string;
  hostName: string;
  hostAvatarUrl: string | null;
  selfUserId: string;
  folder: Folder;
  counts: Counts;
  search: string;
  listings: ListingRef[];
  listingFilter: string | null;
  page: number;
  pageSize: number;
  total: number;
  conversations: ConversationRow[];
  selectedId: string | null;
  messages: MessageRow[];
  context: ThreadContext | null;
  quotesById: Record<string, ThreadQuote>;
  bookingsById: Record<string, ThreadBooking>;
  templates: TemplateRow[];
  assignees: Assignee[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(search);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const inReadMode = Boolean(context);

  // Mark selected conversation as read on open.
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

  // Close the details drawer whenever the open thread changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [selectedId]);

  // Escape closes the drawer.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-scroll the thread to the bottom when messages change.
  const threadRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages.length, selectedId]);

  // Realtime: soft-refresh on any messages/conversations change the host sees.
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
        { event: "UPDATE", schema: "public", table: "messages" },
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
    (next: Partial<Record<"c" | "f" | "q" | "l" | "p", string | null>>) => {
      const u = new URLSearchParams(params?.toString() ?? "");
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === "") u.delete(k);
        else u.set(k, v);
      }
      const qs = u.toString();
      router.push(qs ? `/dashboard/inbox?${qs}` : "/dashboard/inbox");
    },
    [params, router],
  );

  // Debounce search input → URL.
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => {
      navigateWith({ q: searchInput.trim() || null, c: null, p: null });
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput, search, navigateWith]);

  const messageDays = useMemo(() => groupMessagesByDay(messages), [messages]);
  const quoteCardMsgIds = useMemo(
    () => firstQuoteMessageIds(messages, quotesById),
    [messages, quotesById],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-white">
      {/* ── Gmail-style folder rail (lg+) ───────────────────── */}
      <aside className="hidden w-64 shrink-0 flex-col overflow-hidden bg-[#EEF4F0] lg:flex">
        <nav className="thin-scroll flex-1 overflow-y-auto py-3">
          {RAIL_FOLDERS.map((f) => {
            const active = folder === f.key && !listingFilter;
            const Icon = f.icon;
            const count = counts[f.key as keyof Counts] as number | undefined;
            return (
              <RailItem
                key={f.key}
                active={active}
                onClick={() =>
                  navigateWith({ f: f.key, l: null, c: null, p: null })
                }
                icon={<Icon className="h-[18px] w-[18px]" />}
                label={f.label}
                count={count}
              />
            );
          })}

          {/* Pipeline */}
          <RailDivider />
          <RailHeading>Pipeline</RailHeading>
          {PIPELINE.map((p) => {
            const active = folder === p.key && !listingFilter;
            const count = counts.pipeline?.[p.key] ?? 0;
            return (
              <RailItem
                key={p.key}
                active={active}
                onClick={() =>
                  navigateWith({ f: p.key, l: null, c: null, p: null })
                }
                icon={<span className={`h-2.5 w-2.5 rounded-full ${p.dot}`} />}
                label={p.label}
                count={count > 0 ? count : undefined}
              />
            );
          })}

          {/* Listings */}
          {listings.length > 0 ? (
            <>
              <RailDivider />
              <RailHeading>Listings</RailHeading>
              {listings.map((l, i) => {
                const active = listingFilter === l.id;
                return (
                  <RailItem
                    key={l.id}
                    active={active}
                    onClick={() =>
                      navigateWith({
                        l: active ? null : l.id,
                        c: null,
                        p: null,
                      })
                    }
                    icon={
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          background: LISTING_DOTS[i % LISTING_DOTS.length],
                        }}
                      />
                    }
                    label={l.name}
                  />
                );
              })}
            </>
          ) : null}

          <RailDivider />
          <div className="px-3 pt-1">
            <Link
              href="/dashboard/inbox/contacts"
              className="flex h-9 items-center gap-3 rounded-full px-3 text-sm font-medium text-[#3A5A4E] transition-colors hover:bg-[#E2EDE6]"
            >
              <User className="h-[18px] w-[18px]" /> Contacts
            </Link>
          </div>
        </nav>
      </aside>

      {/* ── Main content (switches list ↔ thread) ───────────── */}
      <div className="relative flex min-w-0 flex-1 flex-col bg-white">
        {inReadMode && context ? (
          <ReadView
            context={context}
            messages={messages}
            messageDays={messageDays}
            quoteCardMsgIds={quoteCardMsgIds}
            quotesById={quotesById}
            bookingsById={bookingsById}
            selfUserId={selfUserId}
            hostInitials={hostInitials}
            hostName={hostName}
            hostAvatarUrl={hostAvatarUrl}
            templates={templates}
            threadRef={threadRef}
            pending={pending}
            onBack={() => navigateWith({ c: null })}
            onArchiveToggle={() =>
              startTransition(async () => {
                const r =
                  context.status === "archived"
                    ? await unarchiveConversationAction(context.conversationId)
                    : await archiveConversationAction(context.conversationId);
                if (!r.ok) toast.error(r.error);
                else {
                  toast.success(
                    context.status === "archived" ? "Unarchived" : "Archived",
                  );
                  if (context.status !== "archived") navigateWith({ c: null });
                }
              })
            }
            onOpenDetails={() => setDrawerOpen(true)}
          />
        ) : (
          <ListView
            folder={folder}
            counts={counts}
            search={search}
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            conversations={conversations}
            listingFilter={listingFilter}
            page={page}
            pageSize={pageSize}
            total={total}
            navigateWith={navigateWith}
            onRefresh={() => router.refresh()}
          />
        )}

        {/* Slide-over details drawer */}
        {context ? (
          <DetailsDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            context={context}
            assignees={assignees}
          />
        ) : null}
      </div>
    </div>
  );
}

// ── Rail primitives ─────────────────────────────────────────
function RailItem({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mr-2 flex h-9 w-[calc(100%-8px)] items-center rounded-r-full pl-6 pr-4 text-left text-sm transition-colors ${
        active
          ? "bg-brand-accent font-bold text-brand-secondary"
          : "font-medium text-[#3A5A4E] hover:bg-[#E2EDE6]"
      }`}
    >
      <span className="mr-[18px] flex w-5 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 ? (
        <span
          className={`num ml-2 text-xs ${active ? "font-bold text-brand-secondary" : "text-[#5B7065]"}`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function RailDivider() {
  return <div className="my-2 mr-3 h-px bg-[#E1ECE5]" />;
}

function RailHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-brand-mute">
      {children}
    </div>
  );
}

// ── List view ───────────────────────────────────────────────
function ListView({
  folder,
  counts,
  search,
  searchInput,
  setSearchInput,
  conversations,
  listingFilter,
  page,
  pageSize,
  total,
  navigateWith,
  onRefresh,
}: {
  folder: Folder;
  counts: Counts;
  search: string;
  searchInput: string;
  setSearchInput: (v: string) => void;
  conversations: ConversationRow[];
  listingFilter: string | null;
  page: number;
  pageSize: number;
  total: number;
  navigateWith: (
    next: Partial<Record<"c" | "f" | "q" | "l" | "p", string | null>>,
  ) => void;
  onRefresh: () => void;
}) {
  const from = (page - 1) * pageSize;
  const showingFrom = total === 0 ? 0 : from + 1;
  const showingTo = Math.min(from + pageSize, total);
  const hasPrev = page > 1;
  const hasNext = from + pageSize < total;

  return (
    <>
      {/* Search + toolbar + tabs */}
      <div className="shrink-0 border-b border-brand-line bg-white">
        <div className="flex items-center gap-2 px-3 py-2.5 lg:px-4">
          <div className="flex h-10 max-w-xl flex-1 items-center gap-2.5 rounded-full bg-[#F4F8F5] px-4 transition focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(16,185,129,.1)]">
            <Search className="h-4 w-4 text-brand-mute" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search guests, listings, refs…"
              className="min-w-0 flex-1 bg-transparent text-sm text-brand-ink outline-none placeholder:text-brand-mute"
            />
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand-mute transition-colors hover:bg-brand-light hover:text-brand-ink"
            title="Refresh"
          >
            <RotateCw className="h-[18px] w-[18px]" />
          </button>
          {!search ? (
            <div className="ml-auto flex shrink-0 items-center gap-1 text-[12px] text-brand-mute">
              <span className="num mr-1 hidden sm:inline">
                {showingFrom}–{showingTo} of {total}
              </span>
              <button
                type="button"
                disabled={!hasPrev}
                onClick={() => navigateWith({ p: String(page - 1), c: null })}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-brand-light hover:text-brand-ink disabled:opacity-40 disabled:hover:bg-transparent"
                title="Newer"
              >
                <ChevronLeft className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={() => navigateWith({ p: String(page + 1), c: null })}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-brand-light hover:text-brand-ink disabled:opacity-40 disabled:hover:bg-transparent"
                title="Older"
              >
                <ChevronRight className="h-[18px] w-[18px]" />
              </button>
            </div>
          ) : null}
        </div>

        {/* Tabs */}
        <div
          className="flex items-stretch overflow-x-auto px-3 lg:px-4"
          style={{ scrollbarWidth: "none" }}
        >
          {TABS.map((t) => {
            const active = folder === t.key;
            const count = counts[t.countKey] as number;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => navigateWith({ f: t.key, c: null, p: null })}
                className={`relative mx-3 whitespace-nowrap py-3 text-[13.5px] font-semibold transition-colors first:ml-0 ${
                  active
                    ? "text-brand-secondary"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                {t.label}
                {count > 0 ? (
                  <span
                    className={`num ml-1.5 rounded-full px-1.5 py-px text-[11px] ${
                      active
                        ? "bg-brand-accent text-brand-secondary"
                        : "bg-brand-light text-brand-mute"
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
                {active ? (
                  <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded bg-brand-primary" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rows */}
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <EmptyList
            folder={folder}
            search={search}
            listingFilter={listingFilter}
          />
        ) : (
          conversations.map((c) => (
            <GmailRow
              key={c.id}
              conv={c}
              onOpen={() => navigateWith({ c: c.id })}
            />
          ))
        )}
      </div>
    </>
  );
}

// ── Single-line conversation row ────────────────────────────
function GmailRow({
  conv,
  onOpen,
}: {
  conv: ConversationRow;
  onOpen: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = conv.unreadCount > 0;
  const chip = chipFor(conv);
  const important = chip?.tone === "amber" || chip?.tone === "red";
  const time = relativeTime(conv.lastMessageAt ?? conv.createdAt);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Something went wrong.");
      else router.refresh();
    });
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      className={`group relative flex h-[52px] cursor-pointer items-center border-b border-[#F1F6F2] pl-3 pr-3 transition-shadow hover:z-[1] hover:bg-white hover:shadow-[0_1px_6px_rgba(6,78,59,.14)] ${
        unread ? "bg-white" : "bg-[#F6F9F7]"
      }`}
    >
      {/* Star = pin */}
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation();
          act(() => togglePinAction(conv.id, true));
        }}
        className="mr-2.5 shrink-0 text-[#C4D5CB] hover:text-status-pending"
        title="Pin to top"
      >
        <Star className="h-[18px] w-[18px]" />
      </button>
      {/* Importance marker */}
      <ChevronRight
        className={`mr-3 hidden h-4 w-4 shrink-0 sm:block ${
          important ? "text-status-pending" : "text-[#C4D5CB]"
        }`}
      />
      <Avatar
        initials={initialsFrom(conv.guestName, conv.guestEmail)}
        size={32}
        className="mr-3.5"
      />
      <span
        className={`mr-3 w-[120px] shrink-0 truncate text-sm sm:w-[170px] ${
          unread ? "font-bold text-brand-ink" : "text-[#41614F]"
        }`}
      >
        {conv.guestName || conv.guestEmail || "Guest"}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">
        <span
          className={unread ? "font-bold text-brand-ink" : "text-[#2C4A3C]"}
        >
          {conv.listingName ?? "Conversation"}
          {conv.checkIn ? ` · ${fmtDate(conv.checkIn)}` : ""}
        </span>
        <span className="text-[#94ADA1]">
          {conv.lastMessagePreview
            ? `  —  ${conv.lastMessagePreview}`
            : "  —  No messages yet"}
        </span>
      </span>

      {/* Chip + time (hidden on hover) */}
      {chip ? (
        <span className="ml-3 shrink-0 group-hover:hidden">
          <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
        </span>
      ) : null}
      <span
        className={`num ml-2 w-[58px] shrink-0 text-right text-xs group-hover:hidden ${
          unread ? "font-semibold text-brand-secondary" : "text-brand-mute"
        }`}
      >
        {time}
      </span>

      {/* Hover actions */}
      <span className="ml-2 hidden shrink-0 items-center group-hover:flex">
        <RowAction
          title="Archive"
          onClick={(e) => {
            e.stopPropagation();
            act(() => archiveConversationAction(conv.id));
          }}
        >
          <Archive className="h-[17px] w-[17px]" />
        </RowAction>
        {unread ? (
          <RowAction
            title="Mark read"
            onClick={(e) => {
              e.stopPropagation();
              act(() => markConversationReadAction(conv.id));
            }}
          >
            <MailOpen className="h-[17px] w-[17px]" />
          </RowAction>
        ) : null}
        <RowAction
          title="Snooze to tomorrow"
          onClick={(e) => {
            e.stopPropagation();
            const d = new Date();
            d.setDate(d.getDate() + 1);
            act(() => setFollowUpAction(conv.id, d.toISOString()));
          }}
        >
          <Clock className="h-[17px] w-[17px]" />
        </RowAction>
      </span>
    </div>
  );
}

function RowAction({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-brand-mute transition-colors hover:bg-brand-light hover:text-brand-ink"
    >
      {children}
    </button>
  );
}

// ── Read view (full-width thread) ───────────────────────────
function ReadView({
  context,
  messages,
  messageDays,
  quoteCardMsgIds,
  quotesById,
  bookingsById,
  selfUserId,
  hostInitials,
  hostName,
  hostAvatarUrl,
  threadRef,
  pending,
  onBack,
  onArchiveToggle,
  onOpenDetails,
  templates,
}: {
  context: ThreadContext;
  messages: MessageRow[];
  messageDays: { label: string; items: MessageRow[] }[];
  quoteCardMsgIds: Set<string>;
  quotesById: Record<string, ThreadQuote>;
  bookingsById: Record<string, ThreadBooking>;
  selfUserId: string;
  hostInitials: string;
  hostName: string;
  hostAvatarUrl: string | null;
  threadRef: React.RefObject<HTMLDivElement>;
  pending: boolean;
  onBack: () => void;
  onArchiveToggle: () => void;
  onOpenDetails: () => void;
  templates: TemplateRow[];
}) {
  const guestInitials = initialsFrom(
    context.guest?.fullName ?? null,
    context.guest?.email ?? null,
  );
  const archived = context.status === "archived";
  const threadChip = chipFor({
    isEnquiry: context.isEnquiry,
    status: context.status,
    bookingStatus: context.booking?.status ?? null,
  });

  return (
    <>
      {/* Header bar */}
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-brand-line bg-white px-2 lg:px-4">
        <IconBtn title="Back to inbox" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </IconBtn>
        <IconBtn
          title={archived ? "Unarchive" : "Archive"}
          onClick={onArchiveToggle}
          disabled={pending}
        >
          {archived ? (
            <ArchiveRestore className="h-[18px] w-[18px]" />
          ) : (
            <Archive className="h-[18px] w-[18px]" />
          )}
        </IconBtn>
        <ThreadPinButton
          conversationId={context.conversationId}
          pinned={context.pinned}
        />
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenDetails}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-brand-line px-3.5 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
          >
            <ReceiptText className="h-4 w-4 text-brand-primary" />
            <span className="hidden sm:inline">
              {context.booking ? "Booking details" : "Details"}
            </span>
          </button>
          {context.guest?.phone ? (
            <a
              href={`tel:${context.guest.phone}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-brand-mute hover:bg-brand-light hover:text-brand-ink"
              title="Call"
            >
              <Phone className="h-[18px] w-[18px]" />
            </a>
          ) : null}
        </div>
      </div>

      {/* Identity bar */}
      <div className="flex shrink-0 items-center gap-3.5 border-b border-brand-line bg-white px-5 py-3.5 lg:px-8">
        <Avatar initials={guestInitials} size={44} />
        <div className="min-w-0">
          <div className="font-display text-[16px] font-bold text-brand-ink">
            {context.guest?.fullName || context.guest?.email || "Guest"}
          </div>
          <div className="mt-0.5 truncate text-[12.5px] text-brand-mute">
            {context.listing?.name ?? "—"}
            {context.booking?.checkIn
              ? ` · ${fmtDate(context.booking.checkIn)} – ${fmtDate(context.booking.checkOut)}`
              : ""}
            {context.booking?.guests
              ? ` · ${context.booking.guests} ${context.booking.guests === 1 ? "guest" : "guests"}`
              : ""}
          </div>
        </div>
        {threadChip ? (
          <span className="ml-auto shrink-0">
            <StatusChip tone={threadChip.tone}>{threadChip.label}</StatusChip>
          </span>
        ) : null}
      </div>

      {/* Messages */}
      <div
        ref={threadRef}
        className="thin-scroll min-h-0 flex-1 overflow-y-auto bg-[#FAFCFA] px-5 lg:px-0"
      >
        <div className="mx-auto max-w-2xl space-y-6 py-8">
          {messages.length === 0 ? (
            <div className="mx-auto max-w-md rounded-card border border-dashed border-brand-line bg-white p-8 text-center text-sm text-brand-mute">
              No messages yet. Send the first reply below.
            </div>
          ) : (
            messageDays.map(({ label, items }) => (
              <div key={label} className="space-y-6">
                <div className="flex items-center gap-3.5 text-[11px] font-semibold uppercase tracking-wider text-[#A0B5AB]">
                  <span className="h-px flex-1 bg-[#E9F1EC]" />
                  <span>{label}</span>
                  <span className="h-px flex-1 bg-[#E9F1EC]" />
                </div>
                {items.map((m) =>
                  m.quoteId &&
                  quoteCardMsgIds.has(m.id) &&
                  quotesById[m.quoteId] ? (
                    <ThreadQuoteCard
                      key={m.id}
                      quote={quotesById[m.quoteId]}
                      booking={
                        quotesById[m.quoteId].convertedBookingId
                          ? (bookingsById[
                              quotesById[m.quoteId].convertedBookingId as string
                            ] ?? null)
                          : null
                      }
                      viewer="host"
                    />
                  ) : (
                    <MessageBubble
                      key={m.id}
                      msg={m}
                      selfUserId={selfUserId}
                      guestInitials={guestInitials}
                      hostInitials={hostInitials}
                      hostAvatarUrl={hostAvatarUrl}
                      guestAvatarUrl={context.guest?.avatarUrl ?? null}
                    />
                  ),
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-brand-line bg-white px-5 py-4 lg:px-0">
        <div className="mx-auto max-w-2xl">
          <Composer
            conversationId={context.conversationId}
            hostName={hostName}
            guestName={context.guest?.fullName ?? null}
            templates={templates}
          />
        </div>
      </div>
    </>
  );
}

function IconBtn({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-brand-mute transition-colors hover:bg-brand-light hover:text-brand-ink disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function ThreadPinButton({
  conversationId,
  pinned,
}: {
  conversationId: string;
  pinned: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await togglePinAction(conversationId, !pinned);
          if (r.ok) router.refresh();
          else toast.error(r.error);
        })
      }
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
        pinned
          ? "text-status-pending"
          : "text-brand-mute hover:bg-brand-light hover:text-brand-ink"
      }`}
      title={pinned ? "Unpin" : "Pin to top"}
    >
      <Star className={`h-[18px] w-[18px] ${pinned ? "fill-current" : ""}`} />
    </button>
  );
}

// ── Message bubble ──────────────────────────────────────────
function MessageBubble({
  msg,
  selfUserId,
  guestInitials,
  hostInitials,
  hostAvatarUrl,
  guestAvatarUrl,
}: {
  msg: MessageRow;
  selfUserId: string;
  guestInitials: string;
  hostInitials: string;
  hostAvatarUrl: string | null;
  guestAvatarUrl: string | null;
}) {
  if (msg.isSystem && msg.systemEvent === "access_details") {
    return (
      <div className="mx-auto w-full max-w-[88%] rounded-card border border-brand-primary/30 bg-brand-accent/30 p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-white">
            <KeyRound className="h-4 w-4" />
          </span>
          <span className="font-display text-[14px] font-bold text-brand-ink">
            Access details sent to guest
          </span>
        </div>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-brand-ink">
          {msg.body}
        </pre>
      </div>
    );
  }

  if (msg.isSystem) {
    return (
      <div className="flex items-center justify-center">
        <span className="rounded-full border border-brand-line bg-brand-light/80 px-3 py-1 text-[11px] font-medium text-brand-mute">
          {msg.body || msg.systemEvent || "System event"}
        </span>
      </div>
    );
  }

  const isFromHost = msg.senderId === selfUserId;

  return (
    <div
      className={`flex max-w-[78%] gap-2.5 ${isFromHost ? "ml-auto flex-row-reverse" : "mr-auto"}`}
    >
      <Avatar
        initials={isFromHost ? hostInitials : guestInitials}
        imageUrl={isFromHost ? hostAvatarUrl : guestAvatarUrl}
        size={28}
        className="mt-auto"
      />
      <div className="min-w-0">
        <div
          className={`px-4 py-3 text-[14.5px] leading-[1.55] ${
            isFromHost
              ? "rounded-2xl rounded-br-[5px] bg-brand-secondary text-white"
              : "rounded-2xl rounded-bl-[5px] border border-brand-line bg-white text-brand-ink"
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
          className={`mt-1.5 flex items-center gap-1.5 text-[11.5px] text-[#8AA89C] ${
            isFromHost ? "justify-end" : ""
          }`}
        >
          {timeOfDay(msg.createdAt)}
          {isFromHost ? (
            <CheckCheck
              aria-label={msg.readByGuest ? "Read" : "Delivered"}
              className={`h-3.5 w-3.5 ${
                msg.readByGuest ? "text-brand-primary" : "text-[#8AA89C]"
              }`}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Composer ────────────────────────────────────────────────
function Composer({
  conversationId,
  hostName,
  guestName,
  templates,
}: {
  conversationId: string;
  hostName: string;
  guestName: string | null;
  templates: TemplateRow[];
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const router = useRouter();

  async function send() {
    const body = value.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await sendMessageAction({
        conversation_id: conversationId,
        body,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setValue("");
      router.refresh();
    } catch {
      toast.error("Couldn't send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div>
      {templates.length > 0 ? (
        <div className="thin-scroll mb-2 flex items-center gap-2 overflow-x-auto">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Quick replies
          </span>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() =>
                setValue((v) => (v.trim() ? `${v}\n${t.body}` : t.body))
              }
              title={t.body}
              className="inline-flex shrink-0 items-center rounded-full border border-brand-line bg-white px-3 py-1 text-[12px] font-medium text-brand-ink transition-colors hover:bg-brand-light"
            >
              {t.title}
            </button>
          ))}
          <Link
            href="/dashboard/inbox/templates"
            className="inline-flex shrink-0 items-center rounded-full border border-dashed border-brand-line bg-white px-2.5 py-1 text-[11px] font-medium text-brand-mute hover:bg-brand-light"
          >
            Manage
          </Link>
        </div>
      ) : null}

      <div className="rounded-card border border-brand-line bg-white transition focus-within:border-brand-primary focus-within:shadow-[0_0_0_4px_rgba(16,185,129,.12)]">
        <textarea
          ref={textareaRef}
          rows={2}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder={`Reply to ${guestName?.split(" ")[0] ?? "guest"}…`}
          className="w-full resize-none bg-transparent px-4 pb-1 pt-3 text-sm text-brand-ink outline-none placeholder:text-brand-mute"
        />
        <div className="flex items-center gap-0.5 px-2 pb-2">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-brand-mute hover:bg-brand-light disabled:opacity-50"
            title="Attach (coming soon)"
            disabled
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-brand-mute hover:bg-brand-light disabled:opacity-50"
            title="Insert quote (coming soon)"
            disabled
          >
            <FileText className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-brand-mute hover:bg-brand-light disabled:opacity-50"
            title="Quick replies"
            disabled={templates.length === 0}
            onClick={() => textareaRef.current?.focus()}
          >
            <MessageSquareText className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-brand-mute hover:bg-brand-light disabled:opacity-50"
            title="AI suggest (coming soon)"
            disabled
          >
            <Sparkles className="h-4 w-4" />
          </button>
          <span className="ml-auto mr-1 hidden text-[11px] text-brand-mute sm:inline">
            {hostName ? `as ${hostName}` : ""}
          </span>
          <button
            type="button"
            onClick={() => void send()}
            disabled={!value.trim() || sending}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Slide-over details drawer ───────────────────────────────
function DetailsDrawer({
  open,
  onClose,
  context,
  assignees,
}: {
  open: boolean;
  onClose: () => void;
  context: ThreadContext;
  assignees: Assignee[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const refLabel = context.booking
    ? "Vilo booking"
    : context.isEnquiry
      ? "Vilo enquiry"
      : "Vilo conversation";
  const refValue =
    context.booking?.reference ??
    `VILO-${context.conversationId.slice(0, 8).toUpperCase()}`;

  function move(stage: PipelineStage, okMsg: string) {
    start(async () => {
      const r = await setPipelineStageAction(context.conversationId, stage);
      if (r.ok) {
        toast.success(okMsg);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  const listingMeta = context.listing
    ? [
        [context.listing.city, context.listing.province]
          .filter(Boolean)
          .join(", "),
        context.listing.maxGuests ? `sleeps ${context.listing.maxGuests}` : "",
        context.listing.bedrooms
          ? `${context.listing.bedrooms} ${context.listing.bedrooms === 1 ? "bedroom" : "bedrooms"}`
          : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        className={`absolute inset-0 z-40 bg-[rgba(5,46,31,.32)] transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      {/* Panel */}
      <aside
        className={`absolute inset-y-0 right-0 z-50 flex w-[380px] max-w-[92vw] flex-col bg-white shadow-[-10px_0_40px_-12px_rgba(6,78,59,.25)] transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center border-b border-brand-line px-5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-mute">
              {refLabel}
            </div>
            <div className="num mt-0.5 font-mono text-[11px] text-brand-ink">
              {refValue}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-brand-mute hover:bg-brand-light hover:text-brand-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto">
          {/* Quote summary + confirm/decline (enquiries) */}
          {context.quote || context.isEnquiry ? (
            <div className="px-5 pb-4 pt-5">
              <StatusChip tone="amber">
                <Hourglass className="h-3 w-3" /> Awaiting your response
              </StatusChip>
              {context.quote ? (
                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <span className="text-[12px] text-brand-mute">
                    Quote total
                  </span>
                  <span className="num font-display text-2xl font-extrabold text-brand-ink">
                    {formatMoney(context.quote.total, context.quote.currency)}
                  </span>
                </div>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => move("accepted", "Marked as accepted")}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-brand-primary text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> Confirm
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => move("declined", "Marked as declined")}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-brand-line bg-white text-sm font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          ) : null}

          {/* Listing card */}
          {context.listing ? (
            <div className="px-5 pb-5">
              <div className="rounded-card border border-brand-line p-3.5">
                <div className="font-display text-[14px] font-semibold text-brand-ink">
                  {context.listing.name}
                </div>
                {listingMeta ? (
                  <div className="mt-0.5 text-[11px] text-brand-mute">
                    {listingMeta}
                  </div>
                ) : null}
                {context.listing.slug ? (
                  <Link
                    href={`/listings/${context.listing.slug}`}
                    className="mt-2 inline-flex items-center gap-1 text-[12px] text-brand-primary hover:underline"
                  >
                    View public page <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Stay details */}
          {context.booking ? (
            <div className="px-5 pb-5">
              <DrawerHeading>Stay details</DrawerHeading>
              <dl>
                <DrawerRow label="Check in">
                  {fmtDate(context.booking.checkIn)}
                </DrawerRow>
                <DrawerRow label="Check out">
                  {fmtDate(context.booking.checkOut)}
                </DrawerRow>
                {context.booking.nights ? (
                  <DrawerRow label="Nights">
                    <span className="num">{context.booking.nights}</span>
                  </DrawerRow>
                ) : null}
                {context.booking.guests ? (
                  <DrawerRow label="Guests">
                    <span className="num">{context.booking.guests}</span>
                  </DrawerRow>
                ) : null}
                <DrawerRow label="Total">
                  <span className="num font-display font-bold text-brand-ink">
                    {formatMoney(
                      context.booking.total,
                      context.booking.currency,
                    )}
                  </span>
                </DrawerRow>
                <DrawerRow label="Reference">
                  <span className="font-mono text-[12px]">
                    {context.booking.reference}
                  </span>
                </DrawerRow>
              </dl>
              <Link
                href={`/dashboard/bookings/${context.booking.id}`}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-brand-primary text-sm font-semibold text-white hover:bg-brand-secondary"
              >
                <ExternalLink className="h-4 w-4" /> Open booking
              </Link>
            </div>
          ) : null}

          {/* Guest */}
          <div className="px-5 pb-5">
            <DrawerHeading>Guest</DrawerHeading>
            <div className="flex items-center gap-3 py-1">
              <Avatar
                initials={initialsFrom(
                  context.guest?.fullName ?? null,
                  context.guest?.email ?? null,
                )}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-brand-ink">
                  {context.guest?.fullName || "Guest"}
                </div>
                {context.guest?.email ? (
                  <div className="truncate text-[12px] text-brand-mute">
                    {context.guest.email}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[12px] text-brand-mute">
              {context.guest?.phone ? (
                <a
                  href={`https://wa.me/${context.guest.phone.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-line px-3 py-1.5 font-medium text-brand-ink hover:bg-brand-light"
                >
                  <Phone className="h-3.5 w-3.5 text-brand-primary" /> WhatsApp
                </a>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <BadgeCheck className="h-3.5 w-3.5 text-brand-primary" /> Vilo
                direct
              </span>
            </div>
          </div>

          {/* Pipeline + follow-up + linked quote (real wiring) */}
          {context.isEnquiry || context.pipelineStage || context.quote ? (
            <PipelineControl
              conversationId={context.conversationId}
              stage={context.pipelineStage}
              quote={context.quote}
              followUpAt={context.followUpAt}
            />
          ) : null}

          {/* Assignee */}
          {assignees.length > 1 ? (
            <AssigneeSelect
              conversationId={context.conversationId}
              assignedTo={context.assignedTo}
              assignees={assignees}
            />
          ) : null}

          {/* Private notes */}
          <ConversationNotes
            conversationId={context.conversationId}
            notes={context.notes}
          />
        </div>
      </aside>
    </>
  );
}

function DrawerHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-mute">
      {children}
    </div>
  );
}

function DrawerRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3 border-t border-[#F1F6F2] py-2.5 text-[13.5px] first:border-t-0">
      <dt className="text-brand-mute">{label}</dt>
      <dd className="text-right font-semibold text-brand-ink">{children}</dd>
    </div>
  );
}

// ── Assignee select ─────────────────────────────────────────
function AssigneeSelect({
  conversationId,
  assignedTo,
  assignees,
}: {
  conversationId: string;
  assignedTo: string | null;
  assignees: Assignee[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="border-b border-brand-line px-5 py-4">
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        Assigned to
      </label>
      <select
        value={assignedTo ?? ""}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value || null;
          start(async () => {
            const r = await assignConversationAction(conversationId, v);
            if (r.ok) router.refresh();
            else toast.error(r.error);
          });
        }}
        className="w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10 disabled:opacity-60"
      >
        <option value="">Unassigned</option>
        {assignees.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Avatar & chips ──────────────────────────────────────────
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
  imageUrl = null,
}: {
  initials: string;
  size: number;
  className?: string;
  imageUrl?: string | null;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  const fontSize =
    size >= 44 ? "text-[13px]" : size >= 32 ? "text-[11px]" : "text-[10px]";
  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold ${tintFor(initials)} ${fontSize} ${className}`}
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}

function StatusChip({
  tone,
  children,
}: {
  tone: ChipTone;
  children: React.ReactNode;
}) {
  const styles: Record<ChipTone, { box: string; dot: string }> = {
    green: {
      box: "bg-[#ECFDF5] text-[#047857] border-[#C7F0DC]",
      dot: "bg-[#10B981]",
    },
    amber: {
      box: "bg-[#FFFBEB] text-[#B45309] border-[#FCE9B6]",
      dot: "bg-[#F59E0B]",
    },
    red: {
      box: "bg-[#FEF2F2] text-[#DC2626] border-[#FBD5D5]",
      dot: "bg-[#EF4444]",
    },
    indigo: {
      box: "bg-[#EEF0FF] text-[#4F46E5] border-[#D7DBFB]",
      dot: "bg-[#6366F1]",
    },
    gray: {
      box: "bg-[#F4F7F5] text-[#5B7065] border-[#E4EFE8]",
      dot: "bg-[#94A3B8]",
    },
  };
  const s = styles[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${s.box}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {children}
    </span>
  );
}

// ── Empty states ────────────────────────────────────────────
function EmptyList({
  folder,
  search,
  listingFilter,
}: {
  folder: Folder;
  search: string;
  listingFilter: string | null;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
        <InboxIcon className="h-6 w-6" />
      </div>
      <div className="font-display text-base font-semibold text-brand-ink">
        {search
          ? "Nothing matches that search"
          : listingFilter
            ? "Nothing for this listing"
            : folder === "archived" || folder === "past"
              ? "Nothing here yet"
              : folder === "unread"
                ? "You're all caught up"
                : folder === "enquiries"
                  ? "No new enquiries"
                  : "No conversations yet"}
      </div>
      <p className="mx-auto mt-1 max-w-xs text-[12.5px] text-brand-mute">
        {search
          ? "Try a different name, reference, or listing."
          : "When guests message you about a booking or enquiry, it shows up here."}
      </p>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────
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
