import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bath,
  BedDouble,
  CalendarClock,
  Check,
  CreditCard,
  ExternalLink,
  FileMinus,
  Languages,
  MapPin,
  Receipt,
  MessageSquare,
  MessageSquareQuote,
  PlaneLanding,
  Phone,
  ShieldCheck,
  Sparkles,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatMoney } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";

import { PaymentManage } from "../../payments/[id]/PaymentManage";
import { BookingActions } from "./BookingActions";
import { InternalNotes } from "./InternalNotes";
import { WelcomeNoteCard } from "./WelcomeNoteCard";
import { IssueRefundButton } from "./IssueRefundButton";

export const metadata: Metadata = {
  title: "Booking",
};

export const dynamic = "force-dynamic";

// ─── formatting helpers ──────────────────────────────────────────────
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

// ─── status + channel meta (mirrors BookingsBoard) ──────────────────
const TERMINAL_CANCELLED = new Set([
  "cancelled_by_host",
  "cancelled_by_guest",
  "declined",
  "expired",
  "no_show",
]);

function statusMeta(status: string): {
  label: string;
  tone: "confirmed" | "pending" | "cancelled" | "completed" | "inhouse";
} {
  switch (status) {
    case "confirmed":
      return { label: "Confirmed", tone: "confirmed" };
    case "checked_in":
      return { label: "In-house", tone: "inhouse" };
    case "completed":
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
      return { label: "Direct booking", mark: "V", bg: "#10B981" };
  }
}

const TONE_HERO: Record<
  ReturnType<typeof statusMeta>["tone"],
  { dot: string; chip: string }
> = {
  confirmed: {
    dot: "bg-status-confirmed",
    chip: "bg-status-confirmed/20 text-status-confirmed ring-1 ring-status-confirmed/30",
  },
  inhouse: {
    dot: "bg-status-inhouse",
    chip: "bg-status-inhouse/20 text-status-inhouse ring-1 ring-status-inhouse/30",
  },
  pending: {
    dot: "bg-status-pending",
    chip: "bg-status-pending/20 text-status-pending ring-1 ring-status-pending/30",
  },
  completed: {
    dot: "bg-status-completed",
    chip: "bg-status-completed/20 text-status-completed ring-1 ring-status-completed/30",
  },
  cancelled: {
    dot: "bg-status-cancelled",
    chip: "bg-status-cancelled/20 text-status-cancelled ring-1 ring-status-cancelled/30",
  },
};

const DAY_MS = 86_400_000;

export default async function BookingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();

  // RLS host_manage_own_bookings — only the host can read.
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, host_id, reference, status, payment_status, scope, origin, check_in, check_out, nights, guests_count, guests_breakdown, base_amount, cleaning_fee, total_amount, refund_total, currency, payment_method, special_requests, host_message, additional_guests, cancellation_reason, created_at, confirmed_at, cancelled_at, declined_at, checked_in_at, checked_out_at, has_open_refund, guest_id, guest_name, guest_email, guest_phone, listing:listings!inner ( name, slug, city, province, accommodation_type, listing_type, bedrooms, bathrooms, max_guests, check_in_time, check_out_time, cancellation_policy, cancellation_policy_label, listing_photos ( url, sort_order ) ), guest:user_profiles!bookings_guest_id_fkey ( full_name, email, phone, avatar_url, country, languages, created_at ), booking_rooms ( id, base_amount, cleaning_fee, room:listing_rooms ( name ) ), booking_addons ( id, label, quantity, unit_price, subtotal, currency, is_required, sort_order )",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!booking) notFound();

  // The payment record — single source of truth for money.
  const { data: paymentRow } = await supabase
    .from("payments")
    .select("id, status, method")
    .eq("booking_id", booking.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Financial documents attached to this booking.
  const [{ data: invoiceRow }, { data: creditNoteRows }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, status")
      .eq("booking_id", booking.id)
      .maybeSingle(),
    supabase
      .from("credit_notes")
      .select("id, credit_note_number")
      .eq("booking_id", booking.id)
      .order("issued_at", { ascending: false }),
  ]);

  // Host-only note thread.
  const { data: notesRaw } = await supabase
    .from("booking_notes")
    .select(
      "id, body, created_at, author:user_profiles!booking_notes_author_id_fkey ( full_name )",
    )
    .eq("booking_id", booking.id)
    .order("created_at", { ascending: true });

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

  // Fall back to the booking's denormalised fields (walk-ins / guests without
  // a profile) when no joined profile exists.
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
    }>
  ).sort((a, b) => a.sort_order - b.sort_order);

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

  // Guest history with THIS host (real returning-guest signal + lifetime value).
  let guestStays = 0;
  let guestLifetime = 0;
  if (booking.guest_id) {
    const { data: history } = await supabase
      .from("bookings")
      .select("total_amount, status, currency")
      .eq("guest_id", booking.guest_id)
      .eq("host_id", booking.host_id);
    for (const b of history ?? []) {
      if (!TERMINAL_CANCELLED.has(b.status as string)) {
        guestStays += 1;
        guestLifetime += Number(b.total_amount);
      }
    }
  }

  const currency = booking.currency;
  const status = booking.status;
  const meta = statusMeta(status);
  const heroTone = TONE_HERO[meta.tone];
  const channel = channelOf(booking.origin);

  // Occupancy from guests_breakdown when present, else the headline count.
  const gb = (booking.guests_breakdown ?? null) as Record<
    string,
    unknown
  > | null;
  const numOf = (v: unknown) => (typeof v === "number" ? v : 0);
  const adults = numOf(gb?.adults);
  const children = numOf(gb?.children);
  const infants = numOf(gb?.infants);
  const occupancyParts = [
    adults > 0 ? `${adults} adult${adults === 1 ? "" : "s"}` : null,
    children > 0 ? `${children} child${children === 1 ? "" : "ren"}` : null,
    infants > 0 ? `${infants} infant${infants === 1 ? "" : "s"}` : null,
  ].filter(Boolean) as string[];
  const occupancyLabel =
    occupancyParts.length > 0
      ? occupancyParts.join(" · ")
      : `${booking.guests_count} guest${booking.guests_count === 1 ? "" : "s"}`;

  const arrival = parseDateOnly(booking.check_in);
  const departure = parseDateOnly(booking.check_out);
  const created = new Date(booking.created_at);
  const now = new Date();
  const nights = booking.nights ?? 0;
  const perNight = nights > 0 ? Number(booking.base_amount) / nights : null;

  // Progress + proximity (only meaningful for live, dated bookings).
  let pct = 0;
  let progressNote = "";
  let proximity: string | null = null;
  if (arrival && departure) {
    const span = Math.max(1, departure.getTime() - created.getTime());
    pct = Math.max(
      2,
      Math.min(100, ((now.getTime() - created.getTime()) / span) * 100),
    );
    const daysSince = Math.max(
      0,
      Math.floor((now.getTime() - created.getTime()) / DAY_MS),
    );
    const daysToArrival = Math.ceil(
      (arrival.getTime() - now.getTime()) / DAY_MS,
    );

    if (TERMINAL_CANCELLED.has(status)) {
      progressNote = "Booking is no longer active";
    } else if (status === "completed" || status === "checked_out") {
      progressNote = "Stay completed";
      proximity = "Stay completed";
    } else if (status === "checked_in") {
      progressNote = `${daysSince} days since booking · guest in-house`;
      proximity = "Currently in-house";
    } else if (daysToArrival > 0) {
      progressNote = `${daysSince} days since booking · ${daysToArrival} until arrival`;
      proximity = `Arrives in ${daysToArrival} day${daysToArrival === 1 ? "" : "s"}`;
    } else if (daysToArrival === 0) {
      progressNote = `${daysSince} days since booking · arriving today`;
      proximity = "Arrives today";
    } else {
      progressNote = `${daysSince} days since booking`;
    }
  }

  const paidInFull =
    booking.payment_status === "captured" ||
    booking.payment_status === "completed" ||
    booking.payment_status === "paid";

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

  const guestName = guest.full_name || "Guest";

  return (
    <div className="space-y-6">
      {/* breadcrumb / back */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard/bookings"
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-brand-ink transition-colors hover:bg-brand-light/60"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All bookings
        </Link>
        <span className="font-mono text-[11px] text-brand-mute">
          {booking.reference}
        </span>
      </div>

      {/* ========== HERO ========== */}
      <section className="relative overflow-hidden rounded-card bg-brand-gradient-dark p-6 text-white shadow-peek lg:p-8">
        <div aria-hidden className="absolute inset-0 bg-dot-grid opacity-20" />
        <div
          aria-hidden
          className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-primary/25 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-status-inhouse/15 blur-3xl"
        />

        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[10.5px] font-semibold ${heroTone.chip}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${heroTone.dot} ${
                      meta.tone === "pending" || meta.tone === "inhouse"
                        ? "animate-pulse"
                        : ""
                    }`}
                  />
                  {meta.label}
                </span>
                {proximity ? (
                  <span className="border-white/12 inline-flex items-center gap-1.5 rounded-pill border bg-white/[0.07] px-2.5 py-1 text-[10.5px] font-semibold text-white/90 backdrop-blur">
                    <PlaneLanding className="h-3 w-3" /> {proximity}
                  </span>
                ) : null}
                <span className="border-white/12 inline-flex items-center gap-1.5 rounded-pill border bg-white/[0.07] px-2.5 py-1 text-[10.5px] font-semibold text-white/90 backdrop-blur">
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-[4px] font-display text-[9px] font-extrabold text-white"
                    style={{ background: channel.bg }}
                  >
                    {channel.mark}
                  </span>
                  {channel.label}
                </span>
              </div>

              <h1 className="mt-3 font-display text-[28px] font-extrabold leading-tight lg:text-[32px]">
                {guestName}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-brand-accent/80">
                <span className="font-mono text-brand-accent/70">
                  {booking.reference}
                </span>
                <span className="h-1 w-1 rounded-full bg-white/30" />
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {listing.name}
                  {listing.city ? ` · ${listing.city}` : ""}
                </span>
                <span className="h-1 w-1 rounded-full bg-white/30" />
                <span>Booked {fmtLong(booking.created_at)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {guest.email ? (
                <a
                  href={`mailto:${guest.email}`}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-white px-4 py-2.5 text-[13px] font-semibold text-brand-secondary transition hover:bg-brand-accent"
                >
                  <MessageSquare className="h-4 w-4" /> Email guest
                </a>
              ) : null}
              {guest.phone ? (
                <a
                  href={`tel:${guest.phone}`}
                  className="border-white/12 inline-flex h-[42px] items-center gap-1.5 rounded-[10px] border bg-white/[0.07] px-3.5 text-[13px] font-medium text-white backdrop-blur transition hover:bg-white/15"
                >
                  <Phone className="h-4 w-4" /> Call
                </a>
              ) : null}
            </div>
          </div>

          {/* stay journey */}
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <HeroTile
              label="Check-in"
              big={arrival ? fmtStayDate(arrival) : "—"}
              sub={
                listing.check_in_time
                  ? `From ${listing.check_in_time.slice(0, 5)}`
                  : "Time TBC"
              }
            />
            <HeroTile
              label="Check-out"
              big={departure ? fmtStayDate(departure) : "—"}
              sub={
                listing.check_out_time
                  ? `By ${listing.check_out_time.slice(0, 5)}`
                  : "Time TBC"
              }
            />
            <HeroTile
              label="Length"
              big={`${nights} night${nights === 1 ? "" : "s"}`}
              sub={perNight ? `${formatMoney(perNight, currency)} / night` : ""}
            />
            <HeroTile
              label="Guests"
              big={`${booking.guests_count} guest${
                booking.guests_count === 1 ? "" : "s"
              }`}
              sub={occupancyParts.length > 0 ? occupancyLabel : ""}
            />
            <div className="col-span-2 rounded-[12px] bg-brand-primary/90 p-3.5 sm:col-span-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                {paidInFull ? "Total paid" : "Total due"}
              </div>
              <div className="mt-1.5 font-display text-[20px] font-bold leading-none">
                {formatMoney(Number(booking.total_amount), currency)}
              </div>
              <div className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-white/85">
                {paidInFull ? (
                  <>
                    <Check className="h-3 w-3" /> Paid in full
                  </>
                ) : (
                  <>{booking.payment_status.replace(/_/g, " ")}</>
                )}
              </div>
            </div>
          </div>

          {/* progress */}
          {arrival && departure ? (
            <div className="mt-5">
              <div className="flex items-center justify-between text-[11px] text-brand-accent/70">
                <span>Booked</span>
                <span>Arrival</span>
                <span>Checkout</span>
              </div>
              <div className="relative mt-2 h-1.5 rounded-pill bg-white/15">
                <div
                  className="absolute left-0 top-0 h-full rounded-pill bg-brand-primary"
                  style={{ width: `${pct}%` }}
                />
                <div
                  className="absolute -top-[3px] h-3 w-3 rounded-full border-2 border-[#0a1510] bg-brand-primary"
                  style={{ left: `calc(${pct}% - 6px)` }}
                />
              </div>
              {progressNote ? (
                <div className="mt-2 text-[11px] text-brand-accent/60">
                  {progressNote}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* ========== TWO-COLUMN GRID ========== */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        {/* LEFT */}
        <div className="min-w-0 space-y-6">
          {/* GUEST */}
          <Card>
            <CardHead title="Guest">
              {guestStays > 1 ? (
                <span className="inline-flex items-center rounded-pill bg-brand-accent px-2 py-0.5 text-[10.5px] font-semibold text-brand-secondary">
                  Returning guest
                </span>
              ) : null}
            </CardHead>
            <div className="p-5">
              <div className="flex flex-wrap items-start gap-4">
                <div className="relative shrink-0">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-pill bg-brand-gradient text-[20px] font-bold text-white ring-2 ring-brand-accent">
                    {guest.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={guest.avatar_url}
                        alt={guestName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initialsOf(guest.full_name)
                    )}
                  </div>
                  {guestStays > 1 ? (
                    <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-brand-primary text-white">
                      <BadgeCheck className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[17px] font-bold text-brand-ink">
                    {guestName}
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
                    {guest.email ? (
                      <a
                        href={`mailto:${guest.email}`}
                        className="inline-flex items-center gap-2 truncate text-brand-ink hover:text-brand-primary"
                      >
                        <MessageSquare className="h-4 w-4 shrink-0 text-brand-mute" />
                        <span className="truncate">{guest.email}</span>
                      </a>
                    ) : null}
                    {guest.phone ? (
                      <a
                        href={`tel:${guest.phone}`}
                        className="inline-flex items-center gap-2 font-mono text-brand-ink hover:text-brand-primary"
                      >
                        <Phone className="h-4 w-4 shrink-0 text-brand-mute" />
                        {guest.phone}
                      </a>
                    ) : null}
                    {guest.country ? (
                      <div className="inline-flex items-center gap-2 text-brand-mute">
                        <MapPin className="h-4 w-4 text-brand-mute" />
                        {guest.country}
                      </div>
                    ) : null}
                    {guest.languages && guest.languages.length > 0 ? (
                      <div className="inline-flex items-center gap-2 text-brand-mute">
                        <Languages className="h-4 w-4 text-brand-mute" />
                        {guest.languages.join(", ")}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {booking.guest_id ? (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Stat
                    value={String(guestStays)}
                    label={
                      guestStays === 1 ? "stay with you" : "stays with you"
                    }
                  />
                  <Stat
                    value={formatMoney(guestLifetime, currency)}
                    label="lifetime value"
                  />
                  <Stat
                    value={
                      guest.created_at
                        ? String(new Date(guest.created_at).getFullYear())
                        : "—"
                    }
                    label="member since"
                  />
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {guest.email ? (
                  <Verify icon="mail" label="Email on file" />
                ) : null}
                {guest.phone ? (
                  <Verify icon="phone" label="Phone on file" />
                ) : null}
                {booking.guest_id ? (
                  <Verify icon="id" label="Registered guest" />
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold text-brand-mute">
                    Walk-in / manual
                  </span>
                )}
              </div>
            </div>
          </Card>

          {/* RESERVATION DETAILS */}
          <Card>
            <CardHead title="Reservation details">
              <span className="font-mono text-[11px] text-brand-mute">
                {booking.reference}
              </span>
            </CardHead>
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-4">
                {cover ? (
                  <div className="h-20 w-28 shrink-0 overflow-hidden rounded-[12px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cover}
                      alt={listing.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  {listing.slug ? (
                    <Link
                      href={`/listing/${listing.slug}`}
                      target="_blank"
                      className="font-display text-[16px] font-bold text-brand-ink hover:text-brand-primary"
                    >
                      {listing.name}
                    </Link>
                  ) : (
                    <span className="font-display text-[16px] font-bold text-brand-ink">
                      {listing.name}
                    </span>
                  )}
                  {propertyMeta ? (
                    <div className="mt-0.5 text-[12.5px] text-brand-mute">
                      {propertyMeta}
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {listing.bedrooms ? (
                      <FeatureChip
                        icon="bed"
                        label={`${listing.bedrooms} bedroom${
                          listing.bedrooms === 1 ? "" : "s"
                        }`}
                      />
                    ) : null}
                    {listing.bathrooms ? (
                      <FeatureChip
                        icon="bath"
                        label={`${listing.bathrooms} bath${
                          listing.bathrooms === 1 ? "" : "s"
                        }`}
                      />
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
                <DetailRow label="Occupancy" value={occupancyLabel} />
                <DetailRow
                  label="Nights"
                  value={`${nights} night${nights === 1 ? "" : "s"}`}
                />
                <DetailRow
                  label="Booking channel"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="flex h-4 w-4 items-center justify-center rounded-[4px] font-display text-[9px] font-extrabold text-white"
                        style={{ background: channel.bg }}
                      >
                        {channel.mark}
                      </span>
                      {channel.label}
                    </span>
                  }
                />
                <DetailRow
                  label="Cancellation"
                  value={
                    <span className="capitalize">{cancellationLabel}</span>
                  }
                />
              </div>

              {booking.special_requests ? (
                <div className="mt-4 rounded-[12px] border border-brand-line bg-brand-light/60 p-4">
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-brand-ink">
                    <MessageSquareQuote className="h-4 w-4 text-brand-primary" />
                    Guest note
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-brand-mute">
                    {booking.special_requests}
                  </p>
                </div>
              ) : null}

              {booking.scope === "rooms" && bookingRooms.length > 0 ? (
                <div className="mt-4">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                    Rooms ({bookingRooms.length})
                  </div>
                  <ul className="divide-y divide-brand-line rounded-[12px] border border-brand-line">
                    {bookingRooms.map((br) => (
                      <li
                        key={br.id}
                        className="flex items-center justify-between px-3.5 py-2.5"
                      >
                        <span className="text-[13px] text-brand-ink">
                          {br.room?.name ?? "Room"}
                        </span>
                        <span className="text-[13px] font-semibold text-brand-ink">
                          {formatMoney(
                            Number(br.base_amount) +
                              Number(br.cleaning_fee ?? 0),
                            currency,
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {addons.length > 0 ? (
                <div className="mt-4">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                    Add-ons &amp; extras
                  </div>
                  <ul className="divide-y divide-brand-line rounded-[12px] border border-brand-line">
                    {addons.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between px-3.5 py-2.5"
                      >
                        <span className="inline-flex items-center gap-2 text-[13px] text-brand-ink">
                          <Sparkles className="h-4 w-4 text-brand-mute" />
                          {a.label}
                          {a.quantity > 1 ? (
                            <span className="text-brand-mute">
                              × {a.quantity}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[13px] font-semibold text-brand-ink">
                          {Number(a.subtotal) === 0
                            ? a.is_required
                              ? "Included"
                              : formatMoney(0, a.currency)
                            : formatMoney(Number(a.subtotal), a.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </Card>

          {/* PAYMENT */}
          <Card>
            <CardHead title="Payment & payout">
              {paidInFull ? (
                <span className="inline-flex items-center gap-1 rounded-pill bg-status-confirmed/10 px-2 py-0.5 text-[10.5px] font-semibold text-status-confirmed">
                  <Check className="h-3 w-3" /> Paid in full
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-pill bg-status-pending/10 px-2 py-0.5 text-[10.5px] font-semibold capitalize text-status-pending">
                  {booking.payment_status.replace(/_/g, " ")}
                </span>
              )}
            </CardHead>
            <div className="p-5">
              <ul className="space-y-2.5 text-[13px]">
                <li className="flex items-center justify-between">
                  <span className="text-brand-mute">
                    {booking.scope === "rooms"
                      ? "Rooms"
                      : perNight
                        ? `${formatMoney(perNight, currency)} × ${nights} night${
                            nights === 1 ? "" : "s"
                          }`
                        : "Base"}
                  </span>
                  <span className="text-brand-ink">
                    {formatMoney(Number(booking.base_amount), currency)}
                  </span>
                </li>
                {addons.map((a) =>
                  Number(a.subtotal) > 0 ? (
                    <li
                      key={a.id}
                      className="flex items-center justify-between"
                    >
                      <span className="text-brand-mute">{a.label}</span>
                      <span className="text-brand-ink">
                        {formatMoney(Number(a.subtotal), a.currency)}
                      </span>
                    </li>
                  ) : null,
                )}
                {Number(booking.cleaning_fee) > 0 ? (
                  <li className="flex items-center justify-between">
                    <span className="text-brand-mute">
                      {booking.scope === "rooms"
                        ? "Cleaning fees"
                        : "Cleaning fee"}
                    </span>
                    <span className="text-brand-ink">
                      {formatMoney(Number(booking.cleaning_fee), currency)}
                    </span>
                  </li>
                ) : null}
                {refundTotal > 0 ? (
                  <li className="flex items-center justify-between text-status-cancelled">
                    <span className="inline-flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" /> Refunded
                    </span>
                    <span>– {formatMoney(refundTotal, currency)}</span>
                  </li>
                ) : null}
                <li className="flex items-center justify-between border-t border-brand-line pt-3">
                  <span className="font-semibold text-brand-ink">Total</span>
                  <span className="font-display text-[18px] font-bold text-brand-ink">
                    {formatMoney(Number(booking.total_amount), currency)}
                  </span>
                </li>
              </ul>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-[12px] border border-brand-line p-3.5">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute">
                    Payment method
                  </div>
                  <div className="mt-1 font-display text-[16px] font-bold capitalize text-brand-ink">
                    {booking.payment_method?.replace(/_/g, " ") ?? "—"}
                  </div>
                  <div className="mt-1 text-[11.5px] text-brand-mute">
                    {paymentRow
                      ? `Status: ${paymentRow.status.replace(/_/g, " ")}`
                      : "No payment record"}
                  </div>
                </div>
                {paymentRow ? (
                  <Link
                    href={`/dashboard/payments/${paymentRow.id}`}
                    className="flex flex-col justify-center rounded-[12px] border border-brand-line bg-brand-accent/30 p-3.5 transition hover:bg-brand-accent/50"
                  >
                    <div className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-brand-secondary">
                      <CreditCard className="h-3.5 w-3.5" /> Payment record
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-secondary">
                      View full record <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link>
                ) : null}
              </div>

              {/* Financial documents attached to this booking. */}
              {invoiceRow || (creditNoteRows && creditNoteRows.length > 0) ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-brand-line pt-4">
                  {invoiceRow ? (
                    <Link
                      href={`/dashboard/invoices/${invoiceRow.id}`}
                      className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-brand-ink transition hover:bg-brand-accent"
                    >
                      <Receipt className="h-3.5 w-3.5" /> Invoice{" "}
                      {invoiceRow.invoice_number}
                    </Link>
                  ) : null}
                  {(creditNoteRows ?? []).map((c) => (
                    <Link
                      key={c.id}
                      href={`/dashboard/credit-notes/${c.id}`}
                      className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-rose-700 transition hover:bg-rose-50"
                    >
                      <FileMinus className="h-3.5 w-3.5" />{" "}
                      {c.credit_note_number}
                    </Link>
                  ))}
                </div>
              ) : null}

              {/* EFT settlement — manage the bound payment without leaving the
                  booking. Verifying confirms the booking; failing declines it. */}
              {paymentRow &&
              paymentRow.method === "eft" &&
              (paymentRow.status === "pending" ||
                paymentRow.status === "authorised") ? (
                <div className="mt-4 rounded-[12px] border border-amber-300 bg-amber-50/60 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-900">
                    Awaiting EFT transfer
                  </div>
                  <p className="mb-3 mt-1 text-[12.5px] text-amber-900/80">
                    Confirm once the funds reflect in your account.
                  </p>
                  <PaymentManage paymentId={paymentRow.id} />
                </div>
              ) : null}
            </div>
          </Card>

          {/* ACTIVITY TIMELINE */}
          <Card>
            <CardHead title="Activity timeline" />
            <div className="p-5">
              <ol className="relative space-y-4 border-l-2 border-brand-line pl-5">
                <TimelineItem
                  iso={booking.checked_out_at}
                  title="Checked out"
                  tone="completed"
                />
                <TimelineItem
                  iso={booking.checked_in_at}
                  title="Checked in"
                  tone="inhouse"
                />
                <TimelineItem
                  iso={booking.cancelled_at}
                  title="Booking cancelled"
                  desc={booking.cancellation_reason}
                  tone="cancelled"
                />
                <TimelineItem
                  iso={booking.declined_at}
                  title="Booking declined"
                  tone="cancelled"
                />
                <TimelineItem
                  iso={booking.confirmed_at}
                  title="Booking confirmed"
                  tone="primary"
                />
                <TimelineItem
                  iso={booking.created_at}
                  title="Booking created"
                  desc={channel.label}
                  tone="mute"
                  alwaysShow
                />
              </ol>
            </div>
          </Card>
        </div>

        {/* RIGHT RAIL */}
        <div className="space-y-6">
          <div className="space-y-6 xl:sticky xl:top-[88px]">
            {/* WORKFLOW / ACTION */}
            {hasWorkflow ? (
              <Card
                className={
                  status === "pending" ? "border-status-pending/40" : undefined
                }
              >
                {status === "pending" ? (
                  <div className="flex items-center gap-2 bg-status-pending/10 px-5 py-3">
                    <CalendarClock className="h-4 w-4 text-status-pending" />
                    <span className="text-[12px] font-semibold text-brand-ink">
                      Awaiting your confirmation
                    </span>
                  </div>
                ) : (
                  <CardHead title="Manage booking" />
                )}
                <div className="px-5 py-4">
                  {status === "pending" ? (
                    <p className="mb-3 text-[12.5px] leading-relaxed text-brand-mute">
                      Review the request and confirm to lock the dates, or
                      decline to release them.
                    </p>
                  ) : null}
                  <BookingActions
                    bookingId={booking.id}
                    status={status}
                    currency={currency}
                  />
                </div>
              </Card>
            ) : null}

            {/* QUICK ACTIONS */}
            <Card>
              <CardHead title="Quick actions" />
              <div className="space-y-2 p-4">
                {listing.slug ? (
                  <RailLink
                    href={`/listing/${listing.slug}`}
                    icon={
                      <ExternalLink className="h-4 w-4 text-brand-secondary" />
                    }
                    label="View public listing"
                    external
                  />
                ) : null}
                {paymentRow ? (
                  <RailLink
                    href={`/dashboard/payments/${paymentRow.id}`}
                    icon={
                      <CreditCard className="h-4 w-4 text-brand-secondary" />
                    }
                    label="View payment record"
                  />
                ) : null}
                {booking.has_open_refund ? (
                  <RailLink
                    href="/dashboard/refunds"
                    icon={<Tag className="h-4 w-4 text-brand-secondary" />}
                    label="View open refund"
                  />
                ) : null}
                {canRefund ? (
                  <div className="pt-1">
                    <IssueRefundButton
                      bookingId={booking.id}
                      totalAmount={Number(booking.total_amount)}
                      currency={currency}
                      defaultMethod={
                        (["paystack", "paypal", "eft", "manual"].includes(
                          paymentRow?.method ?? "",
                        )
                          ? paymentRow!.method
                          : "eft") as "paystack" | "paypal" | "eft" | "manual"
                      }
                    />
                  </div>
                ) : null}
              </div>
            </Card>

            {/* STAY POLICY */}
            <Card>
              <CardHead title="Stay policy" />
              <div className="divide-y divide-brand-line">
                <PolicyRow
                  icon={<CalendarClock className="h-4 w-4" />}
                  label="Check-in"
                  value={
                    listing.check_in_time
                      ? `From ${listing.check_in_time.slice(0, 5)}`
                      : "Time TBC"
                  }
                />
                <PolicyRow
                  icon={<CalendarClock className="h-4 w-4" />}
                  label="Check-out"
                  value={
                    listing.check_out_time
                      ? `By ${listing.check_out_time.slice(0, 5)}`
                      : "Time TBC"
                  }
                />
                <PolicyRow
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="Cancellation"
                  value={
                    <span className="capitalize">{cancellationLabel}</span>
                  }
                />
              </div>
            </Card>

            {/* WELCOME NOTE (guest-facing) */}
            <Card>
              <CardHead title="Welcome note">
                <span className="inline-flex items-center rounded-pill bg-brand-accent px-2 py-0.5 text-[10.5px] font-semibold text-brand-secondary">
                  Guest sees this
                </span>
              </CardHead>
              <WelcomeNoteCard
                bookingId={booking.id}
                initial={booking.host_message ?? null}
                guestFirstName={
                  (booking.guest_name ?? "").trim().split(" ")[0] || null
                }
              />
            </Card>

            {/* INTERNAL NOTES */}
            <Card>
              <CardHead title="Internal notes">
                <span className="inline-flex items-center rounded-pill bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold text-brand-mute">
                  Host-only
                </span>
              </CardHead>
              <InternalNotes bookingId={booking.id} notes={notes} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── presentational sub-components ───────────────────────────────────
function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-card border border-brand-line bg-white shadow-card ${
        className ?? ""
      }`}
    >
      {children}
    </section>
  );
}

function CardHead({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        {title}
      </div>
      {children}
    </div>
  );
}

function HeroTile({
  label,
  big,
  sub,
}: {
  label: string;
  big: string;
  sub: string;
}) {
  return (
    <div className="border-white/12 rounded-[12px] border bg-white/[0.07] p-3.5 backdrop-blur">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/55">
        {label}
      </div>
      <div className="mt-1.5 font-display text-[20px] font-bold leading-none">
        {big}
      </div>
      {sub ? (
        <div className="mt-1.5 text-[11.5px] text-brand-accent/70">{sub}</div>
      ) : null}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[10px] bg-brand-light px-3 py-2.5">
      <div className="font-display text-[17px] font-bold text-brand-ink">
        {value}
      </div>
      <div className="text-[10.5px] text-brand-mute">{label}</div>
    </div>
  );
}

function Verify({
  icon,
  label,
}: {
  icon: "mail" | "phone" | "id";
  label: string;
}) {
  const Icon = icon === "mail" ? Check : icon === "phone" ? Phone : ShieldCheck;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-status-confirmed/10 px-2 py-0.5 text-[10.5px] font-semibold text-status-confirmed">
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function FeatureChip({ icon, label }: { icon: "bed" | "bath"; label: string }) {
  const Icon = icon === "bed" ? BedDouble : Bath;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line px-2 py-0.5 text-[10.5px] font-semibold text-brand-mute">
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-brand-line pb-3.5">
      <span className="text-[12.5px] text-brand-mute">{label}</span>
      <span className="text-[13px] font-semibold text-brand-ink">{value}</span>
    </div>
  );
}

function PolicyRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="inline-flex items-center gap-2 text-[12.5px] text-brand-mute">
        <span className="text-brand-mute">{icon}</span> {label}
      </span>
      <span className="text-[12.5px] font-semibold text-brand-ink">
        {value}
      </span>
    </div>
  );
}

function RailLink({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      className="flex items-center gap-2.5 rounded-[10px] border border-brand-line px-3 py-2.5 text-[12.5px] font-medium text-brand-ink transition hover:border-brand-primary/50 hover:bg-brand-accent/30"
    >
      {icon}
      <span className="flex-1">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-brand-mute" />
    </Link>
  );
}

const TIMELINE_DOT: Record<string, string> = {
  primary: "bg-brand-primary",
  inhouse: "bg-status-inhouse",
  completed: "bg-status-completed",
  cancelled: "bg-status-cancelled",
  mute: "bg-brand-mute",
};

function TimelineItem({
  iso,
  title,
  desc,
  tone,
  alwaysShow,
}: {
  iso: string | null;
  title: string;
  desc?: string | null;
  tone: keyof typeof TIMELINE_DOT;
  alwaysShow?: boolean;
}) {
  if (!iso && !alwaysShow) return null;
  return (
    <li>
      <span
        className={`absolute -left-[7px] mt-0.5 h-3 w-3 rounded-full border-2 border-white ${TIMELINE_DOT[tone]}`}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] font-semibold text-brand-ink">{title}</div>
        {iso ? (
          <div className="shrink-0 font-mono text-[11px] text-brand-mute">
            {fmtStamp(iso)}
          </div>
        ) : null}
      </div>
      {desc ? <div className="text-[12px] text-brand-mute">{desc}</div> : null}
    </li>
  );
}
