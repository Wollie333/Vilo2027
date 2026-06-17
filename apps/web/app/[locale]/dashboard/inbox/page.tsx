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
  type ListingRef,
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
};

// How many conversations to load into the list. The inbox is a chat centre, not
// a CRM table — search + filters work over this client-side slice, newest first
// (pinned floated to the top), which is plenty for the message-centre UX.
const LIST_LIMIT = 200;

type Filter = "all" | "unread" | "enquiries" | "archived";

function parseFilter(raw: string | undefined): Filter {
  if (raw === "enquiries") return "enquiries";
  if (raw === "unread") return "unread";
  if (raw === "archived") return "archived";
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

  const initialFilter = parseFilter(searchParams?.f);

  // Conversation list — newest first, pinned floated up. Filtering/search runs
  // client-side over this slice (the inbox is a chat centre, not a table).
  const { data: convRows } = await supabase
    .from("conversations")
    .select(
      `
        id, status, is_enquiry, unread_host, pinned,
        last_message_at, last_message_preview, created_at,
        listing_id,
        guest:user_profiles!conversations_guest_id_fkey ( id, full_name, email, avatar_url ),
        listing:properties ( id, name ),
        booking:bookings ( id, reference, status, check_in, check_out )
      `,
    )
    .eq("host_id", host.id)
    .order("pinned", { ascending: false })
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  type RawConvRow = {
    id: string;
    status: string;
    is_enquiry: boolean;
    unread_host: number;
    pinned: boolean;
    last_message_at: string | null;
    last_message_preview: string | null;
    created_at: string;
    listing_id: string | null;
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
    } | null;
  };

  const rawConversations = (convRows ?? []) as unknown as RawConvRow[];

  const conversations: ConversationRow[] = rawConversations.map((c) => ({
    id: c.id,
    status: c.status as "open" | "resolved" | "archived",
    isEnquiry: c.is_enquiry,
    unreadCount: c.unread_host ?? 0,
    pinned: c.pinned ?? false,
    lastMessageAt: c.last_message_at,
    lastMessagePreview: c.last_message_preview,
    createdAt: c.created_at,
    guestId: c.guest?.id ?? null,
    guestName: c.guest?.full_name ?? null,
    guestEmail: c.guest?.email ?? null,
    guestAvatarUrl: c.guest?.avatar_url ?? null,
    listingId: c.listing?.id ?? c.listing_id ?? null,
    listingName: c.listing?.name ?? null,
    bookingStatus: c.booking?.status ?? null,
    checkIn: c.booking?.check_in ?? null,
  }));

  // Resolve the selected conversation (?c=). The two-pane shell shows the list
  // until a thread is opened, then the thread on the right.
  const requested = searchParams?.c;
  const selectedId =
    (requested && conversations.find((c) => c.id === requested)?.id) ?? null;

  let messages: MessageRow[] = [];
  let context: ThreadContext | null = null;
  const quotesById: Record<string, ThreadQuote> = {};
  const bookingsById: Record<string, ThreadBooking> = {};

  if (selectedId) {
    const [{ data: msgs }, { data: ctxRaw }] = await Promise.all([
      supabase
        .from("messages")
        .select(
          "id, sender_id, body, attachment_url, attachment_type, attachment_filename, is_system_message, system_event, quote_id, quote_version_no, read_by_host, read_by_guest, read_at, created_at",
        )
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true }),
      supabase
        .from("conversations")
        .select(
          `
            id, status, is_enquiry, pinned, created_at, guest_last_seen_at,
            guest:user_profiles!conversations_guest_id_fkey ( id, full_name, email, phone, avatar_url ),
            listing:properties ( id, name, slug, city, province, max_guests, bedrooms ),
            booking:bookings ( id, reference, status, check_in, check_out, nights, guests_count, total_amount, balance_due, payment_status, pay_token, currency )
          `,
        )
        .eq("id", selectedId)
        .maybeSingle(),
    ]);

    messages = (msgs ?? []).map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      body: m.body,
      attachmentUrl: m.attachment_url,
      attachmentFilename: m.attachment_filename,
      isSystem: m.is_system_message,
      systemEvent: m.system_event,
      quoteId: (m as { quote_id: string | null }).quote_id ?? null,
      quoteVersionNo:
        (m as { quote_version_no: number | null }).quote_version_no ?? null,
      readByHost: m.read_by_host,
      readByGuest: m.read_by_guest,
      createdAt: m.created_at,
    }));

    // Quotes referenced by thread messages → rendered inline as quote cards.
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
      pinned: boolean;
      created_at: string;
      guest_last_seen_at: string | null;
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
        balance_due: string | number | null;
        payment_status: string | null;
        pay_token: string | null;
        currency: string;
      } | null;
    } | null;

    if (ctx) {
      context = {
        conversationId: ctx.id,
        status: ctx.status as "open" | "resolved" | "archived",
        isEnquiry: ctx.is_enquiry,
        pinned: ctx.pinned ?? false,
        guestLastSeenAt: ctx.guest_last_seen_at ?? null,
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
              balanceDue:
                ctx.booking.balance_due == null
                  ? null
                  : Number(ctx.booking.balance_due),
              paymentStatus: ctx.booking.payment_status,
              payToken: ctx.booking.pay_token,
              currency: ctx.booking.currency,
            }
          : null,
      };
    }
  }

  // Canned replies — the host's saved message templates (quick-reply chips).
  const { data: templateRows } = await supabase
    .from("message_templates")
    .select("id, title, body")
    .eq("host_id", host.id)
    .order("sort_order", { ascending: true });
  const templates = templateRows ?? [];

  // Host listings — power the listing filter in the list header.
  const { data: listingRows } = await supabase
    .from("properties")
    .select("id, name")
    .eq("host_id", host.id)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  const listings = (listingRows ?? []) as ListingRef[];

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
      initialFilter={initialFilter}
      conversations={conversations}
      listings={listings}
      selectedId={selectedId}
      messages={messages}
      context={context}
      quotesById={quotesById}
      bookingsById={bookingsById}
      templates={templates}
    />
  );
}
