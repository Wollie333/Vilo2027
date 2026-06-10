import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { fetchHostTransactions, type Txn } from "@/lib/finance/transactions";
import {
  fetchRequestableReviews,
  type RequestableReview,
} from "@/lib/reviews/eligible";
import { reviewPhotoUrl } from "@/lib/reviews/photos";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  GuestRecord,
  type BookingItem,
  type GuestRecordData,
  type MessageItem,
  type NoteItem,
  type QuoteItem,
  type ReviewItem,
  type TemplateItem,
} from "./GuestRecord";

export const dynamic = "force-dynamic";

// Pre-formats a stay month ("Sept 2025") for the review card; mirrors the
// Reviews dashboard's stayMonth.
function reviewMonth(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-ZA", { month: "short", year: "numeric" });
}

export const metadata: Metadata = {
  title: "Guest",
};

type RawListing = {
  name: string;
  listing_photos: { url: string; sort_order: number }[] | null;
};
type RawBooking = {
  id: string;
  reference: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  guests_count: number;
  total_amount: number;
  balance_due: number | null;
  currency: string;
  channel: string | null;
  created_at: string;
  special_requests: string | null;
  listing: RawListing | null;
};

export default async function GuestRecordPage({
  params,
}: {
  params: { gkey: string };
}) {
  const gkey = decodeURIComponent(params.gkey);
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/guests/${gkey}`);

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!host) notFound();

  const { data: recordData } = await supabase.rpc("fetch_guest_record", {
    p_host_id: host.id,
    p_gkey: gkey,
  });
  const record = recordData as (GuestRecordData & { error?: string }) | null;
  if (!record || record.error) notFound();

  const guestId = record.guest_id;
  const email = record.email?.toLowerCase() ?? null;

  // Merge-rule booking query: registered id OR same-email manual bookings.
  let bookingQuery = supabase
    .from("bookings")
    .select(
      "id, reference, status, check_in, check_out, nights, guests_count, total_amount, balance_due, currency, channel, created_at, special_requests, listing:listings ( name, listing_photos ( url, sort_order ) )",
    )
    .eq("host_id", host.id)
    .is("deleted_at", null)
    .order("check_in", { ascending: false, nullsFirst: false });

  if (guestId && email) {
    bookingQuery = bookingQuery.or(
      `guest_id.eq.${guestId},and(guest_id.is.null,guest_email.ilike.${email})`,
    );
  } else if (guestId) {
    bookingQuery = bookingQuery.eq("guest_id", guestId);
  } else if (email) {
    bookingQuery = bookingQuery
      .is("guest_id", null)
      .ilike("guest_email", email);
  } else {
    bookingQuery = bookingQuery.eq(
      "id",
      "00000000-0000-0000-0000-000000000000",
    );
  }

  const { data: rawBookings } = await bookingQuery;
  const bookingsRaw = (rawBookings ?? []) as unknown as RawBooking[];

  const bookings: BookingItem[] = bookingsRaw.map((b) => {
    const photos = b.listing?.listing_photos ?? [];
    const thumb =
      photos.length > 0
        ? [...photos].sort((a, c) => a.sort_order - c.sort_order)[0].url
        : null;
    return {
      id: b.id,
      reference: b.reference,
      status: b.status,
      checkIn: b.check_in,
      checkOut: b.check_out,
      nights: b.nights,
      guestsCount: b.guests_count,
      totalAmount: Number(b.total_amount),
      balanceDue: Number(b.balance_due ?? 0),
      currency: b.currency,
      channel: b.channel,
      createdAt: b.created_at,
      specialRequests: b.special_requests,
      listingName: b.listing?.name ?? "Listing",
      listingThumb: thumb,
    };
  });

  // Listing id → name map (for reviews + quotes that reference a listing directly).
  const { data: listingRows } = await supabase
    .from("listings")
    .select("id, name, featured_review_id")
    .eq("host_id", host.id);
  const listingNames = new Map<string, string>(
    (listingRows ?? []).map((l) => [l.id, l.name]),
  );
  const featuredReviewIds = new Set(
    (listingRows ?? [])
      .map((l) => l.featured_review_id)
      .filter((id): id is string => Boolean(id)),
  );

  // Reviews this guest has left — matched by their bookings (not guest_id), so
  // account-less manual guests' reviews show too.
  const guestBookingIds = bookings.map((b) => b.id);
  let reviews: ReviewItem[] = [];
  if (guestBookingIds.length > 0) {
    const { data: rv } = await supabase
      .from("reviews")
      .select(
        `id, rating, body, created_at, listing_id,
         host_response, host_responded_at, flagged,
         booking:bookings ( nights, check_in ),
         photos:review_photos ( storage_path, sort_order )`,
      )
      .eq("host_id", host.id)
      .in("booking_id", guestBookingIds)
      .order("created_at", { ascending: false });
    reviews = (rv ?? []).map((r) => {
      const booking = Array.isArray(r.booking) ? r.booking[0] : r.booking;
      return {
        id: r.id,
        rating: r.rating,
        body: r.body,
        createdAt: r.created_at,
        hostResponse: r.host_response,
        hostRespondedAt: r.host_responded_at,
        flagged: r.flagged,
        listingName: listingNames.get(r.listing_id) ?? "Listing",
        nights: booking?.nights ?? null,
        stayMonth: reviewMonth(booking?.check_in ?? null),
        photos: (r.photos ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((p) => reviewPhotoUrl(p.storage_path)),
        isFeatured: featuredReviewIds.has(r.id),
      };
    });
  }

  // Qualifying stays this guest can still be asked to review — matched by their
  // account and/or email, so account-less manual guests are included.
  const requestableReviews: RequestableReview[] =
    guestId || record.email
      ? await fetchRequestableReviews(supabase, {
          hostId: host.id,
          guestId,
          guestEmail: record.email,
        })
      : [];

  // Finances — every money event for this guest, normalised from the ONE
  // transaction source so the Finances tab, the account-wide Ledger and the
  // booking Payments tab always agree. Host-scoped admin read filtered by gkey.
  const admin = createAdminClient();
  const txns: Txn[] = await fetchHostTransactions(admin, {
    hostId: host.id,
    gkey,
  });

  // Quotes (pre-booking, not yet a transaction) stay a separate section.
  let quotes: QuoteItem[] = [];
  {
    let qq = supabase
      .from("quotes")
      .select(
        "id, status, total_amount, currency, check_in, check_out, listing_id, created_at",
      )
      .eq("host_id", host.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (guestId && email)
      qq = qq.or(`guest_id.eq.${guestId},guest_email.ilike.${email}`);
    else if (guestId) qq = qq.eq("guest_id", guestId);
    else if (email) qq = qq.ilike("guest_email", email);
    else qq = qq.eq("id", "00000000-0000-0000-0000-000000000000");
    const { data: qrows } = await qq;
    quotes = (qrows ?? []).map((q) => ({
      id: q.id,
      status: q.status,
      total: Number(q.total_amount),
      currency: q.currency,
      checkIn: q.check_in,
      checkOut: q.check_out,
      listingName: listingNames.get(q.listing_id) ?? "Listing",
      date: q.created_at,
    }));
  }

  // Per-host marketing state (POPIA). Strictly host-scoped — never reveals any
  // other host's relationship with the same person.
  const [{ data: gmRow }, { data: hcRow }] = await Promise.all([
    supabase
      .from("guest_marketing")
      .select("is_subscribed")
      .eq("host_id", host.id)
      .eq("gkey", gkey)
      .maybeSingle(),
    email
      ? supabase
          .from("host_contacts")
          .select("email_consent")
          .eq("host_id", host.id)
          .ilike("email", email)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const marketingState:
    | "subscribed"
    | "unsubscribed"
    | "needs_consent"
    | "no_email" = !record.has_email
    ? "no_email"
    : gmRow?.is_subscribed === false
      ? "unsubscribed"
      : record.total_bookings > 0 || hcRow?.email_consent === true
        ? "subscribed"
        : "needs_consent";

  // Notes timeline (newest first, pinned on top) with author names.
  const { data: notesData } = await supabase
    .from("guest_notes")
    .select(
      "id, body, is_pinned, created_at, author:user_profiles!guest_notes_author_id_fkey ( full_name )",
    )
    .eq("host_id", host.id)
    .eq("gkey", gkey)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  const notes: NoteItem[] = (
    (notesData ?? []) as unknown as {
      id: string;
      body: string;
      is_pinned: boolean;
      created_at: string;
      author: { full_name: string | null } | null;
    }[]
  ).map((n) => ({
    id: n.id,
    body: n.body,
    isPinned: n.is_pinned,
    createdAt: n.created_at,
    authorName: n.author?.full_name ?? "Host",
  }));
  const pinnedNote = notes.find((n) => n.isPinned) ?? null;

  // Messages — resolve the host<->guest thread by the registered guest_id AND by
  // any lead profile sharing this guest's email. Enquiry / quote-request leads
  // have no account, but createEnquiry still made a conversation (keyed to the
  // lead's profile) and posted the guest's message into it — so an email-based
  // guest record must surface that thread too, not just registered guests.
  let conversationId: string | null = null;
  let messages: MessageItem[] = [];

  const guestUserIds = new Set<string>();
  if (guestId) guestUserIds.add(guestId);
  if (email) {
    const { data: sameEmail } = await supabase
      .from("user_profiles")
      .select("id")
      .ilike("email", email);
    for (const p of sameEmail ?? []) guestUserIds.add(p.id);
  }

  if (guestUserIds.size > 0) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("host_id", host.id)
      .in("guest_id", [...guestUserIds])
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (conv) {
      conversationId = conv.id;
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, body, sender_id, created_at, is_system_message")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true })
        .limit(200);
      messages = (msgs ?? [])
        .filter((m) => !m.is_system_message && m.body)
        .map((m) => ({
          id: m.id,
          body: m.body ?? "",
          mine: m.sender_id === user.id,
          createdAt: m.created_at,
        }));
    }
  }

  // Reusable message templates for the reply picker (enhancement C).
  const { data: templatesData } = await supabase
    .from("message_templates")
    .select("id, title, body")
    .eq("host_id", host.id)
    .order("sort_order");
  const templates: TemplateItem[] = (templatesData ?? []) as TemplateItem[];

  // Prev / next within the directory (recent order) for the sub-header nav.
  const { data: dir } = await supabase.rpc("fetch_host_guests", {
    p_host_id: host.id,
    p_sort: "recent",
    p_limit: 500,
    p_offset: 0,
  });
  const gkeys = (
    ((dir as { guests?: { gkey: string }[] } | null)?.guests ?? []) as {
      gkey: string;
    }[]
  ).map((g) => g.gkey);
  const idx = gkeys.indexOf(gkey);
  const prevGkey = idx > 0 ? gkeys[idx - 1] : null;
  const nextGkey = idx >= 0 && idx < gkeys.length - 1 ? gkeys[idx + 1] : null;

  // ── Net guest balance ──────────────────────────────────────────────
  // Store credit the host owes this guest minus what the guest still owes
  // across their non-cancelled bookings. Positive = host owes (credit, green);
  // negative = guest owes (red).
  const { data: creditRows } = await supabase
    .from("guest_credit_ledger")
    .select("amount")
    .eq("host_id", host.id)
    .eq("gkey", gkey);
  const storeCredit = (creditRows ?? []).reduce(
    (s, c) => s + Number(c.amount),
    0,
  );
  const outstanding = bookings
    .filter((b) => !b.status.startsWith("cancelled") && b.status !== "declined")
    .reduce((s, b) => s + Math.max(0, b.balanceDue), 0);
  const netBalance = Math.round((storeCredit - outstanding) * 100) / 100;

  // An accepted-but-not-converted quote drives the pulsing "Quote accepted" pill.
  const acceptedQ = quotes.find((q) => q.status === "accepted") ?? null;

  return (
    <GuestRecord
      record={record}
      bookings={bookings}
      reviews={reviews}
      requestableReviews={requestableReviews}
      txns={txns}
      quotes={quotes}
      acceptedQuote={
        acceptedQ
          ? {
              id: acceptedQ.id,
              amount: acceptedQ.total,
              currency: acceptedQ.currency,
            }
          : null
      }
      marketingState={marketingState}
      notes={notes}
      pinnedNote={pinnedNote}
      messages={messages}
      conversationId={conversationId}
      templates={templates}
      prevGkey={prevGkey}
      nextGkey={nextGkey}
      balance={{
        net: netBalance,
        outstanding: Math.round(outstanding * 100) / 100,
        storeCredit: Math.round(storeCredit * 100) / 100,
      }}
    />
  );
}
