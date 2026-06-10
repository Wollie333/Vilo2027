"use client";

import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Bath,
  BedDouble,
  Check,
  ChevronRight,
  CreditCard,
  DoorOpen,
  ExternalLink,
  KeyRound,
  Languages,
  MailCheck,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  PhoneCall,
  Phone,
  PlaneLanding,
  PlusCircle,
  Receipt,
  ShieldCheck,
  Star,
  UserPlus,
  UserRound,
  Users,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  GuestMessagesPanel,
  type MessageItem,
  type TemplateItem,
} from "@/components/messages/GuestMessagesPanel";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import type { Txn } from "@/lib/finance/transactions";
import { formatMoney } from "@/lib/format";

import { BookingActions } from "./BookingActions";
import { addBookingGuestAction } from "./guest-actions";
import { InternalNotes } from "./InternalNotes";
import { IssueRefundButton } from "./IssueRefundButton";
import { AcceptedQuotePill } from "@/app/dashboard/_components/AcceptedQuotePill";

import { RecordTabs } from "@/app/dashboard/_components/RecordTabs";
import {
  ReviewCard,
  type ReviewCardProps,
} from "@/app/dashboard/reviews/ReviewCard";

import { PaymentsManager } from "./PaymentsManager";
import { ReviewLinkCard } from "./ReviewLinkCard";
import { WelcomeNoteCard } from "./WelcomeNoteCard";

export type BookingTimelineItem = {
  title: string;
  desc: string | null;
  stamp: string;
  tone: "primary" | "inhouse" | "completed" | "cancelled" | "mute" | "pending";
};

export type BookingDetailData = {
  id: string;
  reference: string;
  /** The host↔guest conversation shown on the Messages tab — the SAME thread as
   * the guest record's Messages tab (null until a conversation exists). */
  conversationId: string | null;
  messages: MessageItem[];
  templates: TemplateItem[];
  /** Guest's user id + listing context — lets the host START a thread from the
   * Messages tab when none exists yet (guestId null = email-only, can't start). */
  guestId: string | null;
  listingId: string;
  status: string;
  statusLabel: string;
  statusTone: "confirmed" | "pending" | "cancelled" | "completed" | "inhouse";
  paymentStatus: string;
  paidInFull: boolean;

  channelLabel: string;
  channelMark: string;
  channelBg: string;
  /** Set when the originating quote is accepted-but-not-converted — drives the
   * pulsing "Quote accepted" pill + auto-prompt to convert. */
  acceptedQuote: { id: string; amount: number; currency: string } | null;

  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guestAvatar: string | null;
  guestCountry: string | null;
  guestLanguages: string[];
  guestRegistered: boolean;
  guestGkey: string | null;
  memberSinceYear: string | null;
  guestStays: number;
  guestLifetime: number;
  guestRating: number | null;
  returning: boolean;
  // Optional party manifest captured at checkout — guests beyond the lead booker.
  // gkey links each member (with an email) to their own guest record.
  additionalGuests: {
    name: string;
    email: string | null;
    phone: string | null;
    gkey: string | null;
  }[];

  listingName: string;
  listingSlug: string | null;
  listingCity: string | null;
  propertyMeta: string;
  cover: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  cancellationLabel: string;

  nights: number;
  perNight: number | null;
  guestsCount: number;
  occupancyLabel: string;
  totalAmount: number;
  baseAmount: number;
  cleaningFee: number;
  vatAmount: number;
  vatRate: number;
  currency: string;
  refundTotal: number;

  checkInBig: string;
  checkInSub: string;
  checkOutBig: string;
  checkOutSub: string;
  checkInFull: string;
  checkOutFull: string;
  bookedLong: string;

  arrivalProximity: string | null;
  arrivalBig: string;
  arrivalSub: string;
  progressPct: number | null;
  progressNote: string;

  specialRequests: string | null;
  scope: string;
  bookingRooms: { id: string; name: string; amount: number }[];
  addons: {
    id: string;
    label: string;
    quantity: number;
    subtotal: number;
    currency: string;
    isRequired: boolean;
    source: string;
  }[];
  addonsSubtotal: number;
  addonCatalog: {
    id: string;
    name: string;
    unitPrice: number;
    active: boolean;
  }[];
  canEditAddons: boolean;

  paymentMethod: string | null;
  paymentRecordId: string | null;
  paymentRowStatus: string | null;
  showEftManage: boolean;

  // Payment ledger.
  amountPaid: number;
  balanceDue: number;
  depositAmount: number;
  guestCredit: number;
  // Canonical transactions for this booking (charges + payments incl. pending),
  // rendered with the shared <LedgerList> — the same source as the Ledger.
  txns: Txn[];

  invoice: { id: string; number: string } | null;
  creditNotes: { id: string; number: string }[];

  access: {
    checkInMethod: string | null;
    instructions: string | null;
    doorCode: string | null;
    gateCode: string | null;
    wifiNetwork: string | null;
    wifiPassword: string | null;
  } | null;

  notes: {
    id: string;
    body: string;
    created_at: string;
    authorName: string;
    authorInitials: string;
  }[];
  timeline: BookingTimelineItem[];

  hostMessage: string | null;
  guestFirstName: string | null;
  canRefund: boolean;
  refundDefaultMethod: "paystack" | "paypal" | "eft" | "manual";
  hasWorkflow: boolean;
  payLink: {
    url: string;
    reference: string;
    listingName: string;
    guestName: string | null;
    guestEmail: string | null;
    guestPhone: string | null;
  } | null;
  reviewLink: {
    url: string;
    reference: string;
    listingName: string;
    guestName: string | null;
    guestEmail: string | null;
    guestPhone: string | null;
  } | null;
  review: ReviewCardProps | null;
};

const STATUS_TAG: Record<
  BookingDetailData["statusTone"],
  { cls: string; dot: string }
> = {
  confirmed: {
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-status-confirmed",
  },
  inhouse: {
    cls: "bg-sky-50 text-sky-600 border-sky-200",
    dot: "bg-status-inhouse",
  },
  completed: {
    cls: "bg-indigo-50 text-indigo-600 border-indigo-200",
    dot: "bg-status-completed",
  },
  pending: {
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-status-pending",
  },
  cancelled: {
    cls: "bg-red-50 text-red-600 border-red-200",
    dot: "bg-status-cancelled",
  },
};

const TIMELINE_DOT: Record<BookingTimelineItem["tone"], string> = {
  primary: "bg-brand-primary",
  inhouse: "bg-status-inhouse",
  completed: "bg-status-completed",
  cancelled: "bg-status-cancelled",
  pending: "bg-status-pending",
  mute: "bg-brand-mute",
};

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "G";
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "payments", label: "Payments" },
  { key: "arrivals", label: "Arrivals" },
  { key: "guests", label: "Guests" },
  { key: "messages", label: "Messages" },
  { key: "review", label: "Review" },
  { key: "activity", label: "Activity" },
  { key: "notes", label: "Notes" },
] as const;

export function BookingDetail({ data: d }: { data: BookingDetailData }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "overview";
  const [moreOpen, setMoreOpen] = useState(false);

  const setTab = (t: string) => {
    const next = new URLSearchParams(params.toString());
    if (t === "overview") next.delete("tab");
    else next.set("tab", t);
    router.push(`${pathname}?${next.toString()}`);
  };

  const tag = STATUS_TAG[d.statusTone];

  const tabCount = (k: string): number | undefined => {
    if (k === "activity") return d.timeline.length || undefined;
    if (k === "notes") return d.notes.length || undefined;
    // Whole party = lead booker + named additional guests.
    if (k === "guests") return d.additionalGuests.length + 1;
    return undefined;
  };

  return (
    <div className="mx-auto max-w-[1040px] px-4 py-5 lg:px-6">
      {/* sub-header */}
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/dashboard/bookings"
          className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-brand-line px-3 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
        >
          <ArrowLeft className="h-4 w-4 text-brand-mute" /> All bookings
        </Link>
        <div className="hidden items-center gap-2 text-[12.5px] md:flex">
          <Link
            href="/dashboard/bookings"
            className="text-brand-mute hover:text-brand-ink"
          >
            Bookings
          </Link>
          <ChevronRight className="h-3 w-3 text-brand-line" />
          <span className="font-mono font-semibold text-brand-ink">
            {d.reference}
          </span>
        </div>
      </div>

      {/* identity header */}
      <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <div className="p-6 lg:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-4">
              <div className="relative shrink-0">
                {d.guestAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.guestAvatar}
                    alt={d.guestName}
                    className="h-16 w-16 rounded-pill object-cover ring-2 ring-brand-accent"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-pill bg-brand-secondary font-display text-xl font-bold text-white ring-2 ring-brand-accent">
                    {initials(d.guestName)}
                  </div>
                )}
                {d.returning ? (
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-brand-primary text-white">
                    <BadgeCheck className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-[24px] font-extrabold leading-tight text-brand-ink">
                    {d.guestName}
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-[11.5px] font-semibold ${tag.cls}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${tag.dot}`} />
                    {d.statusLabel}
                  </span>
                  {d.returning ? (
                    <span className="rounded-pill bg-brand-accent px-2 py-0.5 text-[10.5px] font-semibold text-brand-secondary">
                      Returning guest
                    </span>
                  ) : null}
                  {d.acceptedQuote ? (
                    <AcceptedQuotePill
                      quoteId={d.acceptedQuote.id}
                      guestFirstName={(d.guestName || "Guest").split(/\s+/)[0]}
                      amount={d.acceptedQuote.amount}
                      currency={d.acceptedQuote.currency}
                      autoOpen
                    />
                  ) : null}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-brand-mute">
                  <span className="font-mono text-[11px] text-brand-ink">
                    {d.reference}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-brand-line" />
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> {d.listingName}
                    {d.listingCity ? ` · ${d.listingCity}` : ""}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-brand-line" />
                  <span>Booked {d.bookedLong}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold text-brand-mute">
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-[4px] font-display text-[9px] font-extrabold text-white"
                      style={{ background: d.channelBg }}
                    >
                      {d.channelMark}
                    </span>
                    {d.channelLabel}
                  </span>
                  {d.arrivalProximity ? (
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold text-brand-mute">
                      <PlaneLanding className="h-3 w-3" /> {d.arrivalProximity}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold capitalize text-brand-mute">
                    <ShieldCheck className="h-3 w-3" /> {d.cancellationLabel}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {d.guestEmail ? (
                <a
                  href={`mailto:${d.guestEmail}`}
                  className="inline-flex h-[42px] items-center gap-1.5 rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary"
                >
                  <MessageSquare className="h-4 w-4" /> Message
                </a>
              ) : null}
              {d.guestPhone ? (
                <a
                  href={`tel:${d.guestPhone}`}
                  className="inline-flex h-[42px] items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
                >
                  <Phone className="h-4 w-4 text-brand-mute" /> Call
                </a>
              ) : null}
              <div className="relative">
                <button
                  onClick={() => setMoreOpen((v) => !v)}
                  onBlur={() => setTimeout(() => setMoreOpen(false), 150)}
                  className="flex h-[42px] w-[42px] items-center justify-center rounded-pill border border-brand-line text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
                  title="More"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
                {moreOpen ? (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[220px] rounded-xl border border-brand-line bg-white p-1.5 shadow-lift">
                    {d.listingSlug ? (
                      <a
                        href={`/listing/${d.listingSlug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-brand-ink hover:bg-brand-light"
                      >
                        <ExternalLink className="h-4 w-4 text-brand-mute" />{" "}
                        View public listing
                      </a>
                    ) : null}
                    {d.paymentRecordId ? (
                      <Link
                        href={`/dashboard/payments/${d.paymentRecordId}`}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-brand-ink hover:bg-brand-light"
                      >
                        <CreditCard className="h-4 w-4 text-brand-mute" />{" "}
                        Payment record
                      </Link>
                    ) : null}
                    {d.invoice ? (
                      <Link
                        href={`/dashboard/invoices/${d.invoice.id}`}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-brand-ink hover:bg-brand-light"
                      >
                        <Receipt className="h-4 w-4 text-brand-mute" /> Invoice{" "}
                        {d.invoice.number}
                      </Link>
                    ) : null}
                    {d.guestGkey ? (
                      <Link
                        href={`/dashboard/guests/${d.guestGkey}`}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-brand-ink hover:bg-brand-light"
                      >
                        <Users className="h-4 w-4 text-brand-mute" /> Guest
                        record
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* stat band */}
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-brand-line bg-brand-line sm:grid-cols-3 lg:grid-cols-5">
            <StatTile
              label="Nights"
              value={String(d.nights)}
              sub={`${d.checkInBig} → ${d.checkOutBig}`}
            />
            <StatTile
              label="Guests"
              value={String(d.guestsCount)}
              sub={d.occupancyLabel}
            />
            <StatTile
              label="Nightly rate"
              value={d.perNight ? formatMoney(d.perNight, d.currency) : "—"}
              sub="per night"
            />
            <StatTile
              label={d.paidInFull ? "Total paid" : "Total due"}
              value={formatMoney(d.totalAmount, d.currency)}
              sub={
                d.paidInFull
                  ? "Paid in full"
                  : d.paymentStatus.replace(/_/g, " ")
              }
              subTone={d.paidInFull ? "good" : undefined}
            />
            <div className="col-span-2 bg-brand-secondary p-4 sm:col-span-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                Arrival
              </div>
              <div className="mt-1.5 font-display text-[18px] font-bold leading-none text-white">
                {d.arrivalBig}
              </div>
              <div className="mt-1 text-[11px] text-brand-accent">
                {d.arrivalSub}
              </div>
            </div>
          </div>

          {/* progress */}
          {d.progressPct !== null ? (
            <div className="mt-5">
              <div className="flex items-center justify-between text-[10.5px] font-medium text-brand-mute">
                <span>Booked · {d.bookedLong}</span>
                {d.progressNote ? (
                  <span className="font-semibold text-brand-primary">
                    {d.progressNote}
                  </span>
                ) : null}
                <span>Checkout · {d.checkOutBig}</span>
              </div>
              <div className="relative mt-2 h-1.5 rounded-pill bg-brand-line">
                <div
                  className="absolute left-0 top-0 h-full rounded-pill bg-brand-primary"
                  style={{ width: `${d.progressPct}%` }}
                />
                <div
                  className="absolute -top-[3px] h-3 w-3 rounded-full border-2 border-white bg-brand-primary shadow"
                  style={{ left: `calc(${d.progressPct}% - 6px)` }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* tabs */}
      <RecordTabs
        className="mt-6"
        active={tab}
        onSelect={setTab}
        tabs={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count: tabCount(t.key),
        }))}
      />

      <div className="mt-6">
        {tab === "overview" ? (
          <OverviewPanel d={d} setTab={setTab} />
        ) : tab === "payments" ? (
          <PaymentsPanel d={d} />
        ) : tab === "arrivals" ? (
          <ArrivalsPanel d={d} />
        ) : tab === "guests" ? (
          <GuestsPanel d={d} />
        ) : tab === "messages" ? (
          <GuestMessagesPanel
            firstName={(d.guestName || "guest").split(/\s+/)[0]}
            messages={d.messages}
            conversationId={d.conversationId}
            templates={d.templates}
            isRegistered={d.guestRegistered}
            guestId={d.guestId}
            bookingId={d.id}
            listingId={d.listingId}
          />
        ) : tab === "review" ? (
          <ReviewPanel d={d} />
        ) : tab === "activity" ? (
          <ActivityPanel d={d} />
        ) : (
          <NotesPanel d={d} />
        )}
      </div>
      <div className="h-6" />
    </div>
  );
}

// ── shared bits ──────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      {children}
    </section>
  );
}
function CardHead({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        {title}
      </div>
      {right}
    </div>
  );
}
function StatTile({
  label,
  value,
  sub,
  subTone,
}: {
  label: string;
  value: string;
  sub: string;
  subTone?: "good";
}) {
  return (
    <div className="bg-[#FAFCFB] p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        {label}
      </div>
      <div className="mt-1.5 font-display text-[22px] font-bold leading-none text-brand-ink">
        {value}
      </div>
      <div
        className={`mt-1 truncate text-[11px] ${subTone === "good" ? "font-medium text-status-confirmed" : "text-brand-mute"}`}
      >
        {sub}
      </div>
    </div>
  );
}
function FeatureChip({
  icon: Icon,
  label,
}: {
  icon: typeof BedDouble;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line px-2 py-0.5 text-[10.5px] font-semibold text-brand-mute">
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────
function OverviewPanel({
  d,
  setTab,
}: {
  d: BookingDetailData;
  setTab: (t: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardHead
            title="Reservation summary"
            right={
              <span className="font-mono text-[11px] text-brand-mute">
                {d.reference}
              </span>
            }
          />
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-4">
              {d.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={d.cover}
                  alt={d.listingName}
                  className="h-20 w-28 shrink-0 rounded-[12px] object-cover"
                />
              ) : (
                <div className="h-20 w-28 shrink-0 rounded-[12px] bg-brand-light" />
              )}
              <div className="min-w-0 flex-1">
                {d.listingSlug ? (
                  <Link
                    href={`/listing/${d.listingSlug}`}
                    target="_blank"
                    className="font-display text-[16px] font-bold text-brand-ink hover:text-brand-primary"
                  >
                    {d.listingName}
                  </Link>
                ) : (
                  <span className="font-display text-[16px] font-bold text-brand-ink">
                    {d.listingName}
                  </span>
                )}
                {d.propertyMeta ? (
                  <div className="mt-0.5 text-[12.5px] text-brand-mute">
                    {d.propertyMeta}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {d.bedrooms ? (
                    <FeatureChip
                      icon={BedDouble}
                      label={`${d.bedrooms} bedroom${d.bedrooms === 1 ? "" : "s"}`}
                    />
                  ) : null}
                  {d.bathrooms ? (
                    <FeatureChip
                      icon={Bath}
                      label={`${d.bathrooms} bath${d.bathrooms === 1 ? "" : "s"}`}
                    />
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
              <SummaryRow label="Check-in" value={d.checkInFull} />
              <SummaryRow label="Check-out" value={d.checkOutFull} />
              <SummaryRow label="Occupancy" value={d.occupancyLabel} />
              <SummaryRow
                label="Cancellation"
                value={
                  <span className="capitalize">{d.cancellationLabel}</span>
                }
              />
            </div>
            {d.specialRequests ? (
              <div className="mt-4 rounded-[12px] border border-brand-line bg-brand-light/60 p-4">
                <div className="flex items-center gap-2 text-[12px] font-semibold text-brand-ink">
                  <MessageSquare className="h-4 w-4 text-brand-primary" /> Guest
                  note
                </div>
                <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-brand-mute">
                  {d.specialRequests}
                </p>
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        {d.hasWorkflow ? (
          <Card>
            <div className="flex items-center gap-2 bg-status-pending/10 px-5 py-3">
              <AlertCircle className="h-4 w-4 text-status-pending" />
              <span className="text-[12px] font-semibold text-brand-ink">
                {d.status === "pending"
                  ? "Awaiting your confirmation"
                  : "Manage booking"}
              </span>
            </div>
            <div className="px-5 py-4">
              {d.status === "pending" ? (
                <p className="mb-3 text-[12.5px] leading-relaxed text-brand-mute">
                  Review the request and confirm to lock the dates, or decline
                  to release them.
                </p>
              ) : null}
              <BookingActions
                bookingId={d.id}
                status={d.status}
                currency={d.currency}
              />
            </div>
          </Card>
        ) : null}

        <Card>
          <CardHead title="At a glance" />
          <div className="divide-y divide-brand-line">
            <GlanceRow
              icon={CreditCard}
              label="Payment"
              onClick={() => setTab("payments")}
              right={
                <span className="inline-flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-brand-ink">
                    {formatMoney(d.totalAmount, d.currency)}
                  </span>
                  {d.paidInFull ? (
                    <span className="inline-flex items-center gap-1 rounded-pill border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed" />
                      Paid
                    </span>
                  ) : null}
                </span>
              }
            />
            <GlanceRow
              icon={PlusCircle}
              label="Add-ons"
              onClick={() => setTab("payments")}
              right={
                <span className="text-[13px] font-semibold text-brand-ink">
                  {d.addons.length} ·{" "}
                  {formatMoney(d.addonsSubtotal, d.currency)}
                </span>
              }
            />
            <GlanceRow
              icon={KeyRound}
              label="Check-in"
              onClick={() => setTab("arrivals")}
              right={
                <span className="text-[13px] font-semibold text-brand-ink">
                  {d.checkInBig}
                </span>
              }
            />
            <GlanceRow
              icon={UserRound}
              label="Guest"
              onClick={() => setTab("guests")}
              right={
                <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink">
                  {d.guestStays} stay{d.guestStays === 1 ? "" : "s"}
                  {d.guestRating ? (
                    <>
                      {" · "}
                      {d.guestRating}
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    </>
                  ) : null}
                </span>
              }
            />
          </div>
        </Card>

        <Card>
          <CardHead
            title="Welcome note"
            right={
              <span className="rounded-pill bg-brand-accent px-2 py-0.5 text-[10.5px] font-semibold text-brand-secondary">
                Guest sees this
              </span>
            }
          />
          <WelcomeNoteCard
            bookingId={d.id}
            initial={d.hostMessage}
            guestFirstName={d.guestFirstName}
          />
        </Card>
      </div>
    </div>
  );
}

function SummaryRow({
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

function GlanceRow({
  icon: Icon,
  label,
  right,
  onClick,
}: {
  icon: typeof CreditCard;
  label: string;
  right: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2.5 px-5 py-3 text-left transition hover:bg-[#FAFCFB]"
    >
      <span className="inline-flex items-center gap-2.5 text-[12.5px] text-brand-mute">
        <Icon className="h-4 w-4" /> {label}
      </span>
      {right}
    </button>
  );
}

// ── Payments ────────────────────────────────────────────────────────────────
function PaymentsPanel({ d }: { d: BookingDetailData }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHead
          title="Payment & payout"
          right={
            d.paidInFull ? (
              <span className="inline-flex items-center gap-1 rounded-pill border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">
                <Check className="h-3 w-3" /> Paid in full
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-pill border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold capitalize text-amber-700">
                {d.paymentStatus.replace(/_/g, " ")}
              </span>
            )
          }
        />
        <div className="p-5">
          <ul className="space-y-2.5 text-[13px]">
            <li className="flex items-center justify-between">
              <span className="text-brand-mute">
                {d.scope === "rooms"
                  ? "Rooms"
                  : d.perNight
                    ? `${formatMoney(d.perNight, d.currency)} × ${d.nights} night${d.nights === 1 ? "" : "s"}`
                    : "Base"}
              </span>
              <span className="text-brand-ink">
                {formatMoney(d.baseAmount, d.currency)}
              </span>
            </li>
            {d.addons.map((a) =>
              Number(a.subtotal) > 0 ? (
                <li key={a.id} className="flex items-center justify-between">
                  <span className="text-brand-mute">{a.label}</span>
                  <span className="text-brand-ink">
                    {formatMoney(Number(a.subtotal), a.currency)}
                  </span>
                </li>
              ) : null,
            )}
            {d.cleaningFee > 0 ? (
              <li className="flex items-center justify-between">
                <span className="text-brand-mute">Cleaning fee</span>
                <span className="text-brand-ink">
                  {formatMoney(d.cleaningFee, d.currency)}
                </span>
              </li>
            ) : null}
            {d.vatAmount > 0 ? (
              <li className="flex items-center justify-between">
                <span className="text-brand-mute">
                  VAT{d.vatRate > 0 ? ` (${d.vatRate}%)` : ""}
                </span>
                <span className="text-brand-ink">
                  {formatMoney(d.vatAmount, d.currency)}
                </span>
              </li>
            ) : null}
            {d.refundTotal > 0 ? (
              <li className="flex items-center justify-between text-status-cancelled">
                <span>Refunded</span>
                <span>– {formatMoney(d.refundTotal, d.currency)}</span>
              </li>
            ) : null}
            <li className="flex items-center justify-between border-t border-brand-line pt-3">
              <span className="font-semibold text-brand-ink">
                Total{d.vatAmount > 0 ? " (incl. VAT)" : ""}
              </span>
              <span className="font-display text-[18px] font-bold text-brand-ink">
                {formatMoney(d.totalAmount, d.currency)}
              </span>
            </li>
          </ul>

          <div className="mt-5">
            <PaymentsManager
              bookingId={d.id}
              currency={d.currency}
              totalAmount={d.totalAmount}
              amountPaid={d.amountPaid}
              balanceDue={d.balanceDue}
              depositAmount={d.depositAmount}
              guestCredit={d.guestCredit}
              txns={d.txns}
              canRecord={d.hasWorkflow || d.status === "completed"}
              addonCatalog={d.addonCatalog}
              canAddAddons={d.canEditAddons}
              payLink={d.payLink}
            />
          </div>

          {d.canRefund ? (
            <div className="mt-4 border-t border-brand-line pt-4">
              <IssueRefundButton
                bookingId={d.id}
                totalAmount={d.totalAmount}
                currency={d.currency}
                defaultMethod={d.refundDefaultMethod}
              />
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

// ── Arrivals ────────────────────────────────────────────────────────────────
function ArrivalsPanel({ d }: { d: BookingDetailData }) {
  const a = d.access;
  const hasAccess =
    a &&
    (a.doorCode ||
      a.gateCode ||
      a.wifiNetwork ||
      a.checkInMethod ||
      a.instructions);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardHead title="Arrival & departure" />
          <div className="p-5">
            <div className="flex items-stretch gap-4">
              <div className="flex-1 rounded-[12px] border border-brand-line p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                  Check-in
                </div>
                <div className="mt-1.5 font-display text-[18px] font-bold leading-none text-brand-ink">
                  {d.checkInBig}
                </div>
                <div className="mt-1.5 text-[12px] text-brand-mute">
                  {d.checkInSub}
                </div>
              </div>
              <div className="flex flex-col items-center justify-center px-1">
                <span className="whitespace-nowrap rounded-pill bg-brand-accent px-2.5 py-0.5 text-[11px] font-bold text-brand-secondary">
                  {d.nights} night{d.nights === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex-1 rounded-[12px] border border-brand-line p-4 text-right">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                  Check-out
                </div>
                <div className="mt-1.5 font-display text-[18px] font-bold leading-none text-brand-ink">
                  {d.checkOutBig}
                </div>
                <div className="mt-1.5 text-[12px] text-brand-mute">
                  {d.checkOutSub}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="Access & keys" />
          {hasAccess ? (
            <div className="divide-y divide-brand-line">
              {a?.checkInMethod ? (
                <AccessRow
                  icon={DoorOpen}
                  label="Check-in"
                  value={a.checkInMethod}
                />
              ) : null}
              {a?.doorCode ? (
                <AccessRow
                  icon={KeyRound}
                  label="Door code"
                  value={a.doorCode}
                  mono
                />
              ) : null}
              {a?.gateCode ? (
                <AccessRow
                  icon={KeyRound}
                  label="Gate code"
                  value={a.gateCode}
                  mono
                />
              ) : null}
              {a?.wifiNetwork ? (
                <AccessRow
                  icon={Wifi}
                  label="Wi-Fi"
                  value={
                    a.wifiPassword
                      ? `${a.wifiNetwork} · ${a.wifiPassword}`
                      : a.wifiNetwork
                  }
                  mono
                />
              ) : null}
              {a?.instructions ? (
                <div className="px-5 py-3 text-[12.5px] leading-relaxed text-brand-mute">
                  {a.instructions}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="px-5 py-6 text-[12.5px] text-brand-mute">
              No access details saved for this listing yet. Add them under{" "}
              <span className="font-semibold text-brand-ink">
                Listings → Guest access
              </span>
              .
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHead title="Stay policy" />
          <div className="divide-y divide-brand-line">
            <AccessRow icon={KeyRound} label="Check-in" value={d.checkInSub} />
            <AccessRow
              icon={KeyRound}
              label="Check-out"
              value={d.checkOutSub}
            />
            <AccessRow
              icon={ShieldCheck}
              label="Cancellation"
              value={d.cancellationLabel}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function AccessRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof KeyRound;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="inline-flex items-center gap-2 text-[12.5px] text-brand-mute">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <span
        className={`text-[12.5px] font-semibold capitalize text-brand-ink ${mono ? "font-mono tracking-wide" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

// ── Guests (lead booker + party) ─────────────────────────────────────────────
function GuestsPanel({ d }: { d: BookingDetailData }) {
  return (
    <Card>
      <CardHead
        title="Lead guest"
        right={
          d.guestGkey ? (
            <Link
              href={`/dashboard/guests/${d.guestGkey}`}
              className="text-[12px] font-medium text-brand-primary hover:underline"
            >
              View full profile →
            </Link>
          ) : undefined
        }
      />
      <div className="p-5">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
          {d.guestEmail ? (
            <a
              href={`mailto:${d.guestEmail}`}
              className="inline-flex items-center gap-2 truncate text-brand-ink hover:text-brand-primary"
            >
              <MailCheck className="h-4 w-4 shrink-0 text-brand-mute" />
              <span className="truncate">{d.guestEmail}</span>
            </a>
          ) : null}
          {d.guestPhone ? (
            <a
              href={`tel:${d.guestPhone}`}
              className="inline-flex items-center gap-2 text-brand-ink hover:text-brand-primary"
            >
              <Phone className="h-4 w-4 shrink-0 text-brand-mute" />
              {d.guestPhone}
            </a>
          ) : null}
          {d.guestCountry ? (
            <span className="inline-flex items-center gap-2 text-brand-mute">
              <MapPin className="h-4 w-4 text-brand-mute" /> {d.guestCountry}
            </span>
          ) : null}
          {d.guestLanguages.length > 0 ? (
            <span className="inline-flex items-center gap-2 text-brand-mute">
              <Languages className="h-4 w-4 text-brand-mute" />
              {d.guestLanguages.join(", ")}
            </span>
          ) : null}
        </div>

        {d.guestRegistered ? (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat value={String(d.guestStays)} label="stays with you" />
            <MiniStat
              value={
                d.guestRating ? (
                  <span className="inline-flex items-center gap-1">
                    {d.guestRating}
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  </span>
                ) : (
                  "—"
                )
              }
              label="guest rating"
            />
            <MiniStat
              value={formatMoney(d.guestLifetime, d.currency)}
              label="lifetime value"
            />
            <MiniStat value={d.memberSinceYear ?? "—"} label="member since" />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {d.guestEmail ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-status-confirmed/10 px-2 py-0.5 text-[10.5px] font-semibold text-status-confirmed">
              <MailCheck className="h-3 w-3" /> Email on file
            </span>
          ) : null}
          {d.guestPhone ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-status-confirmed/10 px-2 py-0.5 text-[10.5px] font-semibold text-status-confirmed">
              <PhoneCall className="h-3 w-3" /> Phone on file
            </span>
          ) : null}
          {d.guestRegistered ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-status-confirmed/10 px-2 py-0.5 text-[10.5px] font-semibold text-status-confirmed">
              <ShieldCheck className="h-3 w-3" /> Registered guest
            </span>
          ) : (
            <span className="rounded-pill bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold text-brand-mute">
              Walk-in / manual
            </span>
          )}
        </div>

        <PartySection d={d} />
      </div>
    </Card>
  );
}

// The rest of the party named at checkout. Each member with an email is its own
// guest record (materialised on confirmation), so the host can open + contact
// them individually. The host can also add a guest to the booking here.
function PartySection({ d }: { d: BookingDetailData }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, start] = useTransition();

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
  };

  function submit() {
    start(async () => {
      const res = await addBookingGuestAction(d.id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      if (res.ok) {
        toast.success("Guest added to booking");
        setAddOpen(false);
        reset();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const canSubmit = name.trim().length > 0 && /\S+@\S+\.\S+/.test(email.trim());

  return (
    <div className="mt-5 border-t border-brand-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
          <Users className="h-3.5 w-3.5" />
          Others in the party · {d.additionalGuests.length}
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 py-1.5 text-[12px] font-semibold text-brand-ink transition hover:bg-brand-light"
        >
          <UserPlus className="h-3.5 w-3.5 text-brand-mute" /> Add guest
        </button>
      </div>

      {d.additionalGuests.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-brand-mute">
          No other guests named on this booking yet. Add one to keep their
          details and reach them directly.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {d.additionalGuests.map((g, i) => (
            <li
              key={i}
              className="flex flex-col gap-1 rounded-[10px] bg-brand-light px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              {g.gkey ? (
                <Link
                  href={`/dashboard/guests/${g.gkey}`}
                  className="inline-flex items-center gap-2 text-[13px] font-semibold text-brand-ink hover:text-brand-primary"
                >
                  <UserRound className="h-4 w-4 shrink-0 text-brand-mute" />
                  {g.name}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-brand-ink">
                  <UserRound className="h-4 w-4 shrink-0 text-brand-mute" />
                  {g.name}
                </span>
              )}
              {g.email || g.phone ? (
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-6 text-[12px] text-brand-mute sm:pl-0">
                  {g.email ? (
                    <a
                      href={`mailto:${g.email}`}
                      className="inline-flex items-center gap-1.5 hover:text-brand-primary"
                    >
                      <MailCheck className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{g.email}</span>
                    </a>
                  ) : null}
                  {g.phone ? (
                    <a
                      href={`tel:${g.phone}`}
                      className="inline-flex items-center gap-1.5 hover:text-brand-primary"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {g.phone}
                    </a>
                  ) : null}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <FormModal
        open={addOpen}
        onOpenChange={setAddOpen}
        size="sm"
        title="Add a guest to this booking"
        description="Name and email are required so they get their own guest record you can contact later."
      >
        <form
          id="add-booking-guest-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) submit();
          }}
          className="space-y-2.5"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            autoFocus
            maxLength={120}
            className="h-10 w-full rounded-lg border border-brand-line bg-white px-3 text-sm text-brand-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            maxLength={160}
            className="h-10 w-full rounded-lg border border-brand-line bg-white px-3 text-sm text-brand-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (optional)"
            maxLength={40}
            className="h-10 w-full rounded-lg border border-brand-line bg-white px-3 text-sm text-brand-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </form>
        <FormModalFooter>
          <FormModalCancel>Cancel</FormModalCancel>
          <button
            type="submit"
            form="add-booking-guest-form"
            disabled={!canSubmit || pending}
            className="rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-secondary disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add guest"}
          </button>
        </FormModalFooter>
      </FormModal>
    </div>
  );
}

function MiniStat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-[10px] bg-brand-light px-3 py-2.5">
      <div className="font-display text-[17px] font-bold text-brand-ink">
        {value}
      </div>
      <div className="text-[10.5px] text-brand-mute">{label}</div>
    </div>
  );
}

// ── Activity ─────────────────────────────────────────────────────────────────
// ── Review ──────────────────────────────────────────────────────────────────
// The review for this booking. Reuses the canonical host ReviewCard (read +
// respond + flag); when there's no review yet, shows the shareable review link.
function ReviewPanel({ d }: { d: BookingDetailData }) {
  if (d.review) {
    return (
      <div className="space-y-4">
        <ReviewCard {...d.review} />
      </div>
    );
  }
  if (d.reviewLink) {
    return (
      <div className="space-y-4">
        <div className="rounded-card border border-dashed border-brand-line bg-white px-6 py-8 text-center">
          <p className="text-[14px] font-semibold text-brand-ink">
            No review yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] text-brand-mute">
            The guest is invited to review automatically 5 minutes after
            checkout. You can also send them the link directly below.
          </p>
        </div>
        <ReviewLinkCard bookingId={d.id} {...d.reviewLink} />
      </div>
    );
  }
  return (
    <Card>
      <div className="px-6 py-12 text-center text-[13px] text-brand-mute">
        Reviews open once the stay is completed. We&rsquo;ll invite the guest to
        review 5 minutes after you check them out.
      </div>
    </Card>
  );
}

function ActivityPanel({ d }: { d: BookingDetailData }) {
  return (
    <Card>
      <CardHead title="Activity timeline" />
      <div className="p-5">
        {d.timeline.length === 0 ? (
          <div className="text-[13px] text-brand-mute">No activity yet.</div>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-brand-line pl-5">
            {d.timeline.map((t, i) => (
              <li key={i}>
                <span
                  className={`absolute -left-[7px] mt-0.5 h-3 w-3 rounded-full border-2 border-white ${TIMELINE_DOT[t.tone]}`}
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-semibold text-brand-ink">
                    {t.title}
                  </div>
                  <div className="shrink-0 text-[11px] text-brand-mute">
                    {t.stamp}
                  </div>
                </div>
                {t.desc ? (
                  <div className="text-[12px] text-brand-mute">{t.desc}</div>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}

// ── Notes ────────────────────────────────────────────────────────────────────
function NotesPanel({ d }: { d: BookingDetailData }) {
  return (
    <Card>
      <CardHead
        title="Internal notes"
        right={
          <span className="rounded-pill bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold text-brand-mute">
            Host-only · not shown to guest
          </span>
        }
      />
      <InternalNotes bookingId={d.id} notes={d.notes} />
    </Card>
  );
}
