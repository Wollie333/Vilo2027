"use client";

import {
  Archive,
  ArchiveRestore,
  BadgeCheck,
  Copy,
  CreditCard,
  ExternalLink,
  Phone,
  ReceiptText,
  Send,
  Star,
  X,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { ChatComposer } from "@/components/inbox/ChatComposer";
import {
  ChatMessageWall,
  type ChatMessage,
} from "@/components/inbox/ChatMessageWall";
import { ChatThreadHeader } from "@/components/inbox/ChatThreadHeader";
import {
  ConversationList,
  ConversationRow as ConversationRowCard,
  type ChatChipTone,
} from "@/components/inbox/ConversationList";
import { InboxAvatar } from "@/components/inbox/InboxAvatar";
import type {
  ThreadBooking,
  ThreadQuote,
} from "@/components/inbox/ThreadQuoteCard";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

import {
  archiveConversationAction,
  markConversationReadAction,
  sendMessageAction,
  sendPayLinkToThreadAction,
  togglePinAction,
  touchInboxSeenAction,
  unarchiveConversationAction,
} from "./actions";

export type ConversationRow = {
  id: string;
  status: "open" | "resolved" | "archived";
  isEnquiry: boolean;
  source: string | null;
  unreadCount: number;
  pinned: boolean;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
  guestId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestAvatarUrl: string | null;
  listingId: string | null;
  listingName: string | null;
  bookingStatus: string | null;
  checkIn: string | null;
};

export type MessageRow = ChatMessage;

export type ThreadContext = {
  conversationId: string;
  status: "open" | "resolved" | "archived";
  isEnquiry: boolean;
  pinned: boolean;
  guestLastSeenAt: string | null;
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
    balanceDue: number | null;
    paymentStatus: string | null;
    payToken: string | null;
    currency: string;
  } | null;
};

export type TemplateRow = { id: string; title: string; body: string };
export type ListingRef = { id: string; name: string };

type Filter = "all" | "unread" | "enquiries" | "archived";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "enquiries", label: "Enquiries" },
  { key: "archived", label: "Archived" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Status chip for a conversation row / thread header.
function chipFor(c: {
  isEnquiry: boolean;
  source: string | null;
  status: string;
  bookingStatus: string | null;
}): { tone: ChatChipTone; label: string } | null {
  if (c.status === "archived") return { tone: "neutral", label: "Archived" };
  // A website contact-form enquiry — distinct sky chip from a quote enquiry.
  if (c.source === "website") return { tone: "sky", label: "Website" };
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
  selfUserId,
  initialFilter,
  conversations,
  listings,
  selectedId,
  messages,
  context,
  quotesById,
  bookingsById,
  templates,
}: {
  hostInitials: string;
  hostName: string;
  hostAvatarUrl: string | null;
  selfUserId: string;
  initialFilter: Filter;
  conversations: ConversationRow[];
  listings: ListingRef[];
  selectedId: string | null;
  messages: MessageRow[];
  context: ThreadContext | null;
  quotesById: Record<string, ThreadQuote>;
  bookingsById: Record<string, ThreadBooking>;
  templates: TemplateRow[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [q, setQ] = useState("");
  const [listingId, setListingId] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const threadOpen = Boolean(context);

  // Mark the open thread read.
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId) return;
    if (markedRef.current === selectedId) return;
    const sel = conversations.find((c) => c.id === selectedId);
    markedRef.current = selectedId;
    if (!sel || sel.unreadCount === 0) return;
    void markConversationReadAction(selectedId).then((r) => {
      if (!r.ok) toast.error(r.error);
    });
  }, [selectedId, conversations]);

  // Close the drawer whenever the open thread changes; Escape also closes it.
  useEffect(() => setDrawerOpen(false), [selectedId]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Mark the host "online" so the guest's messages flip to delivered.
  useEffect(() => {
    void touchInboxSeenAction();
  }, []);

  // Realtime: soft-refresh on any messages/conversations change.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("inbox-host")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          void touchInboxSeenAction();
          router.refresh();
        },
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

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "archived") {
        if (c.status !== "archived") return false;
      } else {
        if (c.status === "archived") return false;
        if (filter === "unread" && c.unreadCount === 0) return false;
        if (filter === "enquiries" && !c.isEnquiry) return false;
      }
      if (listingId && c.listingId !== listingId) return false;
      if (
        needle &&
        !`${c.guestName ?? ""} ${c.guestEmail ?? ""} ${c.listingName ?? ""} ${c.lastMessagePreview ?? ""}`
          .toLowerCase()
          .includes(needle)
      )
        return false;
      return true;
    });
  }, [conversations, filter, q, listingId]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* List pane — persists on lg, hidden on mobile when a thread is open. */}
      <aside
        className={`min-h-0 w-full shrink-0 flex-col border-r border-brand-line lg:flex lg:w-[360px] ${
          threadOpen ? "hidden lg:flex" : "flex"
        }`}
      >
        <ConversationList
          title="Inbox"
          search={q}
          onSearchChange={setQ}
          searchPlaceholder="Search guests, listings, refs…"
          filters={FILTERS}
          activeFilter={filter}
          onFilterChange={setFilter}
          isEmpty={shown.length === 0}
          emptyText={
            conversations.length === 0
              ? "When guests message you about a booking or enquiry, it shows up here."
              : "No conversations match."
          }
          extraHeader={
            listings.length > 1 ? (
              <div className="mt-2.5">
                <select
                  value={listingId}
                  onChange={(e) => setListingId(e.target.value)}
                  className="w-full rounded-pill border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
                >
                  <option value="">All listings</option>
                  {listings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null
          }
        >
          {shown.map((c) => {
            const chip = chipFor(c);
            return (
              <ConversationRowCard
                key={c.id}
                href={`/dashboard/inbox?c=${c.id}`}
                active={c.id === selectedId}
                name={c.guestName || c.guestEmail || "Guest"}
                avatarUrl={c.guestAvatarUrl}
                chip={chip}
                listingName={c.listingName}
                preview={c.lastMessagePreview}
                lastAt={c.lastMessageAt ?? c.createdAt}
                unread={c.unreadCount}
              />
            );
          })}
        </ConversationList>
      </aside>

      {/* Thread pane. */}
      <div
        className={`relative min-h-0 min-w-0 flex-1 flex-col bg-[#E6EFE9] ${
          threadOpen ? "flex" : "hidden lg:flex"
        }`}
      >
        {context ? (
          <ThreadPane
            context={context}
            messages={messages}
            quotesById={quotesById}
            bookingsById={bookingsById}
            selfUserId={selfUserId}
            templates={templates}
            onOpenDetails={() => setDrawerOpen(true)}
          />
        ) : (
          <div className="flex h-full flex-1 items-center justify-center p-8 text-center">
            <div className="max-w-xs">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-brand-primary shadow-sm">
                <ReceiptText className="h-6 w-6" />
              </div>
              <p className="font-display text-[15px] font-bold text-brand-ink">
                Your inbox
              </p>
              <p className="mt-1 text-[13px] text-brand-mute">
                Pick a conversation on the left to read and reply.
              </p>
            </div>
          </div>
        )}

        {context ? (
          <DetailsDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            context={context}
          />
        ) : null}
      </div>
    </div>
  );
}

// ── Thread pane ─────────────────────────────────────────────
function ThreadPane({
  context,
  messages,
  quotesById,
  bookingsById,
  selfUserId,
  templates,
  onOpenDetails,
}: {
  context: ThreadContext;
  messages: MessageRow[];
  quotesById: Record<string, ThreadQuote>;
  bookingsById: Record<string, ThreadBooking>;
  selfUserId: string;
  templates: TemplateRow[];
  onOpenDetails: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const archived = context.status === "archived";

  const subtitleParts = [
    context.listing?.name ?? null,
    context.booking?.checkIn
      ? `${fmtDate(context.booking.checkIn)} – ${fmtDate(context.booking.checkOut)}`
      : null,
    context.booking?.guests
      ? `${context.booking.guests} ${context.booking.guests === 1 ? "guest" : "guests"}`
      : null,
  ].filter(Boolean) as string[];

  function act(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    ok?: string,
  ) {
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Something went wrong.");
      else {
        if (ok) toast.success(ok);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <ChatThreadHeader
        name={context.guest?.fullName || context.guest?.email || "Guest"}
        subtitle={subtitleParts.join(" · ") || null}
        avatarUrl={context.guest?.avatarUrl ?? null}
        onBack={() => router.push("/dashboard/inbox")}
        rightSlot={
          <>
            <HeaderBtn
              title={context.pinned ? "Unpin" : "Pin to top"}
              onClick={() =>
                act(() =>
                  togglePinAction(context.conversationId, !context.pinned),
                )
              }
              active={context.pinned}
              disabled={pending}
            >
              <Star
                className={`h-[18px] w-[18px] ${context.pinned ? "fill-current" : ""}`}
              />
            </HeaderBtn>
            <HeaderBtn
              title={archived ? "Unarchive" : "Archive"}
              onClick={() =>
                act(
                  () =>
                    archived
                      ? unarchiveConversationAction(context.conversationId)
                      : archiveConversationAction(context.conversationId),
                  archived ? "Unarchived" : "Archived",
                )
              }
              disabled={pending}
            >
              {archived ? (
                <ArchiveRestore className="h-[18px] w-[18px]" />
              ) : (
                <Archive className="h-[18px] w-[18px]" />
              )}
            </HeaderBtn>
            <button
              type="button"
              onClick={onOpenDetails}
              className="ml-1 inline-flex h-9 items-center gap-2 rounded-full border border-brand-line px-3.5 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
            >
              <ReceiptText className="h-4 w-4 text-brand-primary" />
              <span className="hidden sm:inline">
                {context.booking ? "Booking" : "Details"}
              </span>
            </button>
          </>
        }
      />

      <ChatMessageWall
        messages={messages}
        selfId={selfUserId}
        viewer="host"
        quotesById={quotesById}
        bookingsById={bookingsById}
        otherLastSeenAt={context.guestLastSeenAt}
        emptyText="No messages yet. Send the first reply below."
      />

      <ChatComposer
        placeholder={`Reply to ${context.guest?.fullName?.split(" ")[0] ?? "guest"}…`}
        quickReplies={templates}
        manageHref="/dashboard/inbox/templates"
        onSend={async (text) => {
          const res = await sendMessageAction({
            conversation_id: context.conversationId,
            body: text,
          });
          if (res.ok) {
            router.refresh();
            return true;
          }
          toast.error(res.error);
          return false;
        }}
      />
    </div>
  );
}

function HeaderBtn({
  title,
  onClick,
  disabled,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
        active
          ? "text-status-pending"
          : "text-brand-mute hover:bg-brand-light hover:text-brand-ink"
      }`}
    >
      {children}
    </button>
  );
}

// ── Slide-over booking-context drawer ───────────────────────
function DetailsDrawer({
  open,
  onClose,
  context,
}: {
  open: boolean;
  onClose: () => void;
  context: ThreadContext;
}) {
  const refLabel = context.booking
    ? "Vilo booking"
    : context.isEnquiry
      ? "Vilo enquiry"
      : "Vilo conversation";
  const refValue =
    context.booking?.reference ??
    `VILO-${context.conversationId.slice(0, 8).toUpperCase()}`;

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
      <div
        onClick={onClose}
        className={`absolute inset-0 z-40 bg-[rgba(5,46,31,.32)] transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
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
            <div className="mt-0.5 font-mono text-[11px] text-brand-ink">
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
          {/* Listing card */}
          {context.listing ? (
            <div className="px-5 pb-5 pt-5">
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
                  <DrawerRow label="Nights">{context.booking.nights}</DrawerRow>
                ) : null}
                {context.booking.guests ? (
                  <DrawerRow label="Guests">{context.booking.guests}</DrawerRow>
                ) : null}
                <DrawerRow label="Total">
                  <span className="font-display font-bold text-brand-ink">
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

              <PayLinkSection
                conversationId={context.conversationId}
                booking={context.booking}
              />
            </div>
          ) : null}

          {/* Guest */}
          <div className="px-5 pb-6">
            <DrawerHeading>Guest</DrawerHeading>
            <div className="flex items-center gap-3 py-1">
              <InboxAvatar
                name={
                  context.guest?.fullName ?? context.guest?.email ?? "Guest"
                }
                imageUrl={context.guest?.avatarUrl ?? null}
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
        </div>
      </aside>
    </>
  );
}

// Pay-now link for the linked booking: lets the host drop the secure payment
// link straight into the chat, or copy it. Only shows while there's an
// outstanding balance on a payable booking.
function PayLinkSection({
  conversationId,
  booking,
}: {
  conversationId: string;
  booking: NonNullable<ThreadContext["booking"]>;
}) {
  const [sending, start] = useTransition();
  const balance = booking.balanceDue ?? 0;
  const dead =
    booking.status.startsWith("cancelled") ||
    ["declined", "expired", "no_show"].includes(booking.status);
  if (!booking.payToken || dead || balance <= 0) return null;

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/pay/${booking.payToken}`
      : `/pay/${booking.payToken}`;

  function send() {
    start(async () => {
      const r = await sendPayLinkToThreadAction(conversationId);
      if (r.ok) toast.success("Payment link sent in the chat.");
      else toast.error(r.error);
    });
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Payment link copied.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  return (
    <div className="mt-4 rounded-card border border-brand-line bg-brand-light/40 p-3.5">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-brand-ink">
        <CreditCard className="h-4 w-4 text-brand-primary" />
        {formatMoney(balance, booking.currency)} due
      </div>
      <p className="mt-1 text-[11.5px] text-brand-mute">
        Send the guest a secure link to pay and confirm this booking.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-primary text-[12.5px] font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
        >
          <Send className="h-3.5 w-3.5" />
          {sending ? "Sending…" : "Send in chat"}
        </button>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-brand-line bg-white px-3 text-[12.5px] font-medium text-brand-ink hover:bg-brand-light"
        >
          <Copy className="h-3.5 w-3.5 text-brand-mute" /> Copy
        </button>
      </div>
    </div>
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
