import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";

import type {
  ThreadBooking,
  ThreadQuote,
} from "@/components/inbox/ThreadQuoteCard";
import {
  BOOKING_CARD_COLUMNS,
  QUOTE_CARD_COLUMNS,
  mapBookingRow,
  mapQuoteRow,
} from "@/components/inbox/quote-thread";
import { createServerClient } from "@/lib/supabase/server";

import {
  InboxView,
  type ConversationRow,
  type MessageRow,
  type ThreadContext,
} from "./InboxView";

export const metadata: Metadata = {
  title: "Inbox",
};

export const dynamic = "force-dynamic";

type SearchParams = {
  c?: string;
  f?: string;
  q?: string;
  l?: string;
  p?: string;
};

const PAGE_SIZE = 25;

const PIPELINE_STAGES = [
  "new_quote",
  "quote_sent",
  "negotiating",
  "accepted",
  "declined",
  "lost",
] as const;
const VALID_FOLDERS = [
  "all",
  "unread",
  "needs_reply",
  "follow_up",
  "enquiries",
  "open",
  "archived",
  "starred",
  "booked",
  "past",
  ...PIPELINE_STAGES,
] as const;
type Folder = (typeof VALID_FOLDERS)[number];

function isPipelineStage(f: Folder): f is (typeof PIPELINE_STAGES)[number] {
  return (PIPELINE_STAGES as readonly string[]).includes(f);
}

function parseFolder(raw: string | undefined): Folder {
  if (raw && (VALID_FOLDERS as readonly string[]).includes(raw)) {
    return raw as Folder;
  }
  return "all";
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/inbox");

  const { data: host } = await supabase
    .from("hosts")
    .select("id, display_name, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!host) {
    // /dashboard/inbox is rendered in the full-bleed shell (no padding,
    // no max-w cap) so the empty state needs to bring its own framing.
    return (
      <div className="flex-1 px-5 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h1 className="font-display text-lg font-bold text-brand-ink">
              Set up your host profile first
            </h1>
            <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
              Guest messages land in your inbox once you have a listing live.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const folder = parseFolder(searchParams?.f);
  const search = (searchParams?.q ?? "").trim();
  const listingFilter = (searchParams?.l ?? "").trim() || null;
  const page = Math.max(1, Number.parseInt(searchParams?.p ?? "1", 10) || 1);

  // Counts for chips/folders. Pulling the lightweight shape for every
  // conversation lets us derive every folder count — and the paginated total
  // for the current filter — in memory, without extra round-trips.
  const nowIso = new Date().toISOString();
  const { data: countsRaw } = await supabase
    .from("conversations")
    .select(
      "id, status, is_enquiry, unread_host, pipeline_stage, follow_up_at, pinned, booking_id, listing_id",
    )
    .eq("host_id", host.id);

  const all = countsRaw ?? [];
  // Every tab / folder / pipeline-stage badge reflects UNREAD threads only (and
  // hides at zero) — a host only needs a number where something is waiting on
  // them. All badges read off the same conversations.unread_host counter, so a
  // thread marked read drops out of every badge at once.
  const isLive = (c: (typeof all)[number]) => c.status !== "archived";
  const unreadIn = (pred: (c: (typeof all)[number]) => boolean) =>
    all.filter((c) => c.unread_host > 0 && pred(c)).length;

  // Pipeline value: the latest quote total per conversation, summed by stage.
  const { data: stageQuotes } = await supabase
    .from("quotes")
    .select(
      "conversation_id, total_amount, conversation:conversations ( pipeline_stage )",
    )
    .eq("host_id", host.id)
    .not("conversation_id", "is", null)
    .order("created_at", { ascending: false });
  const seenConv = new Set<string>();
  const pipelineValue: Record<string, number> = {
    new_quote: 0,
    quote_sent: 0,
    negotiating: 0,
    accepted: 0,
    declined: 0,
    lost: 0,
  };
  for (const q of stageQuotes ?? []) {
    const cid = q.conversation_id as string | null;
    if (!cid || seenConv.has(cid)) continue;
    seenConv.add(cid);
    const conv = Array.isArray(q.conversation)
      ? q.conversation[0]
      : q.conversation;
    const stage = (conv as { pipeline_stage: string | null } | null)
      ?.pipeline_stage;
    if (stage && stage in pipelineValue) {
      pipelineValue[stage] += Number(q.total_amount ?? 0);
    }
  }

  const counts = {
    all: unreadIn(isLive),
    unread: unreadIn(isLive),
    needs_reply: unreadIn(isLive),
    follow_up: unreadIn(
      (c) => isLive(c) && c.follow_up_at != null && c.follow_up_at <= nowIso,
    ),
    enquiries: unreadIn((c) => c.is_enquiry && c.status === "open"),
    open: unreadIn((c) => c.status === "open"),
    archived: unreadIn((c) => c.status === "archived"),
    starred: unreadIn((c) => isLive(c) && c.pinned),
    booked: unreadIn((c) => isLive(c) && c.booking_id != null),
    past: unreadIn((c) => c.status === "archived"),
    unread_total: all.reduce((n, c) => n + (c.unread_host ?? 0), 0),
    pipeline: {
      new_quote: unreadIn((c) => isLive(c) && c.pipeline_stage === "new_quote"),
      quote_sent: unreadIn(
        (c) => isLive(c) && c.pipeline_stage === "quote_sent",
      ),
      negotiating: unreadIn(
        (c) => isLive(c) && c.pipeline_stage === "negotiating",
      ),
      accepted: unreadIn((c) => isLive(c) && c.pipeline_stage === "accepted"),
      declined: unreadIn((c) => isLive(c) && c.pipeline_stage === "declined"),
      lost: unreadIn((c) => isLive(c) && c.pipeline_stage === "lost"),
    },
    pipelineValue,
  };

  // Conversation list — filtered server-side.
  let query = supabase
    .from("conversations")
    .select(
      `
        id, status, is_enquiry, unread_host,
        last_message_at, last_message_preview, created_at,
        guest:user_profiles!conversations_guest_id_fkey ( id, full_name, email, avatar_url ),
        listing:listings ( id, name ),
        booking:bookings ( id, reference, status, check_in, check_out, nights, guests_count, total_amount, currency )
      `,
    )
    .eq("host_id", host.id)
    .order("pinned", { ascending: false })
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (folder === "archived" || folder === "past") {
    query = query.eq("status", "archived");
  } else {
    query = query.neq("status", "archived");
    if (folder === "open") query = query.eq("status", "open");
    if (folder === "enquiries") query = query.eq("is_enquiry", true);
    if (folder === "unread" || folder === "needs_reply")
      query = query.gt("unread_host", 0);
    if (folder === "starred") query = query.eq("pinned", true);
    if (folder === "booked") query = query.not("booking_id", "is", null);
    if (folder === "follow_up")
      query = query.not("follow_up_at", "is", null).lte("follow_up_at", nowIso);
    if (isPipelineStage(folder)) query = query.eq("pipeline_stage", folder);
  }
  if (listingFilter) query = query.eq("listing_id", listingFilter);

  // Total matching the active filter (mirrors the query above) — drives the
  // pager. Derived in memory from countsRaw so we avoid an extra count query.
  const matchesFolder = (c: (typeof all)[number]): boolean => {
    if (folder === "archived" || folder === "past") {
      if (c.status !== "archived") return false;
    } else {
      if (c.status === "archived") return false;
      if (folder === "open" && c.status !== "open") return false;
      if (folder === "enquiries" && !c.is_enquiry) return false;
      if (
        (folder === "unread" || folder === "needs_reply") &&
        !(c.unread_host > 0)
      )
        return false;
      if (folder === "starred" && !c.pinned) return false;
      if (folder === "booked" && c.booking_id == null) return false;
      if (
        folder === "follow_up" &&
        !(c.follow_up_at != null && c.follow_up_at <= nowIso)
      )
        return false;
      if (isPipelineStage(folder) && c.pipeline_stage !== folder) return false;
    }
    if (listingFilter && c.listing_id !== listingFilter) return false;
    return true;
  };
  const total = all.filter(matchesFolder).length;

  // Pagination — applied server-side when not searching. With an active search
  // we fetch a wider slice and filter in memory (below), so the pager hides.
  if (search) {
    query = query.limit(100);
  } else {
    const from = (page - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);
  }

  const { data: convRows } = await query;

  type RawConvRow = {
    id: string;
    status: string;
    is_enquiry: boolean;
    unread_host: number;
    last_message_at: string | null;
    last_message_preview: string | null;
    created_at: string;
    guest: {
      id: string;
      full_name: string | null;
      email: string | null;
      avatar_url: string | null;
    } | null;
    listing: { id: string; name: string } | null;
    booking: {
      id: string;
      reference: string;
      status: string;
      check_in: string | null;
      check_out: string | null;
      nights: number | null;
      guests_count: number | null;
      total_amount: string | number | null;
      currency: string;
    } | null;
  };

  const rawConversations = (convRows ?? []) as unknown as RawConvRow[];

  // Light search across what we've loaded.
  const needle = search.toLowerCase();
  const filtered = needle
    ? rawConversations.filter((c) => {
        const name = c.guest?.full_name?.toLowerCase() ?? "";
        const email = c.guest?.email?.toLowerCase() ?? "";
        const listing = c.listing?.name?.toLowerCase() ?? "";
        const ref = c.booking?.reference?.toLowerCase() ?? "";
        const preview = c.last_message_preview?.toLowerCase() ?? "";
        return (
          name.includes(needle) ||
          email.includes(needle) ||
          listing.includes(needle) ||
          ref.includes(needle) ||
          preview.includes(needle)
        );
      })
    : rawConversations;

  const conversations: ConversationRow[] = filtered.map((c) => ({
    id: c.id,
    status: c.status as "open" | "resolved" | "archived",
    isEnquiry: c.is_enquiry,
    unreadCount: c.unread_host ?? 0,
    lastMessageAt: c.last_message_at,
    lastMessagePreview: c.last_message_preview,
    createdAt: c.created_at,
    guestId: c.guest?.id ?? null,
    guestName: c.guest?.full_name ?? null,
    guestEmail: c.guest?.email ?? null,
    listingName: c.listing?.name ?? null,
    bookingReference: c.booking?.reference ?? null,
    bookingStatus: c.booking?.status ?? null,
    checkIn: c.booking?.check_in ?? null,
    checkOut: c.booking?.check_out ?? null,
  }));

  // Resolve selected conversation. The Classic layout is a view switch (list
  // OR thread), so we only open a thread when one is explicitly requested —
  // no auto-selecting the first row.
  const requested = searchParams?.c;
  const selectedId =
    (requested && conversations.find((c) => c.id === requested)?.id) ?? null;

  // Thread + context.
  let messages: MessageRow[] = [];
  let context: ThreadContext | null = null;
  const quotesById: Record<string, ThreadQuote> = {};
  const bookingsById: Record<string, ThreadBooking> = {};

  if (selectedId) {
    const [{ data: msgs }, { data: ctxRaw }] = await Promise.all([
      supabase
        .from("messages")
        .select(
          "id, sender_id, body, attachment_url, attachment_type, attachment_filename, is_system_message, system_event, quote_id, read_by_host, read_by_guest, read_at, created_at",
        )
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true }),
      supabase
        .from("conversations")
        .select(
          `
            id, status, is_enquiry, pipeline_stage, pinned, follow_up_at, assigned_to, created_at,
            guest:user_profiles!conversations_guest_id_fkey ( id, full_name, email, phone, avatar_url ),
            listing:listings ( id, name, slug, city, province, max_guests, bedrooms ),
            booking:bookings ( id, reference, status, check_in, check_out, nights, guests_count, total_amount, currency )
          `,
        )
        .eq("id", selectedId)
        .maybeSingle(),
    ]);

    // Latest quote on this thread (for the inbox quote card).
    const { data: quoteRow } = await supabase
      .from("quotes")
      .select("id, status, quote_number, total_amount, currency, valid_until")
      .eq("conversation_id", selectedId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Quote open-tracking (seen receipt) + host-only internal notes.
    let quoteSeen = { count: 0, lastViewedAt: null as string | null };
    if (quoteRow) {
      const { data: views, count } = await supabase
        .from("quote_view_events")
        .select("opened_at", { count: "exact" })
        .eq("quote_id", quoteRow.id)
        .order("opened_at", { ascending: false })
        .limit(1);
      quoteSeen = {
        count: count ?? 0,
        lastViewedAt: views?.[0]?.opened_at ?? null,
      };
    }

    const { data: noteRows } = await supabase
      .from("conversation_notes")
      .select("id, body, created_at, author:user_profiles ( full_name )")
      .eq("conversation_id", selectedId)
      .order("created_at", { ascending: true });
    const notes = (noteRows ?? []).map((n) => {
      const a = Array.isArray(n.author) ? n.author[0] : n.author;
      return {
        id: n.id,
        body: n.body,
        authorName:
          (a as { full_name: string | null } | null)?.full_name ?? "You",
        createdAt: n.created_at,
      };
    });

    messages = (msgs ?? []).map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      body: m.body,
      attachmentUrl: m.attachment_url,
      attachmentType: m.attachment_type as "image" | "pdf" | "other" | null,
      attachmentFilename: m.attachment_filename,
      isSystem: m.is_system_message,
      systemEvent: m.system_event,
      quoteId: (m as { quote_id: string | null }).quote_id ?? null,
      readByHost: m.read_by_host,
      readByGuest: m.read_by_guest,
      createdAt: m.created_at,
    }));

    // Quotes referenced by thread messages → rendered inline as quote cards
    // that reflect each quote's live state (draft request → sent quote).
    const quoteIds = Array.from(
      new Set(
        (msgs ?? [])
          .map((m) => (m as { quote_id: string | null }).quote_id)
          .filter((id): id is string => !!id),
      ),
    );
    if (quoteIds.length > 0) {
      const { data: qRows } = await supabase
        .from("quotes")
        .select(QUOTE_CARD_COLUMNS)
        .in("id", quoteIds);
      const { data: viewRows } = await supabase
        .from("quote_view_events")
        .select("quote_id, opened_at")
        .in("quote_id", quoteIds);
      const seenBy = new Map<string, { count: number; last: string | null }>();
      for (const v of viewRows ?? []) {
        const cur = seenBy.get(v.quote_id) ?? { count: 0, last: null };
        cur.count += 1;
        if (!cur.last || v.opened_at > cur.last) cur.last = v.opened_at;
        seenBy.set(v.quote_id, cur);
      }
      for (const q of qRows ?? []) {
        quotesById[q.id] = mapQuoteRow(q, seenBy.get(q.id));
      }

      // Bookings the quotes became (once accepted) → later card states.
      const bookingIds = Object.values(quotesById)
        .map((q) => q.convertedBookingId)
        .filter((id): id is string => !!id);
      if (bookingIds.length > 0) {
        const { data: bRows } = await supabase
          .from("bookings")
          .select(BOOKING_CARD_COLUMNS)
          .in("id", bookingIds);
        for (const b of bRows ?? []) {
          bookingsById[b.id] = mapBookingRow(b);
        }
      }
    }

    const ctx = ctxRaw as unknown as {
      id: string;
      status: string;
      is_enquiry: boolean;
      pipeline_stage: string | null;
      pinned: boolean;
      follow_up_at: string | null;
      assigned_to: string | null;
      created_at: string;
      guest: {
        id: string;
        full_name: string | null;
        email: string | null;
        phone: string | null;
        avatar_url: string | null;
      } | null;
      listing: {
        id: string;
        name: string;
        slug: string | null;
        city: string | null;
        province: string | null;
        max_guests: number | null;
        bedrooms: number | null;
      } | null;
      booking: {
        id: string;
        reference: string;
        status: string;
        check_in: string | null;
        check_out: string | null;
        nights: number | null;
        guests_count: number | null;
        total_amount: string | number | null;
        currency: string;
      } | null;
    } | null;

    if (ctx) {
      context = {
        conversationId: ctx.id,
        status: ctx.status as "open" | "resolved" | "archived",
        isEnquiry: ctx.is_enquiry,
        createdAt: ctx.created_at,
        guest: ctx.guest
          ? {
              id: ctx.guest.id,
              fullName: ctx.guest.full_name,
              email: ctx.guest.email,
              phone: ctx.guest.phone,
              avatarUrl: ctx.guest.avatar_url,
            }
          : null,
        listing: ctx.listing
          ? {
              id: ctx.listing.id,
              name: ctx.listing.name,
              slug: ctx.listing.slug,
              city: ctx.listing.city,
              province: ctx.listing.province,
              maxGuests: ctx.listing.max_guests,
              bedrooms: ctx.listing.bedrooms,
            }
          : null,
        booking: ctx.booking
          ? {
              id: ctx.booking.id,
              reference: ctx.booking.reference,
              status: ctx.booking.status,
              checkIn: ctx.booking.check_in,
              checkOut: ctx.booking.check_out,
              nights: ctx.booking.nights,
              guests: ctx.booking.guests_count,
              total:
                ctx.booking.total_amount == null
                  ? null
                  : Number(ctx.booking.total_amount),
              currency: ctx.booking.currency,
            }
          : null,
        pinned: ctx.pinned ?? false,
        followUpAt: ctx.follow_up_at ?? null,
        assignedTo: ctx.assigned_to ?? null,
        pipelineStage:
          (ctx.pipeline_stage as
            | "new_quote"
            | "quote_sent"
            | "negotiating"
            | "accepted"
            | "declined"
            | "lost"
            | null) ?? null,
        quote: quoteRow
          ? {
              id: quoteRow.id,
              status: quoteRow.status,
              quoteNumber: (quoteRow.quote_number as string | null) ?? null,
              total: Number(quoteRow.total_amount),
              currency: quoteRow.currency,
              validUntil: (quoteRow.valid_until as string | null) ?? null,
              viewCount: quoteSeen.count,
              lastViewedAt: quoteSeen.lastViewedAt,
            }
          : null,
        notes,
      };
    }
  }

  // Canned replies — the host's saved message templates, shown as quick-reply
  // chips in the composer.
  const { data: templateRows } = await supabase
    .from("message_templates")
    .select("id, title, body")
    .eq("host_id", host.id)
    .order("sort_order", { ascending: true });
  const templates = templateRows ?? [];

  // Host listings — power the dot-marked listing filters in the folder rail.
  const { data: listingRows } = await supabase
    .from("listings")
    .select("id, name")
    .eq("host_id", host.id)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  const listings = (listingRows ?? []) as { id: string; name: string }[];

  // Assignable team members (the host + their staff) for the assignee picker.
  const { data: staffRows } = await supabase
    .from("staff_members")
    .select("user_id, user:user_profiles ( full_name )")
    .eq("host_id", host.id);
  const assignees = [
    { id: user.id, name: `${host.display_name} (you)` },
    ...(staffRows ?? []).map((s) => {
      const u = Array.isArray(s.user) ? s.user[0] : s.user;
      return {
        id: s.user_id as string,
        name:
          (u as { full_name: string | null } | null)?.full_name ??
          "Team member",
      };
    }),
  ];

  const hostInitials =
    (host.display_name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s: string) => s[0]?.toUpperCase() ?? "")
      .join("") || "ME";

  return (
    <InboxView
      hostInitials={hostInitials}
      hostName={host.display_name}
      hostAvatarUrl={host.avatar_url ?? null}
      selfUserId={user.id}
      folder={folder}
      counts={counts}
      search={search}
      listings={listings}
      listingFilter={listingFilter}
      page={page}
      pageSize={PAGE_SIZE}
      total={total}
      conversations={conversations}
      selectedId={selectedId}
      messages={messages}
      context={context}
      quotesById={quotesById}
      bookingsById={bookingsById}
      templates={templates}
      assignees={assignees}
    />
  );
}
