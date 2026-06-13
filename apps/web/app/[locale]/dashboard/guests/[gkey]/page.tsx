import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { fetchHostTransactions, type Txn } from "@/lib/finance/transactions";
import { hostCanRateGuest } from "@/lib/guests/can-rate";
import { gkeyFor } from "@/lib/guests/gkey";
import { sumPaidFromRows } from "@/lib/payments/ledger";
import { resolveGuestNextAction } from "@/lib/guests/next-action";
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
  type GuestRatingRow,
  type GuestRecordData,
  type MessageItem,
  type NoteItem,
  type QuoteItem,
  type RelationshipItem,
  type ReputationData,
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
  pay_token: string | null;
  payment_status: string | null;
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
      "id, reference, status, check_in, check_out, nights, guests_count, total_amount, balance_due, currency, channel, created_at, special_requests, pay_token, payment_status, listing:listings ( name, listing_photos ( url, sort_order ) )",
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

  // Absolute origin for the shareable /pay/[token] link — mirrors the booking
  // record (x-forwarded-* first, NEXT_PUBLIC_SITE_URL fallback) so the link is
  // copy/send-ready and passes the http(s) check.
  const hdrs = headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const fwdHost = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const origin = fwdHost
    ? `${proto}://${fwdHost}`
    : (process.env.NEXT_PUBLIC_SITE_URL ?? "");
  const CANCELLED_STATUSES = new Set([
    "cancelled_by_host",
    "cancelled_by_guest",
    "declined",
    "expired",
    "no_show",
  ]);

  // Derive each booking's outstanding from its COMPLETED payments — the same
  // canonical maths as lib/payments/ledger.ts — rather than trusting the stored
  // bookings.balance_due column (which can drift, e.g. a pending EFT that
  // pre-zeroed it). This keeps the per-booking "due" and the headline balance
  // self-consistent and correct even if the column is stale.
  const admin = createAdminClient();
  const bookingIds = bookingsRaw.map((b) => b.id);
  const paidByBooking = new Map<string, number>();
  if (bookingIds.length > 0) {
    const { data: payRows } = await admin
      .from("payments")
      .select("booking_id, amount, kind, status, voided_at")
      .in("booking_id", bookingIds);
    const byBooking = new Map<
      string,
      { amount: number; kind: string | null; status: string | null }[]
    >();
    for (const p of payRows ?? []) {
      const arr = byBooking.get(p.booking_id) ?? [];
      arr.push({ amount: Number(p.amount), kind: p.kind, status: p.status });
      byBooking.set(p.booking_id, arr);
    }
    for (const [id, rows] of byBooking) {
      paidByBooking.set(id, sumPaidFromRows(rows));
    }
  }

  const bookings: BookingItem[] = bookingsRaw.map((b) => {
    const photos = b.listing?.listing_photos ?? [];
    const thumb =
      photos.length > 0
        ? [...photos].sort((a, c) => a.sort_order - c.sort_order)[0].url
        : null;
    // Dead bookings owe nothing; otherwise total − completed paid.
    const total = Number(b.total_amount);
    const paid = paidByBooking.get(b.id) ?? 0;
    const balanceDue = CANCELLED_STATUSES.has(b.status)
      ? 0
      : Math.round(Math.max(0, total - paid) * 100) / 100;
    const payable =
      !CANCELLED_STATUSES.has(b.status) &&
      b.payment_status !== "completed" &&
      balanceDue > 0.005 &&
      Boolean(b.pay_token);
    return {
      id: b.id,
      reference: b.reference,
      status: b.status,
      checkIn: b.check_in,
      checkOut: b.check_out,
      nights: b.nights,
      guestsCount: b.guests_count,
      totalAmount: Number(b.total_amount),
      balanceDue,
      currency: b.currency,
      channel: b.channel,
      createdAt: b.created_at,
      specialRequests: b.special_requests,
      listingName: b.listing?.name ?? "Listing",
      listingThumb: thumb,
      payUrl: payable && origin ? `${origin}/pay/${b.pay_token}` : null,
    };
  });

  // Host's add-on catalog (active first) for the Finances "Add add-on" modal —
  // same source the booking record's AddonManager uses.
  const { data: catalogRows } = await supabase
    .from("addons")
    .select("id, name, unit_price, is_active")
    .eq("host_id", host.id)
    .order("is_active", { ascending: false })
    .order("sort_order");
  const addonCatalog = (catalogRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    unitPrice: Number(c.unit_price),
    active: c.is_active,
  }));

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
  let unreadFromGuest = 0;

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
      .select("id, unread_host")
      .eq("host_id", host.id)
      .in("guest_id", [...guestUserIds])
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (conv) {
      conversationId = conv.id;
      unreadFromGuest = Number(conv.unread_host ?? 0);
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
  // Outstanding = the sum of every non-cancelled booking's own due (each derived
  // above from its COMPLETED payments). This makes the headline balance match
  // the per-booking "due" lines exactly, and counts confirmed AND pending
  // bookings the guest still owes for — which a documents-only ledger sum misses
  // until an invoice exists. Store credit (below) is netted separately.
  const outstanding =
    Math.round(bookings.reduce((s, b) => s + b.balanceDue, 0) * 100) / 100;
  const netBalance = Math.round((storeCredit - outstanding) * 100) / 100;

  // ── What to do (single source of truth) ────────────────────────────────
  // The canonical resolver decides the one most-important next move for this
  // guest from data already loaded above (bookings, quotes, ledger-derived
  // balance, unread count, review eligibility). It never recomputes money.
  const newBookingHref = `/dashboard/bookings/new?${new URLSearchParams({
    ...(record.name ? { guestName: record.name } : {}),
    ...(record.email ? { guestEmail: record.email } : {}),
    ...(record.phone ? { guestPhone: record.phone } : {}),
  }).toString()}`;
  const nextAction = resolveGuestNextAction({
    firstName: (record.name ?? "Guest").split(/\s+/)[0],
    bookings: bookings.map((b) => ({
      id: b.id,
      status: b.status,
      checkIn: b.checkIn,
      balanceDue: b.balanceDue,
      listingName: b.listingName,
    })),
    quotes: quotes.map((q) => ({ id: q.id, status: q.status })),
    unreadFromGuest,
    requestableCount: requestableReviews.length,
    isInhouse: record.is_inhouse,
    nextStay: record.next_stay,
    nextStayInDays: record.next_stay_in_days,
    lastStay: record.last_stay,
    newBookingHref,
  });

  // ── Relationships ───────────────────────────────────────────────────────
  // Other guests this person travelled with, materialised from booking party
  // manifests (lead booker ↔ each named guest). Resolve this guest's contact
  // row, then its links. Two plain queries (no PostgREST embed) — the relation
  // has two FKs to host_contacts, which would make an embed ambiguous.
  let relationships: RelationshipItem[] = [];
  {
    let contactId: string | null = null;
    if (email) {
      const { data: c } = await supabase
        .from("host_contacts")
        .select("id")
        .eq("host_id", host.id)
        .ilike("email", email)
        .maybeSingle();
      contactId = c?.id ?? null;
    }
    if (!contactId && guestId) {
      const { data: c } = await supabase
        .from("host_contacts")
        .select("id")
        .eq("host_id", host.id)
        .eq("guest_id", guestId)
        .maybeSingle();
      contactId = c?.id ?? null;
    }
    if (contactId) {
      const { data: rels } = await supabase
        .from("guest_relationships")
        .select("id, related_contact_id, source_booking_id, created_at")
        .eq("host_id", host.id)
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      const relRows = rels ?? [];
      if (relRows.length > 0) {
        const relIds = [...new Set(relRows.map((r) => r.related_contact_id))];
        const bkIds = [
          ...new Set(
            relRows
              .map((r) => r.source_booking_id)
              .filter((x): x is string => Boolean(x)),
          ),
        ];
        const [{ data: relContacts }, { data: relBookings }] =
          await Promise.all([
            supabase
              .from("host_contacts")
              .select("id, name, email, guest_id")
              .eq("host_id", host.id)
              .in("id", relIds),
            bkIds.length > 0
              ? supabase
                  .from("bookings")
                  .select("id, reference")
                  .eq("host_id", host.id)
                  .in("id", bkIds)
              : Promise.resolve({
                  data: [] as { id: string; reference: string }[],
                }),
          ]);
        const cMap = new Map((relContacts ?? []).map((c) => [c.id, c]));
        const bMap = new Map(
          (relBookings ?? []).map((b) => [b.id, b.reference]),
        );
        relationships = relRows.map((rr) => {
          const c = cMap.get(rr.related_contact_id);
          return {
            id: rr.id,
            name: c?.name ?? "Guest",
            email: c?.email ?? null,
            gkey: c ? gkeyFor(c.guest_id, c.email) : null,
            bookingId: rr.source_booking_id,
            bookingRef: rr.source_booking_id
              ? (bMap.get(rr.source_booking_id) ?? null)
              : null,
          };
        });
      }
    }
  }

  // ── Reputation (host → guest ratings, cross-host) ───────────────────────
  // Only registered guests (a Vilo account id) are rateable; email-only/OTA
  // contacts render a "no account yet" state. RLS lets this host read EVERY
  // host's rating of the guest (shared reputation), but write only its own.
  const DIMS = [
    "payments",
    "communication",
    "cleanliness",
    "house_rules",
    "integrity",
  ] as const;
  let reputation: ReputationData = {
    hasAccount: Boolean(guestId),
    canRate: false,
    myRating: null,
    otherRatings: [],
    aggregate: { overall: null, hostCount: 0, dimensions: {} },
  };
  if (guestId) {
    const [{ data: ratingRows }, canRate] = await Promise.all([
      supabase
        .from("guest_ratings")
        .select(
          `id, host_id, rating, summary,
           rating_payments, rating_communication, rating_cleanliness,
           rating_house_rules, rating_integrity,
           note_payments, note_communication, note_cleanliness,
           note_house_rules, note_integrity, updated_at`,
        )
        .eq("guest_id", guestId)
        .order("updated_at", { ascending: false }),
      hostCanRateGuest(supabase, host.id, guestId),
    ]);

    const rows = (ratingRows ?? []) as Array<{
      id: string;
      host_id: string;
      rating: number;
      summary: string | null;
      rating_payments: number | null;
      rating_communication: number | null;
      rating_cleanliness: number | null;
      rating_house_rules: number | null;
      rating_integrity: number | null;
      note_payments: string | null;
      note_communication: string | null;
      note_cleanliness: string | null;
      note_house_rules: string | null;
      note_integrity: string | null;
      updated_at: string;
    }>;

    const toRow = (x: (typeof rows)[number]): GuestRatingRow => ({
      id: x.id,
      rating: x.rating,
      summary: x.summary,
      scores: {
        payments: x.rating_payments,
        communication: x.rating_communication,
        cleanliness: x.rating_cleanliness,
        house_rules: x.rating_house_rules,
        integrity: x.rating_integrity,
      },
      notes: {
        payments: x.note_payments,
        communication: x.note_communication,
        cleanliness: x.note_cleanliness,
        house_rules: x.note_house_rules,
        integrity: x.note_integrity,
      },
      updatedAt: x.updated_at,
      isMine: x.host_id === host.id,
    });

    const mine = rows.find((x) => x.host_id === host.id);
    const others = rows.filter((x) => x.host_id !== host.id);

    // Aggregate across ALL hosts (mine included): overall avg + per-dimension avg.
    const avg = (nums: number[]): number | null =>
      nums.length === 0
        ? null
        : Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
    const overall = avg(rows.map((x) => x.rating));
    const dimensions: Record<string, number | null> = {};
    for (const d of DIMS) {
      const key = `rating_${d}` as keyof (typeof rows)[number];
      dimensions[d] = avg(
        rows
          .map((x) => x[key] as number | null)
          .filter((n): n is number => typeof n === "number"),
      );
    }

    reputation = {
      hasAccount: true,
      canRate,
      myRating: mine ? toRow(mine) : null,
      otherRatings: others.map(toRow),
      aggregate: { overall, hostCount: rows.length, dimensions },
    };
  }

  return (
    <GuestRecord
      record={record}
      bookings={bookings}
      reviews={reviews}
      reputation={reputation}
      requestableReviews={requestableReviews}
      txns={txns}
      quotes={quotes}
      addonCatalog={addonCatalog}
      nextAction={nextAction}
      marketingState={marketingState}
      notes={notes}
      pinnedNote={pinnedNote}
      messages={messages}
      conversationId={conversationId}
      templates={templates}
      relationships={relationships}
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
