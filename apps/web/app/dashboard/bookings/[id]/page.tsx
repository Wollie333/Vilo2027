import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import {
  type MessageItem,
  type TemplateItem,
} from "@/components/messages/GuestMessagesPanel";
import { fetchHostTransactions } from "@/lib/finance/transactions";
import { gkeyFor } from "@/lib/guests/gkey";
import { getMyHostId } from "@/lib/host/current";
import { sumPaidFromRows } from "@/lib/payments/ledger";
import { reviewPhotoUrl } from "@/lib/reviews/photos";
import { buildReviewUrl } from "@/lib/review-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  BookingDetail,
  type BookingDetailData,
  type BookingTimelineItem,
} from "./BookingDetail";

export const metadata: Metadata = {
  title: "Booking",
};

export const dynamic = "force-dynamic";

// ─── helpers ─────────────────────────────────────────────────────────
function parseDateOnly(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function fmtStayDate(d: Date): string {
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}
function fmtLong(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}
function fmtStamp(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
function initialsOf(name: string | null): string {
  if (!name) return "G";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "G";
}

const TERMINAL_CANCELLED = new Set([
  "cancelled_by_host",
  "cancelled_by_guest",
  "declined",
  "expired",
  "no_show",
]);

function statusMeta(status: string): {
  label: string;
  tone: BookingDetailData["statusTone"];
} {
  switch (status) {
    case "confirmed":
      return { label: "Confirmed", tone: "confirmed" };
    case "checked_in":
      return { label: "In-house", tone: "inhouse" };
    case "completed":
    case "checked_out":
      return { label: "Completed", tone: "completed" };
    case "pending":
      return { label: "Pending", tone: "pending" };
    case "pending_eft":
      return { label: "Awaiting EFT", tone: "pending" };
    case "pending_eft_review":
      return { label: "EFT in review", tone: "pending" };
    case "cancelled_by_host":
      return { label: "Cancelled", tone: "cancelled" };
    case "cancelled_by_guest":
      return { label: "Guest cancelled", tone: "cancelled" };
    case "declined":
      return { label: "Declined", tone: "cancelled" };
    case "expired":
      return { label: "Expired", tone: "cancelled" };
    case "no_show":
      return { label: "No-show", tone: "cancelled" };
    default:
      return { label: status.replace(/_/g, " "), tone: "pending" };
  }
}

function channelOf(origin: string): {
  label: string;
  mark: string;
  bg: string;
} {
  switch (origin) {
    case "host_manual":
      return { label: "Manual booking", mark: "M", bg: "#064E3B" };
    case "quote_converted":
      return { label: "From quote", mark: "Q", bg: "#6366F1" };
    default:
      return { label: "Vilo direct", mark: "V", bg: "#10B981" };
  }
}

const DAY_MS = 86_400_000;

export default async function BookingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();

  // Scope strictly to the signed-in user's own host (admin/staff RLS would
  // otherwise expose other hosts' bookings on the host dashboard).
  const myHostId = await getMyHostId(supabase);
  if (!myHostId) notFound();

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, host_id, listing_id, quote_id, reference, pay_token, status, payment_status, scope, origin, check_in, check_out, nights, guests_count, guests_breakdown, base_amount, cleaning_fee, total_amount, vat_amount, vat_rate, deposit_amount, balance_due, refund_total, currency, payment_method, special_requests, host_message, cancellation_reason, created_at, confirmed_at, cancelled_at, declined_at, checked_in_at, checked_out_at, has_open_refund, guest_id, guest_name, guest_email, guest_phone, listing:listings!inner ( name, slug, city, province, accommodation_type, listing_type, bedrooms, bathrooms, max_guests, check_in_time, check_out_time, cancellation_policy, cancellation_policy_label, featured_review_id, listing_photos ( url, sort_order ) ), guest:user_profiles!bookings_guest_id_fkey ( full_name, email, phone, avatar_url, country, languages, created_at ), booking_rooms ( id, base_amount, cleaning_fee, room:listing_rooms ( name ) ), booking_addons ( id, label, quantity, unit_price, subtotal, currency, is_required, sort_order, source )",
    )
    .eq("id", params.id)
    .eq("host_id", myHostId)
    .maybeSingle();

  if (!booking) notFound();

  // If this booking came from a quote that's ACCEPTED but not yet converted/
  // paid, surface the pulsing "Quote accepted — convert" pill + prompt.
  let acceptedQuote: { id: string; amount: number; currency: string } | null =
    null;
  if (booking.quote_id) {
    const { data: aq } = await supabase
      .from("quotes")
      .select("id, status, total_amount, currency")
      .eq("id", booking.quote_id)
      .maybeSingle();
    if (aq && aq.status === "accepted") {
      acceptedQuote = {
        id: aq.id,
        amount: Number(aq.total_amount),
        currency: aq.currency,
      };
    }
  }

  // Payment ledger (deposit + balance + extras). The booking's money state is
  // derived from completed inbound entries.
  const { data: paymentRows } = await supabase
    .from("payments")
    .select(
      "id, status, method, kind, amount, note, created_at, captured_at, receipt_number, receipt_token",
    )
    .eq("booking_id", booking.id)
    .is("voided_at", null)
    .order("created_at", { ascending: true });

  const ledger = paymentRows ?? [];
  // Canonical paid-sum from the already-fetched rows (one INBOUND_KINDS list).
  const amountPaid = sumPaidFromRows(ledger);
  // Latest pending manual EFT entry still drives the legacy "settle" affordance.
  const pendingEft = [...ledger]
    .reverse()
    .find((p) => p.method === "eft" && p.status === "pending");
  const latestPayment = ledger[ledger.length - 1] ?? null;

  // Per-host store credit available to this guest.
  const guestGkeyForCredit = gkeyFor(
    booking.guest_id,
    booking.guest_email ?? null,
  );
  let guestCredit = 0;
  if (guestGkeyForCredit) {
    const { data: creditRows } = await supabase
      .from("guest_credit_ledger")
      .select("amount")
      .eq("host_id", booking.host_id)
      .eq("gkey", guestGkeyForCredit);
    guestCredit = (creditRows ?? []).reduce((s, r) => s + Number(r.amount), 0);
  }

  // Booking transactions — the SAME canonical source as the account-wide Ledger
  // and the guest record, filtered to this booking and including pending
  // payments (so the tab can offer "mark received"). Rendered with the one
  // shared <LedgerList>, so rows and balances match everywhere.
  const admin = createAdminClient();
  const bookingTxns = await fetchHostTransactions(admin, {
    hostId: booking.host_id,
    bookingId: booking.id,
    includePending: true,
  });

  // Financial documents + access + host-only notes.
  const [
    { data: invoiceRow },
    { data: creditNoteRows },
    { data: notesRaw },
    { data: accessRow },
    { data: reviewRow },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, status")
      .eq("booking_id", booking.id)
      .eq("kind", "booking")
      .maybeSingle(),
    supabase
      .from("credit_notes")
      .select("id, credit_note_number")
      .eq("booking_id", booking.id)
      .order("issued_at", { ascending: false }),
    supabase
      .from("booking_notes")
      .select(
        "id, body, created_at, author:user_profiles!booking_notes_author_id_fkey ( full_name )",
      )
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("listing_access")
      .select(
        "check_in_method, check_in_instructions, door_code, gate_code, wifi_network, wifi_password",
      )
      .eq("listing_id", booking.listing_id)
      .maybeSingle(),
    supabase
      .from("reviews")
      .select(
        "id, rating, body, host_response, host_responded_at, flagged, created_at, photos:review_photos ( storage_path, sort_order )",
      )
      .eq("booking_id", booking.id)
      .maybeSingle(),
  ]);

  const listing = booking.listing as unknown as {
    name: string;
    slug: string | null;
    city: string | null;
    province: string | null;
    accommodation_type: string | null;
    listing_type: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    max_guests: number | null;
    check_in_time: string | null;
    check_out_time: string | null;
    cancellation_policy: string;
    cancellation_policy_label: string | null;
    featured_review_id: string | null;
    listing_photos: { url: string; sort_order: number }[] | null;
  };

  const guestRaw = booking.guest as unknown as
    | {
        full_name: string | null;
        email: string | null;
        phone: string | null;
        avatar_url: string | null;
        country: string | null;
        languages: string[] | null;
        created_at: string | null;
      }
    | Array<{
        full_name: string | null;
        email: string | null;
        phone: string | null;
        avatar_url: string | null;
        country: string | null;
        languages: string[] | null;
        created_at: string | null;
      }>
    | null;
  const guestJoined = Array.isArray(guestRaw) ? guestRaw[0] : guestRaw;

  const guest = {
    full_name: guestJoined?.full_name ?? booking.guest_name ?? null,
    email: guestJoined?.email ?? booking.guest_email ?? null,
    phone: guestJoined?.phone ?? booking.guest_phone ?? null,
    avatar_url: guestJoined?.avatar_url ?? null,
    country: guestJoined?.country ?? null,
    languages: guestJoined?.languages ?? null,
    created_at: guestJoined?.created_at ?? null,
  };

  const bookingRooms = (booking.booking_rooms ?? []) as unknown as Array<{
    id: string;
    base_amount: number;
    cleaning_fee: number | null;
    room: { name: string } | null;
  }>;

  const addons = (
    (booking.booking_addons ?? []) as unknown as Array<{
      id: string;
      label: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
      currency: string;
      is_required: boolean;
      sort_order: number;
      source: string | null;
    }>
  ).sort((a, b) => a.sort_order - b.sort_order);

  // The host's add-on catalogue for the quick-pick when adding extras. Show ALL
  // their add-ons (active first) — this is the host's own internal picker, so
  // even paused/inactive ones can be pulled onto a booking by hand.
  const { data: catalogRows } = await supabase
    .from("addons")
    .select("id, name, unit_price, is_active")
    .eq("host_id", booking.host_id)
    .order("is_active", { ascending: false })
    .order("sort_order");

  const notes = (
    (notesRaw ?? []) as unknown as Array<{
      id: string;
      body: string;
      created_at: string;
      author:
        | { full_name: string | null }
        | { full_name: string | null }[]
        | null;
    }>
  ).map((n) => {
    const a = Array.isArray(n.author) ? n.author[0] : n.author;
    return {
      id: n.id,
      body: n.body,
      created_at: n.created_at,
      authorName: a?.full_name ?? "You",
      authorInitials: initialsOf(a?.full_name ?? null),
    };
  });

  // Guest history with THIS host (returning signal + lifetime value + rating).
  let guestStays = 0;
  let guestLifetime = 0;
  let guestRating: number | null = null;
  if (booking.guest_id) {
    const [{ data: history }, { data: revs }] = await Promise.all([
      supabase
        .from("bookings")
        .select("total_amount, status")
        .eq("guest_id", booking.guest_id)
        .eq("host_id", booking.host_id),
      supabase
        .from("reviews")
        .select("rating")
        .eq("host_id", booking.host_id)
        .eq("guest_id", booking.guest_id)
        .eq("is_published", true),
    ]);
    for (const b of history ?? []) {
      if (!TERMINAL_CANCELLED.has(b.status as string)) {
        guestStays += 1;
        guestLifetime += Number(b.total_amount);
      }
    }
    if (revs && revs.length > 0) {
      guestRating =
        Math.round(
          (revs.reduce((s, r) => s + Number(r.rating), 0) / revs.length) * 10,
        ) / 10;
    }
  }

  const currency = booking.currency;
  const status = booking.status;
  const meta = statusMeta(status);
  const channel = channelOf(booking.origin);

  // Occupancy.
  const gb = (booking.guests_breakdown ?? null) as Record<
    string,
    unknown
  > | null;
  const numOf = (v: unknown) => (typeof v === "number" ? v : 0);
  const adults = numOf(gb?.adults);
  const children = numOf(gb?.children);
  const infants = numOf(gb?.infants);
  const occParts = [
    adults > 0 ? `${adults} adult${adults === 1 ? "" : "s"}` : null,
    children > 0 ? `${children} child${children === 1 ? "" : "ren"}` : null,
    infants > 0 ? `${infants} infant${infants === 1 ? "" : "s"}` : null,
  ].filter(Boolean) as string[];
  const occupancyLabel =
    occParts.length > 0
      ? occParts.join(" · ")
      : `${booking.guests_count} guest${booking.guests_count === 1 ? "" : "s"}`;

  const arrival = parseDateOnly(booking.check_in);
  const departure = parseDateOnly(booking.check_out);
  const created = new Date(booking.created_at);
  const now = new Date();
  const nights = booking.nights ?? 0;
  const perNight = nights > 0 ? Number(booking.base_amount) / nights : null;

  // Progress + proximity.
  let progressPct: number | null = null;
  let progressNote = "";
  let arrivalProximity: string | null = null;
  let arrivalBig = arrival ? fmtStayDate(arrival) : "—";
  if (arrival && departure) {
    const span = Math.max(1, departure.getTime() - created.getTime());
    progressPct = Math.max(
      2,
      Math.min(100, ((now.getTime() - created.getTime()) / span) * 100),
    );
    const daysToArrival = Math.ceil(
      (arrival.getTime() - now.getTime()) / DAY_MS,
    );
    if (TERMINAL_CANCELLED.has(status)) {
      arrivalProximity = null;
      arrivalBig = meta.label;
      progressPct = null;
    } else if (status === "completed" || status === "checked_out") {
      arrivalProximity = "Stay completed";
      arrivalBig = "Completed";
      progressNote = "Stay completed";
    } else if (status === "checked_in") {
      arrivalProximity = "Currently in-house";
      arrivalBig = "In-house";
      progressNote = "Guest in-house";
    } else if (daysToArrival > 1) {
      arrivalProximity = `Arrives in ${daysToArrival} days`;
      arrivalBig = `In ${daysToArrival} days`;
      progressNote = `${daysToArrival} days to arrival`;
    } else if (daysToArrival === 1) {
      arrivalProximity = "Arrives tomorrow";
      arrivalBig = "Tomorrow";
      progressNote = "Arrives tomorrow";
    } else if (daysToArrival === 0) {
      arrivalProximity = "Arrives today";
      arrivalBig = "Today";
      progressNote = "Arrives today";
    } else {
      arrivalBig = fmtStayDate(arrival);
    }
  }

  const paidInFull =
    Number(booking.total_amount) > 0 &&
    amountPaid + 0.001 >= Number(booking.total_amount);

  const propertyMeta = [
    listing.city,
    listing.accommodation_type ?? listing.listing_type,
    listing.max_guests ? `Sleeps ${listing.max_guests}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const photos = (listing.listing_photos ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  const cover = photos[0]?.url ?? null;

  const cancellationLabel =
    listing.cancellation_policy_label ||
    listing.cancellation_policy.replace(/_/g, " ");

  const refundTotal = Number(booking.refund_total ?? 0);
  const hasWorkflow = ["pending", "confirmed", "checked_in"].includes(status);
  const canRefund =
    Boolean(booking.guest_id) &&
    (status === "completed" ||
      status === "checked_in" ||
      status === "checked_out" ||
      paidInFull) &&
    !booking.has_open_refund;

  const ciTime = listing.check_in_time?.slice(0, 5) ?? null;
  const coTime = listing.check_out_time?.slice(0, 5) ?? null;
  const checkInBig = arrival ? fmtStayDate(arrival) : "—";
  const checkOutBig = departure ? fmtStayDate(departure) : "—";

  // Activity timeline (present events only, newest first).
  const tl: BookingTimelineItem[] = [];
  const push = (
    iso: string | null,
    title: string,
    tone: BookingTimelineItem["tone"],
    desc: string | null = null,
  ) => {
    if (iso) tl.push({ title, desc, stamp: fmtStamp(iso), tone });
  };
  push(booking.checked_out_at, "Checked out", "completed");
  push(booking.checked_in_at, "Checked in", "inhouse");
  push(
    booking.cancelled_at,
    "Booking cancelled",
    "cancelled",
    booking.cancellation_reason,
  );
  push(booking.declined_at, "Booking declined", "cancelled");
  push(booking.confirmed_at, "Booking confirmed", "primary");
  push(booking.created_at, "Booking created", "mute", channel.label);

  // ── Guest conversation thread (the SAME thread as the guest record) ──
  // Resolve it exactly like the guest CRM record: match the booking's guest by
  // id OR any profile sharing their email, then surface that host↔guest
  // conversation. So the Messages tab here and on the guest record are one
  // thread, not a per-booking fork.
  const {
    data: { user: me },
  } = await supabase.auth.getUser();
  let conversationId: string | null = null;
  let messages: MessageItem[] = [];
  const guestUserIds = new Set<string>();
  if (booking.guest_id) guestUserIds.add(booking.guest_id);
  const guestEmailForThread = guest.email ?? booking.guest_email;
  if (guestEmailForThread) {
    const { data: sameEmail } = await supabase
      .from("user_profiles")
      .select("id")
      .ilike("email", guestEmailForThread);
    for (const p of sameEmail ?? []) guestUserIds.add(p.id);
  }
  if (guestUserIds.size > 0) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("host_id", booking.host_id)
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
          mine: m.sender_id === me?.id,
          createdAt: m.created_at,
        }));
    }
  }
  const { data: templatesData } = await supabase
    .from("message_templates")
    .select("id, title, body")
    .eq("host_id", booking.host_id)
    .order("sort_order");
  const templates: TemplateItem[] = (templatesData ?? []) as TemplateItem[];

  const data: BookingDetailData = {
    id: booking.id,
    reference: booking.reference,
    conversationId,
    messages,
    templates,
    guestId: booking.guest_id,
    listingId: booking.listing_id,
    status,
    statusLabel: meta.label,
    statusTone: meta.tone,
    paymentStatus: booking.payment_status,
    paidInFull,

    channelLabel: channel.label,
    channelMark: channel.mark,
    channelBg: channel.bg,
    acceptedQuote,

    guestName: guest.full_name || "Guest",
    guestEmail: guest.email,
    guestPhone: guest.phone,
    guestAvatar: guest.avatar_url,
    guestCountry: guest.country,
    guestLanguages: guest.languages ?? [],
    guestRegistered: Boolean(booking.guest_id),
    guestGkey: gkeyFor(booking.guest_id, guest.email ?? booking.guest_email),
    memberSinceYear: guest.created_at
      ? String(new Date(guest.created_at).getFullYear())
      : null,
    guestStays,
    guestLifetime,
    guestRating,
    returning: guestStays > 1,

    listingName: listing.name,
    listingSlug: listing.slug,
    listingCity: listing.city,
    propertyMeta,
    cover,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    cancellationLabel,

    nights,
    perNight,
    guestsCount: booking.guests_count,
    occupancyLabel,
    totalAmount: Number(booking.total_amount),
    baseAmount: Number(booking.base_amount),
    cleaningFee: Number(booking.cleaning_fee),
    vatAmount: Number(booking.vat_amount ?? 0),
    vatRate: Number(booking.vat_rate ?? 0),
    currency,
    refundTotal,

    checkInBig,
    checkInSub: ciTime ? `From ${ciTime}` : "Time TBC",
    checkOutBig,
    checkOutSub: coTime ? `By ${coTime}` : "Time TBC",
    checkInFull: arrival ? `${checkInBig}${ciTime ? ` · ${ciTime}` : ""}` : "—",
    checkOutFull: departure
      ? `${checkOutBig}${coTime ? ` · ${coTime}` : ""}`
      : "—",
    bookedLong: fmtLong(booking.created_at),

    arrivalProximity,
    arrivalBig,
    arrivalSub: arrival ? `${checkInBig}${ciTime ? ` · ${ciTime}` : ""}` : "—",
    progressPct,
    progressNote,

    specialRequests: booking.special_requests,
    scope: booking.scope,
    bookingRooms: bookingRooms.map((br) => ({
      id: br.id,
      name: br.room?.name ?? "Room",
      amount: Number(br.base_amount) + Number(br.cleaning_fee ?? 0),
    })),
    addons: addons.map((a) => ({
      id: a.id,
      label: a.label,
      quantity: a.quantity,
      subtotal: Number(a.subtotal),
      currency: a.currency,
      isRequired: a.is_required,
      source: a.source ?? "quote",
    })),
    addonsSubtotal: addons.reduce((s, a) => s + Number(a.subtotal), 0),
    addonCatalog: (catalogRows ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      unitPrice: Number(c.unit_price),
      active: c.is_active,
    })),
    canEditAddons: !TERMINAL_CANCELLED.has(status),

    paymentMethod: latestPayment?.method ?? booking.payment_method,
    paymentRecordId: latestPayment?.id ?? null,
    paymentRowStatus: latestPayment?.status ?? null,
    showEftManage: Boolean(pendingEft),

    amountPaid: Math.round(amountPaid * 100) / 100,
    balanceDue:
      Math.round(Math.max(0, Number(booking.total_amount) - amountPaid) * 100) /
      100,
    depositAmount: Number(booking.deposit_amount ?? 0),
    guestCredit: Math.round(guestCredit * 100) / 100,
    txns: bookingTxns,

    invoice: invoiceRow
      ? { id: invoiceRow.id, number: invoiceRow.invoice_number }
      : null,
    creditNotes: (creditNoteRows ?? []).map((c) => ({
      id: c.id,
      number: c.credit_note_number,
    })),

    access: accessRow
      ? {
          checkInMethod: accessRow.check_in_method,
          instructions: accessRow.check_in_instructions,
          doorCode: accessRow.door_code,
          gateCode: accessRow.gate_code,
          wifiNetwork: accessRow.wifi_network,
          wifiPassword: accessRow.wifi_password,
        }
      : null,

    notes,
    timeline: tl,

    hostMessage: booking.host_message ?? null,
    guestFirstName:
      (booking.guest_name || guest.full_name || guest.email || "")
        .trim()
        .split(/\s+/)[0] || null,
    canRefund,
    refundDefaultMethod: (["paystack", "paypal", "eft", "manual"].includes(
      latestPayment?.method ?? "",
    )
      ? (latestPayment!.method as string)
      : "eft") as "paystack" | "paypal" | "eft" | "manual",
    hasWorkflow,

    // Shareable pay-now link — only while the booking is payable with an
    // outstanding balance. The public /pay/[token] page is built from the
    // booking's pay_token. Build an ABSOLUTE url from the request origin so it
    // works to copy/send and passes the "must be http(s)" link check — the
    // NEXT_PUBLIC_SITE_URL env isn't set in prod, which left it relative.
    payLink:
      !TERMINAL_CANCELLED.has(status) &&
      booking.payment_status !== "completed" &&
      Number(booking.total_amount) - amountPaid > 0.005
        ? {
            url: `${(() => {
              const h = headers();
              const proto = h.get("x-forwarded-proto") ?? "https";
              const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
              return host
                ? `${proto}://${host}`
                : (process.env.NEXT_PUBLIC_SITE_URL ?? "");
            })()}/pay/${booking.pay_token}`,
            reference: booking.reference,
            listingName: listing.name,
            guestName: guest.full_name ?? booking.guest_name ?? null,
            guestEmail: guest.email,
            guestPhone: guest.phone,
          }
        : null,

    // Shareable review link — only once the stay is completed and no review
    // exists yet. The public /review/[id] page is token-gated; build the same
    // ABSOLUTE tokenised URL the email + thread card use.
    reviewLink:
      status === "completed" && !reviewRow
        ? {
            url: buildReviewUrl(
              (() => {
                const h = headers();
                const proto = h.get("x-forwarded-proto") ?? "https";
                const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
                return host
                  ? `${proto}://${host}`
                  : (process.env.NEXT_PUBLIC_SITE_URL ?? "");
              })(),
              booking.id,
            ),
            reference: booking.reference,
            listingName: listing.name,
            guestName: guest.full_name ?? booking.guest_name ?? null,
            guestEmail: guest.email,
            guestPhone: guest.phone,
          }
        : null,

    // The booking's review (one per booking), shaped for the canonical
    // ReviewCard so the host can read + respond + flag from the Review tab.
    review: reviewRow
      ? {
          id: reviewRow.id,
          rating: reviewRow.rating,
          body: reviewRow.body,
          createdAt: reviewRow.created_at,
          hostResponse: reviewRow.host_response,
          hostRespondedAt: reviewRow.host_responded_at,
          flagged: reviewRow.flagged,
          guestName: guest.full_name ?? booking.guest_name ?? "Guest",
          listingName: listing.name,
          nights: booking.nights,
          stayMonth: booking.check_in
            ? new Date(booking.check_in).toLocaleDateString("en-ZA", {
                month: "short",
                year: "numeric",
              })
            : null,
          photos: (
            (reviewRow.photos as
              | { storage_path: string; sort_order: number }[]
              | null) ?? []
          )
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((p) => reviewPhotoUrl(p.storage_path)),
          isFeatured: listing.featured_review_id === reviewRow.id,
        }
      : null,
  };

  return <BookingDetail data={data} />;
}
