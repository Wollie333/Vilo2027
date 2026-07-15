import "server-only";

import type { ChatMessage } from "@/components/inbox/ChatMessageWall";
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
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Server-side loader for the guest "Looking-For" CRM record — one place that
// assembles the request, every quote/response, the conversation thread per
// host (messages + inline quote/booking cards), and a derived activity
// timeline. The record view (RequestRecord.tsx) never has to leave the page to
// compare a quote, read a host's message, accept, or pay.
// ---------------------------------------------------------------------------

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export type RecordPost = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  check_in_date: string | null;
  check_out_date: string | null;
  date_flexibility_days: number | null;
  adults: number;
  children: number | null;
  infants: number | null;
  location_text: string | null;
  location_region: string | null;
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string | null;
  budget_per: string | null;
  status: string;
  is_urgent: boolean;
  is_public: boolean;
  view_count: number;
  quote_count: number;
  created_at: string;
  updated_at: string | null;
  expires_at: string | null;
  fulfilled_via: string | null;
};

export type RecordQuote = {
  id: string;
  quoteNumber: string | null;
  totalAmount: number;
  currency: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  headcount: number | null;
  depositAmount: number | null;
  validUntil: string | null;
  notes: string | null;
  acceptToken: string | null;
  convertedBookingId: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
};

export type RecordThread = {
  conversationId: string;
  messages: ChatMessage[];
  unread: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
};

export type RecordResponse = {
  id: string;
  status: string;
  sentAt: string;
  viewedAt: string | null;
  host: {
    id: string;
    name: string;
    avatarUrl: string | null;
    bio: string | null;
  };
  quote: RecordQuote | null;
  thread: RecordThread | null;
};

export type TimelineEvent = {
  at: string;
  kind:
    | "posted"
    | "quote_received"
    | "quote_viewed"
    | "quote_accepted"
    | "quote_declined"
    | "message"
    | "fulfilled"
    | "cancelled";
  label: string;
  detail: string | null;
};

export type RequestRecordData = {
  post: RecordPost;
  responses: RecordResponse[];
  timeline: TimelineEvent[];
  // Quote/booking cards keyed by id, shared across all threads so the message
  // wall can render inline cards (same enrichment the inbox thread page does).
  quotesById: Record<string, ThreadQuote>;
  bookingsById: Record<string, ThreadBooking>;
  unreadTotal: number;
  selfId: string;
};

const POST_COLUMNS = `
  id, title, description, category, check_in_date, check_out_date,
  date_flexibility_days, adults, children, infants, location_text,
  location_region, budget_min, budget_max, budget_currency, budget_per,
  status, is_urgent, is_public, view_count, quote_count, created_at,
  updated_at, expires_at, fulfilled_via, guest_id
`;

/**
 * Load the full CRM record for one Looking-For post. Returns `null` if the post
 * doesn't exist or isn't owned by `userId` (caller decides notFound/redirect).
 */
export async function loadRequestRecord(
  postId: string,
  userId: string,
): Promise<RequestRecordData | null> {
  const supabase = createServerClient();

  const { data: postRaw } = await supabase
    .from("looking_for_posts")
    .select(POST_COLUMNS)
    .eq("id", postId)
    .maybeSingle();
  if (!postRaw) return null;
  const post = postRaw as unknown as RecordPost & { guest_id: string };
  if (post.guest_id !== userId) return null;

  // Responses (guest can read its own post's responses via RLS).
  const { data: respRaw } = await supabase
    .from("looking_for_responses")
    .select(
      `
      id, status, sent_at, viewed_at, quote_id, thread_id,
      host:hosts ( id, display_name, avatar_url, bio )
    `,
    )
    .eq("post_id", postId)
    .order("sent_at", { ascending: false });

  const responsesRaw = (respRaw ?? []) as unknown as Array<{
    id: string;
    status: string;
    sent_at: string;
    viewed_at: string | null;
    quote_id: string | null;
    thread_id: string | null;
    host:
      | {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
        }
      | {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
        }[]
      | null;
  }>;

  const admin = createAdminClient();

  // ---- Quotes (guest RLS is token-gated, so read with the admin client after
  // ownership is confirmed, scoped to this post's quote ids). ----
  const quoteIds = responsesRaw
    .map((r) => r.quote_id)
    .filter((id): id is string => !!id);
  const quoteRowById = new Map<
    string,
    {
      id: string;
      quote_number: string | null;
      total_amount: number | string | null;
      currency: string;
      status: string;
      check_in: string | null;
      check_out: string | null;
      headcount: number | null;
      deposit_amount: number | string | null;
      valid_until: string | null;
      notes: string | null;
      accept_token: string | null;
      converted_booking_id: string | null;
      accepted_at: string | null;
      declined_at: string | null;
    }
  >();
  if (quoteIds.length > 0) {
    const { data: qRows } = await admin
      .from("quotes")
      .select(
        "id, quote_number, total_amount, currency, status, check_in, check_out, headcount, deposit_amount, valid_until, notes, accept_token, converted_booking_id, accepted_at, declined_at, looking_for_post_id",
      )
      .eq("looking_for_post_id", postId)
      .in("id", quoteIds);
    for (const q of qRows ?? []) quoteRowById.set(q.id, q);
  }

  // ---- Conversation threads (guest owns them via RLS) + messages. ----
  const threadIds = responsesRaw
    .map((r) => r.thread_id)
    .filter((id): id is string => !!id);
  const threadById = new Map<string, RecordThread>();
  if (threadIds.length > 0) {
    const [{ data: convs }, { data: msgs }] = await Promise.all([
      supabase
        .from("conversations")
        .select("id, unread_guest, last_message_at, last_message_preview")
        .in("id", threadIds),
      supabase
        .from("messages")
        .select(
          "id, conversation_id, sender_id, body, attachment_url, attachment_filename, is_system_message, system_event, quote_id, quote_version_no, read_by_host, read_by_guest, created_at",
        )
        .in("conversation_id", threadIds)
        .order("created_at", { ascending: true }),
    ]);

    const msgsByConv = new Map<string, ChatMessage[]>();
    for (const m of msgs ?? []) {
      const cid = (m as { conversation_id: string }).conversation_id;
      const arr = msgsByConv.get(cid) ?? [];
      arr.push({
        id: m.id,
        senderId: m.sender_id,
        body: m.body,
        isSystem: m.is_system_message,
        systemEvent: (m as { system_event: string | null }).system_event,
        quoteId: (m as { quote_id: string | null }).quote_id,
        quoteVersionNo: (m as { quote_version_no: number | null })
          .quote_version_no,
        readByHost: (m as { read_by_host: boolean }).read_by_host,
        readByGuest: (m as { read_by_guest: boolean }).read_by_guest,
        createdAt: m.created_at,
        attachmentUrl:
          (m as { attachment_url: string | null }).attachment_url ?? null,
        attachmentFilename:
          (m as { attachment_filename: string | null }).attachment_filename ??
          null,
      });
      msgsByConv.set(cid, arr);
    }
    for (const c of convs ?? []) {
      threadById.set(c.id, {
        conversationId: c.id,
        messages: msgsByConv.get(c.id) ?? [],
        unread: (c as { unread_guest: number }).unread_guest ?? 0,
        lastMessageAt: (c as { last_message_at: string | null })
          .last_message_at,
        lastMessagePreview: (c as { last_message_preview: string | null })
          .last_message_preview,
      });
    }
  }

  // ---- Inline quote/booking cards for the message wall (mirror inbox). ----
  const quotesById: Record<string, ThreadQuote> = {};
  const bookingsById: Record<string, ThreadBooking> = {};
  const cardQuoteIds = Array.from(
    new Set(
      Array.from(threadById.values())
        .flatMap((t) => t.messages)
        .map((m) => m.quoteId)
        .filter((id): id is string => !!id),
    ),
  );
  if (cardQuoteIds.length > 0) {
    const { data: qRows } = await admin
      .from("quotes")
      .select(QUOTE_CARD_COLUMNS)
      .eq("looking_for_post_id", postId)
      .in("id", cardQuoteIds);

    // Subject cover (listing name + thumbnail) per quote.
    const propIds = Array.from(
      new Set(
        (qRows ?? [])
          .map((q) => q.property_id)
          .filter((id): id is string => !!id),
      ),
    );
    const subjectByQuote = new Map<
      string,
      { name: string | null; image: string | null; detail: string | null }
    >();
    if (propIds.length > 0) {
      const [{ data: props }, { data: coverPhotos }] = await Promise.all([
        admin.from("properties").select("id, name, city").in("id", propIds),
        admin
          .from("property_photos")
          .select("property_id, url, sort_order")
          .in("property_id", propIds)
          .is("room_id", null)
          .order("sort_order", { ascending: true }),
      ]);
      const nameById = new Map((props ?? []).map((p) => [p.id, p.name]));
      const cityById = new Map((props ?? []).map((p) => [p.id, p.city]));
      const coverById = new Map<string, string>();
      for (const ph of coverPhotos ?? [])
        if (!coverById.has(ph.property_id))
          coverById.set(ph.property_id, ph.url);
      for (const q of qRows ?? []) {
        if (!q.property_id) continue;
        subjectByQuote.set(q.id, {
          name: nameById.get(q.property_id) ?? null,
          image: coverById.get(q.property_id) ?? null,
          detail:
            q.scope === "rooms"
              ? "Specific room"
              : (cityById.get(q.property_id) ?? "Whole place"),
        });
      }
    }
    for (const q of qRows ?? []) {
      quotesById[q.id] = mapQuoteRow(q, undefined, subjectByQuote.get(q.id));
    }

    const bookingIds = Object.values(quotesById)
      .map((q) => q.convertedBookingId)
      .filter((id): id is string => !!id);
    if (bookingIds.length > 0) {
      const { data: bRows } = await admin
        .from("bookings")
        .select(BOOKING_CARD_COLUMNS)
        .in("id", bookingIds);
      for (const b of bRows ?? []) bookingsById[b.id] = mapBookingRow(b);
    }
  }

  // ---- Assemble responses. ----
  const responses: RecordResponse[] = responsesRaw.map((r) => {
    const host = one(r.host);
    const qRow = r.quote_id ? quoteRowById.get(r.quote_id) : undefined;
    const quote: RecordQuote | null = qRow
      ? {
          id: qRow.id,
          quoteNumber: qRow.quote_number,
          totalAmount: Number(qRow.total_amount ?? 0),
          currency: qRow.currency,
          status: qRow.status,
          checkIn: qRow.check_in,
          checkOut: qRow.check_out,
          headcount: qRow.headcount,
          depositAmount:
            qRow.deposit_amount != null ? Number(qRow.deposit_amount) : null,
          validUntil: qRow.valid_until,
          notes: qRow.notes,
          acceptToken: qRow.accept_token,
          convertedBookingId: qRow.converted_booking_id,
          acceptedAt: qRow.accepted_at,
          declinedAt: qRow.declined_at,
        }
      : null;
    return {
      id: r.id,
      status: r.status,
      sentAt: r.sent_at,
      viewedAt: r.viewed_at,
      host: {
        id: host?.id ?? "",
        name: host?.display_name ?? "Host",
        avatarUrl: host?.avatar_url ?? null,
        bio: host?.bio ?? null,
      },
      quote,
      thread: r.thread_id ? (threadById.get(r.thread_id) ?? null) : null,
    };
  });

  const unreadTotal = responses.reduce(
    (sum, r) => sum + (r.thread?.unread ?? 0),
    0,
  );

  // ---- Derived activity timeline (newest first). ----
  const timeline: TimelineEvent[] = [];
  timeline.push({
    at: post.created_at,
    kind: "posted",
    label: "Request posted",
    detail: null,
  });
  for (const r of responses) {
    timeline.push({
      at: r.sentAt,
      kind: "quote_received",
      label: `Quote received from ${r.host.name}`,
      detail: r.quote
        ? formatMoney(r.quote.totalAmount, r.quote.currency)
        : null,
    });
    if (r.viewedAt) {
      timeline.push({
        at: r.viewedAt,
        kind: "quote_viewed",
        label: `You viewed ${r.host.name}'s quote`,
        detail: null,
      });
    }
    if (r.quote?.acceptedAt) {
      timeline.push({
        at: r.quote.acceptedAt,
        kind: "quote_accepted",
        label: `You accepted ${r.host.name}'s quote`,
        detail: null,
      });
    }
    if (r.quote?.declinedAt) {
      timeline.push({
        at: r.quote.declinedAt,
        kind: "quote_declined",
        label: `${r.host.name}'s quote was declined`,
        detail: null,
      });
    }
  }
  if (post.status === "fulfilled") {
    timeline.push({
      at: post.updated_at ?? post.created_at,
      kind: "fulfilled",
      label: "Request marked as fulfilled",
      detail: post.fulfilled_via ? fulfilledLabel(post.fulfilled_via) : null,
    });
  } else if (post.status === "cancelled") {
    timeline.push({
      at: post.updated_at ?? post.created_at,
      kind: "cancelled",
      label: "Request cancelled",
      detail: null,
    });
  }
  timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    post,
    responses,
    timeline,
    quotesById,
    bookingsById,
    unreadTotal,
    selfId: userId,
  };
}

function fulfilledLabel(via: string): string {
  switch (via) {
    case "vilo_booking":
      return "Booked through Wielo";
    case "ota":
      return "Booked on another platform";
    case "direct":
      return "Booked directly with host";
    default:
      return "Other";
  }
}
