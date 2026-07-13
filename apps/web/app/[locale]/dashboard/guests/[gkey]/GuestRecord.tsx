"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  Calendar,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  FileMinus,
  FileText,
  MailCheck,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Phone,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Tag as TagIcon,
  Trash2,
  Users,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { StarRow } from "@/app/[locale]/dashboard/reviews/StarRow";
import { CategoryStars } from "@/components/reviews/CategoryStars";

import { RecordTabs } from "@/app/[locale]/dashboard/_components/RecordTabs";
import { RequestReviewButton } from "@/app/[locale]/dashboard/reviews/RequestReviewButton";
import { ReviewCard } from "@/app/[locale]/dashboard/reviews/ReviewCard";
import { LedgerList } from "@/components/finance/LedgerList";
import { StatementDialog } from "@/components/finance/StatementDialog";
import { EventTimeline } from "@/components/timeline/EventTimeline";
import {
  buildGuestStatementAction,
  sendGuestStatementAction,
} from "./statement-actions";
import type { NextAction } from "@/lib/guests/next-action";
import type { RequestableReview } from "@/lib/reviews/eligible";
import {
  GuestFinanceModals,
  type FinanceAction,
  type FinanceRequest,
} from "./GuestFinanceModals";
import { WhatToDoBanner } from "./WhatToDoBanner";
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
import { modal } from "@/components/ui/modal-host";
import { formatMoney } from "@/lib/format";
import type { Txn } from "@/lib/finance/transactions";

import {
  addGuestNoteAction,
  addGuestTagAction,
  blockGuestAction,
  deleteGuestNoteAction,
  deleteGuestRatingAction,
  exportGuestVcardAction,
  pinGuestNoteAction,
  recordOptOutAction,
  removeGuestTagAction,
  unblockGuestAction,
  upsertGuestRatingAction,
} from "../actions";

import type { GuestRatingInput } from "../_rating/schemas";

export type GuestRecordData = {
  gkey: string;
  guest_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  country: string | null;
  guest_since: string | null;
  currency: string;
  is_verified: boolean;
  is_blocked: boolean;
  is_vip: boolean;
  is_returning: boolean;
  is_new: boolean;
  is_ota: boolean;
  is_inhouse: boolean;
  is_lapsed: boolean;
  is_all_direct: boolean;
  is_added_guest: boolean;
  has_email: boolean;
  has_phone: boolean;
  tags: string[];
  total_stays: number;
  total_nights: number;
  total_bookings: number;
  lifetime_value: number;
  direct_value: number;
  est_fees_saved: number;
  avg_rating: number | null;
  review_count: number;
  first_stay: string | null;
  last_stay: string | null;
  last_status: string | null;
  channel: string | null;
  next_stay: string | null;
  next_listing: string | null;
  next_stay_in_days: number | null;
  avg_ltv_per_stay: number;
  guest_cancellations: number;
  reliability_pct: number | null;
  avg_lead_days: number | null;
  preferred_listing: string | null;
};

export type BookingItem = {
  id: string;
  reference: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
  guestsCount: number;
  totalAmount: number;
  balanceDue: number;
  currency: string;
  channel: string | null;
  createdAt: string;
  specialRequests: string | null;
  listingName: string;
  listingThumb: string | null;
  /** Absolute /pay/[token] link when the booking is payable; null otherwise. */
  payUrl: string | null;
};

export type AddonCatalogItem = {
  id: string;
  name: string;
  unitPrice: number;
  active: boolean;
};

export type PaymentItem = {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  capturedAt: string | null;
  createdAt: string;
  reference: string;
};

export type NoteItem = {
  id: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  authorName: string;
};

// MessageItem / TemplateItem now live with the shared GuestMessagesPanel.
// Re-exported here so existing importers (this record's page.tsx) keep working.
export type { MessageItem, TemplateItem };

// Mirrors the host Reviews dashboard card (minus guestName, which is the
// record's guest) so the canonical ReviewCard manage/respond/flag UI is reused
// verbatim here.
export type ReviewItem = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  hostResponse: string | null;
  hostRespondedAt: string | null;
  flagged: boolean;
  listingName: string;
  nights: number | null;
  stayMonth: string | null;
  photos: string[];
  isFeatured: boolean;
};

export type QuoteItem = {
  id: string;
  status: string;
  total: number;
  currency: string;
  checkIn: string | null;
  checkOut: string | null;
  listingName: string;
  date: string;
};

// ── Reputation (host → guest rating, cross-host) ──────────────────────────
export type RatingDimensionKey =
  | "payments"
  | "communication"
  | "cleanliness"
  | "house_rules"
  | "integrity";

export type GuestRatingRow = {
  id: string;
  rating: number;
  summary: string | null;
  scores: Record<RatingDimensionKey, number | null>;
  notes: Record<RatingDimensionKey, string | null>;
  updatedAt: string;
  /** True for the signed-in host's own review (editable); false for peers'. */
  isMine: boolean;
};

export type ReputationData = {
  /** Guest has a Wielo account id (only then is rating possible). */
  hasAccount: boolean;
  /** This host has a completed/no-show stay with the guest. */
  canRate: boolean;
  myRating: GuestRatingRow | null;
  otherRatings: GuestRatingRow[];
  aggregate: {
    overall: number | null;
    hostCount: number;
    dimensions: Partial<Record<RatingDimensionKey, number | null>>;
  };
};

// Another guest this person travelled with, from a booking's party manifest.
export type RelationshipItem = {
  id: string;
  name: string;
  email: string | null;
  gkey: string | null;
  bookingId: string | null;
  bookingRef: string | null;
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "bookings", label: "Bookings" },
  { key: "finances", label: "Finances" },
  { key: "messages", label: "Messages" },
  { key: "reviews", label: "Reviews" },
  { key: "reputation", label: "Reputation" },
  { key: "relationships", label: "Relationships" },
  { key: "notes", label: "Notes" },
] as const;

function initials(name: string | null): string {
  if (!name) return "·";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "·";
}
function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(
    `${d.length <= 10 ? `${d}T12:00:00Z` : d}`,
  ).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function fmtShort(d: string | null): string {
  if (!d) return "—";
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

// Friendly booking-channel label — never surface a raw internal value (e.g. the
// legacy "vilo" direct-channel key) in the guest activity feed.
const CHANNEL_LABEL: Record<string, string> = {
  direct: "Direct",
  vilo: "Wielo",
  wielo: "Wielo",
  website: "Website",
  ota: "OTA",
  airbnb: "Airbnb",
  booking: "Booking.com",
  "booking.com": "Booking.com",
  expedia: "Expedia",
  lekkerslaap: "LekkerSlaap",
};
function channelLabel(c: string | null): string {
  if (!c) return "Direct";
  return CHANNEL_LABEL[c.toLowerCase()] ?? c;
}

function statusTag(status: string): { label: string; cls: string } {
  switch (status) {
    case "confirmed":
      return {
        label: "Confirmed",
        cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "checked_in":
      return {
        label: "In-house",
        cls: "bg-sky-50 text-sky-600 border-sky-200",
      };
    case "completed":
      return {
        label: "Completed",
        cls: "bg-indigo-50 text-indigo-600 border-indigo-200",
      };
    case "pending":
    case "pending_eft":
    case "pending_eft_review":
      return {
        label: "Pending",
        cls: "bg-amber-50 text-amber-700 border-amber-200",
      };
    default:
      return {
        label: status.replace(/_/g, " "),
        cls: "bg-red-50 text-red-600 border-red-200",
      };
  }
}

export function GuestRecord({
  record,
  bookings,
  reviews,
  requestableReviews,
  reputation,
  txns,
  businesses,
  selectedBusiness,
  quotes,
  addonCatalog,
  marketingState,
  notes,
  pinnedNote,
  messages,
  conversationId,
  templates,
  relationships,
  prevGkey,
  nextGkey,
  balance,
  nextAction,
}: {
  record: GuestRecordData;
  bookings: BookingItem[];
  reviews: ReviewItem[];
  requestableReviews: RequestableReview[];
  reputation: ReputationData;
  txns: Txn[];
  businesses: { id: string; name: string }[];
  selectedBusiness: string | null;
  quotes: QuoteItem[];
  addonCatalog: AddonCatalogItem[];
  marketingState: "subscribed" | "unsubscribed" | "needs_consent" | "no_email";
  notes: NoteItem[];
  pinnedNote: NoteItem | null;
  messages: MessageItem[];
  conversationId: string | null;
  templates: TemplateItem[];
  relationships: RelationshipItem[];
  prevGkey: string | null;
  nextGkey: string | null;
  balance: { net: number; outstanding: number; storeCredit: number };
  nextAction: NextAction;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "overview";
  const [tabLoading, setTabLoading] = useState<string | null>(null);
  const [isTabPending, startTabTransition] = useTransition();

  const setTab = (t: string) => {
    if (t === tab) return; // Already on this tab
    setTabLoading(t);
    startTabTransition(() => {
      const next = new URLSearchParams(params.toString());
      if (t === "overview") next.delete("tab");
      else next.set("tab", t);
      router.push(`${pathname}?${next.toString()}`);
    });
  };

  // Clear loading state when tab changes
  if (tabLoading === tab) {
    setTabLoading(null);
  }

  // Business is a server-side scope (it changes the Finances rows + their
  // running balance), so it navigates with ?business=… and the page re-fetches.
  // Stay on the Finances tab.
  const setBusiness = (id: string) => {
    const next = new URLSearchParams(params.toString());
    if (id === "all") next.delete("business");
    else next.set("business", id);
    next.set("tab", "finances");
    router.push(`${pathname}?${next.toString()}`);
  };

  // Open-state for the finance action modals (record payment / refund / credit
  // note / add-on). Set from the Finances tab buttons and the What-to-do banner.
  const [financeReq, setFinanceReq] = useState<FinanceRequest | null>(null);
  const openFinance = (
    action: FinanceAction,
    bookingId: string | null = null,
  ) => setFinanceReq({ action, bookingId });

  const r = record;
  const segLabel = r.is_vip
    ? r.is_returning
      ? "VIP · Returning"
      : "VIP"
    : r.is_returning
      ? "Returning"
      : r.is_added_guest
        ? "Added guest"
        : r.is_ota
          ? "Via OTA"
          : "New";

  const nextBooking = r.next_stay
    ? bookings.find(
        (b) =>
          b.checkIn === r.next_stay &&
          (b.status === "confirmed" || b.status === "checked_in"),
      )
    : undefined;
  const latestRequest =
    bookings.find((b) => b.specialRequests)?.specialRequests ?? null;

  return (
    <div className="w-full">
      {/* ── Sub-header ── */}
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/dashboard/guests"
          className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-brand-line px-3 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
        >
          <ArrowLeft className="h-4 w-4 text-brand-mute" /> All guests
        </Link>
        <div className="hidden items-center gap-2 text-[12.5px] md:flex">
          <span className="text-brand-mute">Guests</span>
          <ChevronRight className="h-3 w-3 text-brand-line" />
          <span className="font-semibold text-brand-ink">
            {r.name ?? "Guest"}
          </span>
        </div>
        <div className="ml-auto flex items-center overflow-hidden rounded-pill border border-brand-line bg-white">
          <button
            disabled={!prevGkey}
            onClick={() =>
              prevGkey && router.push(`/dashboard/guests/${prevGkey}`)
            }
            title="Previous guest"
            className="flex h-9 w-9 items-center justify-center text-brand-mute hover:bg-brand-light disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="h-5 w-px bg-brand-line" />
          <button
            disabled={!nextGkey}
            onClick={() =>
              nextGkey && router.push(`/dashboard/guests/${nextGkey}`)
            }
            title="Next guest"
            className="flex h-9 w-9 items-center justify-center text-brand-mute hover:bg-brand-light disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Two-column CRM layout: sticky dossier + working column ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-6">
          <Dossier
            r={r}
            segLabel={segLabel}
            balance={balance}
            marketingState={marketingState}
            latestRequest={latestRequest}
            onMessage={() => setTab("messages")}
          />
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          {/* ── What to do (the single next-best action) ── */}
          <WhatToDoBanner
            action={nextAction}
            onTab={setTab}
            onPayment={(bookingId) => openFinance("payment", bookingId)}
          />

          {/* ── Tabs ── */}
          <RecordTabs
            active={tab}
            onSelect={setTab}
            loadingKey={isTabPending ? tabLoading : null}
            tabs={TABS.map((t) => ({
              key: t.key,
              label: t.label,
              count:
                t.key === "bookings"
                  ? bookings.length || undefined
                  : t.key === "finances"
                    ? txns.length
                    : t.key === "messages"
                      ? messages.length
                      : t.key === "reviews"
                        ? reviews.length
                        : t.key === "reputation"
                          ? reputation.aggregate.hostCount || undefined
                          : t.key === "relationships"
                            ? relationships.length || undefined
                            : t.key === "notes"
                              ? notes.length
                              : undefined,
            }))}
          />

          <div>
            {tab === "overview" ? (
              <Overview
                bookings={bookings}
                nextBooking={nextBooking}
                pinnedNote={pinnedNote}
              />
            ) : tab === "bookings" ? (
              <BookingsPanel bookings={bookings} currency={r.currency} />
            ) : tab === "messages" ? (
              <GuestMessagesPanel
                firstName={(r.name ?? "guest").split(/\s+/)[0]}
                messages={messages}
                conversationId={conversationId}
                templates={templates}
                isRegistered={r.is_verified}
                guestId={r.guest_id}
              />
            ) : tab === "notes" ? (
              <NotesPanel gkey={r.gkey} notes={notes} />
            ) : tab === "relationships" ? (
              <RelationshipsPanel
                relationships={relationships}
                guestName={r.name ?? "This guest"}
              />
            ) : tab === "reviews" ? (
              <ReviewsPanel
                reviews={reviews}
                guestName={r.name ?? "Guest"}
                requestable={requestableReviews}
              />
            ) : tab === "reputation" ? (
              <ReputationPanel
                guestId={r.guest_id}
                guestName={r.name ?? "Guest"}
                reputation={reputation}
              />
            ) : (
              <FinancesPanel
                gkey={r.gkey}
                txns={txns}
                quotes={quotes}
                hasBookings={bookings.length > 0}
                onAction={openFinance}
                businesses={businesses}
                selectedBusiness={selectedBusiness}
                onBusiness={setBusiness}
              />
            )}
          </div>
        </div>
      </div>
      <div className="h-6" />

      <GuestFinanceModals
        request={financeReq}
        bookings={bookings}
        addonCatalog={addonCatalog}
        onClose={() => setFinanceReq(null)}
      />
    </div>
  );
}

// A guest tag chip with an inline remove control. `addGuestTagAction` had no
// counterpart in the UI (tags could be added from the ⋯ menu but never removed),
// so `removeGuestTagAction` was unreachable — this wires it up.
function RemovableTag({ gkey, tag }: { gkey: string; tag: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const res = await removeGuestTagAction(gkey, tag);
    setBusy(false);
    if (!res.ok) {
      void modal.error({
        title: "Couldn't remove tag",
        description: res.error,
      });
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand-mute">
      {tag}
      <button
        type="button"
        onClick={() => void remove()}
        disabled={busy}
        title={`Remove “${tag}”`}
        aria-label={`Remove tag ${tag}`}
        className="-mr-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full leading-none text-brand-mute transition hover:bg-brand-line hover:text-brand-ink disabled:opacity-50"
      >
        ×
      </button>
    </span>
  );
}

// ── Dossier (v3: the sticky left CRM card) ──────────────────────────────
// Identity, quick actions, balance, contact, verification, lifetime stats and
// preferences — everything "about the guest" lives here so the working column
// on the right is free for the action banner, tabs and panels.
function Dossier({
  r,
  segLabel,
  balance,
  marketingState,
  latestRequest,
  onMessage,
}: {
  r: GuestRecordData;
  segLabel: string;
  balance: { net: number; outstanding: number; storeCredit: number };
  marketingState: "subscribed" | "unsubscribed" | "needs_consent" | "no_email";
  latestRequest: string | null;
  onMessage: () => void;
}) {
  const sep = <div className="h-px bg-brand-line" />;
  const eyebrow =
    "text-[10.5px] font-bold uppercase tracking-[0.1em] text-brand-mute";
  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="relative flex flex-col gap-5 p-6">
        <div className="absolute right-4 top-4">
          <RecordActions r={r} />
        </div>

        {/* identity */}
        <div className="flex items-start gap-3.5 pr-9">
          <div className="relative shrink-0">
            {r.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.avatar_url}
                alt=""
                className="h-16 w-16 rounded-pill object-cover ring-2 ring-brand-accent"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-pill bg-brand-secondary font-display text-xl font-bold text-white ring-2 ring-brand-accent">
                {initials(r.name)}
              </div>
            )}
            {r.is_verified ? (
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-brand-primary text-white">
                <BadgeCheck className="h-3 w-3" />
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[20px] font-extrabold leading-tight text-brand-ink">
              {r.name ?? "Guest"}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-[11.5px] font-semibold ${
                  r.is_added_guest
                    ? "border-violet-200 bg-violet-50 text-violet-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {r.is_added_guest ? <Users className="h-3.5 w-3.5" /> : null}
                {segLabel}
              </span>
              {r.is_blocked ? (
                <span className="rounded-pill bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-600">
                  Blocked
                </span>
              ) : null}
              {r.tags
                .filter((t) => t !== "VIP")
                .map((t) => (
                  <RemovableTag key={t} gkey={r.gkey} tag={t} />
                ))}
            </div>
          </div>
        </div>

        {/* quick actions */}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button
            type="button"
            onClick={onMessage}
            className="inline-flex items-center justify-center gap-1.5 rounded-pill bg-brand-primary px-3.5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-secondary"
          >
            <MessageSquare className="h-4 w-4" /> Message
          </button>
          {r.phone ? (
            <a
              href={`tel:${r.phone}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-pill border border-brand-line bg-white px-4 py-2.5 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
            >
              <Phone className="h-4 w-4 text-brand-primary" /> Call
            </a>
          ) : null}
        </div>

        {/* balance */}
        <div className="rounded-[10px] bg-brand-light px-3 py-2.5">
          <BalanceLine balance={balance} currency={r.currency} />
        </div>

        {sep}

        {/* contact */}
        <div>
          <div className={`${eyebrow} mb-2.5`}>Contact</div>
          <div className="flex flex-col gap-2.5 text-[12.5px]">
            {r.email ? (
              <a
                href={`mailto:${r.email}`}
                className="flex items-center gap-2.5 text-brand-ink hover:text-brand-primary"
              >
                <MailCheck className="h-4 w-4 shrink-0 text-brand-mute" />
                <span className="truncate">{r.email}</span>
              </a>
            ) : null}
            {r.phone ? (
              <a
                href={`tel:${r.phone}`}
                className="flex items-center gap-2.5 text-brand-ink hover:text-brand-primary"
              >
                <Phone className="h-4 w-4 shrink-0 text-brand-mute" />
                <span className="truncate">{r.phone}</span>
              </a>
            ) : null}
            {r.country ? (
              <div className="flex items-center gap-2.5 text-brand-mute">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{r.country}</span>
              </div>
            ) : null}
            {r.guest_since ? (
              <div className="flex items-center gap-2.5 text-brand-mute">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>Guest since {new Date(r.guest_since).getFullYear()}</span>
              </div>
            ) : null}
          </div>
        </div>

        {sep}

        {/* verified + marketing consent */}
        <div>
          <div className={`${eyebrow} mb-2.5`}>Verified</div>
          <div className="flex flex-wrap gap-1.5">
            {r.is_verified ? (
              <span className="inline-flex items-center gap-1 rounded-pill bg-status-confirmed/10 px-2.5 py-1 text-[11px] font-semibold text-status-confirmed">
                <MailCheck className="h-3 w-3" /> Email
              </span>
            ) : null}
            {r.is_verified && r.is_all_direct && r.total_stays > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-pill bg-brand-light px-2.5 py-1 text-[11px] font-semibold text-brand-primary">
                All direct
              </span>
            ) : null}
          </div>
          <div className="mt-2">
            <MarketingConsent gkey={r.gkey} state={marketingState} />
          </div>
        </div>

        {sep}

        {/* lifetime stats */}
        <div>
          <div className={`${eyebrow} mb-3`}>Lifetime with you</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <DStat
              label="Stays"
              value={String(r.total_stays)}
              sub={`${r.total_nights} nights`}
            />
            <DStat
              label="Lifetime"
              value={formatMoney(r.lifetime_value, r.currency)}
              sub={`avg ${formatMoney(r.avg_ltv_per_stay, r.currency)}`}
              subTone="good"
            />
            <DStat
              label="Rating left"
              value={r.avg_rating ? `${r.avg_rating} ★` : "—"}
              sub={`${r.review_count} review${r.review_count === 1 ? "" : "s"}`}
            />
            <DStat
              label="Reliability"
              value={r.reliability_pct !== null ? `${r.reliability_pct}%` : "—"}
              sub={`${r.guest_cancellations} cancellation${r.guest_cancellations === 1 ? "" : "s"}`}
              subTone="good"
            />
          </div>
        </div>

        {/* preferences */}
        {r.preferred_listing || r.avg_lead_days !== null || latestRequest ? (
          <>
            {sep}
            <div>
              <div className={`${eyebrow} mb-1`}>Preferences</div>
              {r.preferred_listing ? (
                <DFact k="Usual listing" v={r.preferred_listing} />
              ) : null}
              {r.avg_lead_days !== null ? (
                <DFact k="Books ahead" v={`~${r.avg_lead_days} days`} />
              ) : null}
              <DFact
                k="Channel"
                v={
                  r.is_all_direct && r.total_stays > 0
                    ? "All direct"
                    : r.is_ota
                      ? "Via OTA"
                      : "Direct"
                }
              />
              {latestRequest ? <DFact k="Needs" v={latestRequest} /> : null}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function DStat({
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
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        {label}
      </div>
      <div className="num mt-1 font-display text-[19px] font-bold leading-none text-brand-ink">
        {value}
      </div>
      <div
        className={`mt-1 text-[10.5px] ${subTone === "good" ? "font-medium text-status-confirmed" : "text-brand-mute"}`}
      >
        {sub}
      </div>
    </div>
  );
}

function DFact({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-brand-line py-2.5 last:border-0">
      <span className="text-[12.5px] text-brand-mute">{k}</span>
      <span className="text-right text-[12.5px] font-semibold text-brand-ink">
        {v}
      </span>
    </div>
  );
}

// ── Overview ────────────────────────────────────────────────────────────
// Identity + preferences live in the dossier now, so the overview is the
// "what's happening" column: the next stay, recent activity and the pinned note.
function Overview({
  bookings,
  nextBooking,
  pinnedNote,
}: {
  bookings: BookingItem[];
  nextBooking: BookingItem | undefined;
  pinnedNote: NoteItem | null;
}) {
  const realized = new Set(["confirmed", "checked_in", "completed"]);
  const activity = [...bookings]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      {nextBooking ? (
        <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
            <div className="font-display text-[15px] font-bold text-brand-ink">
              Next stay
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11.5px] font-semibold text-emerald-700">
              {statusTag(nextBooking.status).label}
            </span>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-4">
              {nextBooking.listingThumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={nextBooking.listingThumb}
                  alt=""
                  className="h-16 w-20 shrink-0 rounded-[12px] object-cover"
                />
              ) : (
                <div className="h-16 w-20 shrink-0 rounded-[12px] bg-brand-light" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-display text-[15px] font-bold text-brand-ink">
                  {nextBooking.listingName}
                </div>
                <div className="mt-0.5 text-[12.5px] text-brand-mute">
                  {fmtShort(nextBooking.checkIn)} →{" "}
                  {fmtShort(nextBooking.checkOut)} · {nextBooking.nights} nights
                  · {nextBooking.guestsCount} guests
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-brand-mute">
                  {nextBooking.reference}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-[16px] font-bold text-brand-ink">
                  {formatMoney(nextBooking.totalAmount, nextBooking.currency)}
                </div>
              </div>
            </div>
            <Link
              href={`/dashboard/bookings/${nextBooking.id}`}
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-pill border border-brand-line px-3 py-2.5 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
            >
              Open booking <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <div className="border-b border-brand-line px-5 py-3.5">
            <div className="font-display text-[15px] font-bold text-brand-ink">
              Recent activity
            </div>
          </div>
          <div className="p-5">
            <EventTimeline
              events={activity.map((b) => ({
                at: b.createdAt,
                title: `Booked ${b.listingName}`,
                kind: "Booking",
                tone: realized.has(b.status) ? "green" : "slate",
                amount: b.totalAmount,
                currency: b.currency,
                meta: `${channelLabel(b.channel)} · ${statusTag(b.status).label}`,
              }))}
              emptyLabel="No activity yet."
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
            <div className="font-display text-[15px] font-bold text-brand-ink">
              Pinned note
            </div>
            <span className="inline-flex items-center gap-1 rounded-pill bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand-mute">
              <Pin className="h-3 w-3" /> Host-only
            </span>
          </div>
          <div className="p-4">
            {pinnedNote ? (
              <div className="flex gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-brand-secondary text-[10px] font-bold text-white">
                  {initials(pinnedNote.authorName)}
                </div>
                <div className="rounded-[12px] rounded-tl-sm bg-brand-light px-3 py-2 text-[12.5px] leading-relaxed text-brand-ink">
                  {pinnedNote.body}
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-[12.5px] text-brand-mute">
                No pinned note yet. Pin one from the{" "}
                <span className="font-semibold text-brand-ink">Notes</span> tab
                to keep it front and centre.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Balance line (v2: compact, sits under the hero action buttons) ──────
// The net guest balance, condensed to one line per the mock. Full breakdown
// (outstanding vs store credit) lives in the Finances tab — this is just the
// at-a-glance headline, derived from the same ledger-backed `balance`.
function BalanceLine({
  balance,
  currency,
}: {
  balance: { net: number; outstanding: number; storeCredit: number };
  currency: string;
}) {
  const owes = balance.net < -0.001; // guest owes the host
  const credit = balance.net > 0.001; // host holds credit for the guest
  const col = owes ? "#B45309" : credit ? "#047857" : "#4A7C6A";
  const Icon = owes ? Clock : CheckCircle2;
  const amount = formatMoney(
    Math.abs(owes ? balance.net : credit ? balance.net : 0),
    currency,
  );
  const label = owes
    ? "Owed to you"
    : credit
      ? "Store credit you hold"
      : "Paid in full";
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px]">
      <Icon className="h-3.5 w-3.5" style={{ color: col }} />
      <span className="text-brand-mute">
        {owes ? "Balance due" : credit ? "Credit" : ""}
      </span>
      {owes || credit ? (
        <span
          className="num font-display text-[12.5px] font-bold"
          style={{ color: col }}
        >
          {amount}
        </span>
      ) : null}
      <span className="text-brand-mute">
        {owes || credit ? "· " : ""}
        {label}
      </span>
    </div>
  );
}

// ── Marketing consent (locked status + opt-out only, POPIA) ─────────────
function MarketingConsent({
  gkey,
  state,
}: {
  gkey: string;
  state: "subscribed" | "unsubscribed" | "needs_consent" | "no_email";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const meta = {
    subscribed: {
      checked: true,
      label: "Subscribed to marketing",
      tone: "text-status-confirmed",
    },
    unsubscribed: {
      checked: false,
      label: "Unsubscribed",
      tone: "text-brand-mute",
    },
    needs_consent: {
      checked: false,
      label: "Not subscribed — no consent",
      tone: "text-brand-mute",
    },
    no_email: {
      checked: false,
      label: "No email on file",
      tone: "text-brand-mute",
    },
  }[state];

  async function optOut() {
    const ok = await modal.confirm({
      title: "Record an opt-out?",
      description:
        "Mark this guest as unsubscribed from your marketing. You can't re-subscribe them yourself afterwards — only the guest can opt back in.",
      confirmLabel: "Record opt-out",
    });
    if (!ok) return;
    setBusy(true);
    const res = await recordOptOutAction(gkey);
    setBusy(false);
    if (!res.ok) {
      void modal.error({ title: "Couldn't update", description: res.error });
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-pill border border-brand-line bg-white px-2.5 py-1">
      <input
        type="checkbox"
        checked={meta.checked}
        disabled
        aria-label="Marketing subscription (read-only)"
        className="h-3.5 w-3.5 rounded border-brand-line text-brand-primary disabled:opacity-100"
      />
      <span className={`text-[11px] font-semibold ${meta.tone}`}>
        {meta.label}
      </span>
      <span
        className="text-brand-line"
        title="Guests control this themselves via the unsubscribe link — hosts can only honour an opt-out."
      >
        ·
      </span>
      {state === "subscribed" ? (
        <button
          onClick={() => void optOut()}
          disabled={busy}
          className="text-[11px] font-medium text-brand-mute underline-offset-2 hover:text-status-cancelled hover:underline disabled:opacity-50"
        >
          Record opt-out
        </button>
      ) : (
        <span className="text-[11px] text-brand-mute">guest-controlled</span>
      )}
    </span>
  );
}

// ── Reviews panel ───────────────────────────────────────────────────────
// Reuses the canonical host ReviewCard (reply / edit / clear / flag) so review
// management is identical to the Reviews dashboard — single source of truth.
function ReviewsPanel({
  reviews,
  guestName,
  requestable,
}: {
  reviews: ReviewItem[];
  guestName: string;
  requestable: RequestableReview[];
}) {
  const requestBtn =
    requestable.length > 0 ? (
      <RequestReviewButton
        bookings={requestable}
        label="Request a review"
        variant="ghost"
      />
    ) : null;

  if (reviews.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white px-6 py-12 text-center">
        <p className="text-[13px] text-brand-mute">
          This guest hasn&rsquo;t left any reviews yet.
        </p>
        {requestBtn ? (
          <div className="mt-4 flex justify-center">{requestBtn}</div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {requestBtn ? <div className="flex justify-end">{requestBtn}</div> : null}
      {reviews.map((rev) => (
        <ReviewCard key={rev.id} guestName={guestName} {...rev} />
      ))}
    </div>
  );
}

// ── Finances panel (invoices · quotes · refunds · credit notes) ──────────
function financeStatusCls(status: string): string {
  const s = status.toLowerCase();
  if (["paid", "issued", "accepted", "completed", "approved"].includes(s))
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["pending", "sent", "draft", "negotiating"].includes(s))
    return "border-amber-200 bg-amber-50 text-amber-700";
  if (["declined", "cancelled", "void", "expired", "lost"].includes(s))
    return "border-red-200 bg-red-50 text-red-600";
  return "border-brand-line bg-brand-light text-brand-mute";
}

function FinanceSection({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof FileText;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-brand-line px-5 py-3.5">
        <Icon className="h-4 w-4 text-brand-mute" />
        <span className="font-display text-[15px] font-bold text-brand-ink">
          {title}
        </span>
        <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <div className="px-5 py-6 text-center text-[12.5px] text-brand-mute">
          None for this guest.
        </div>
      ) : (
        <div>{children}</div>
      )}
    </section>
  );
}

function FinanceRow({
  href,
  primary,
  secondary,
  amount,
  status,
}: {
  href: string;
  primary: string;
  secondary: string;
  amount: string;
  status: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-t border-brand-line px-5 py-3 first:border-t-0 hover:bg-brand-light/50"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-brand-ink">
          {primary}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-brand-mute">
          {secondary}
        </div>
      </div>
      <div className="font-display text-[13px] font-bold tabular-nums text-brand-ink">
        {amount}
      </div>
      <span
        className={`shrink-0 rounded-pill border px-2 py-0.5 text-[11px] font-semibold capitalize ${financeStatusCls(status)}`}
      >
        {status.replace(/_/g, " ")}
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-brand-mute" />
    </Link>
  );
}

// The single money home for a guest: every transaction (charges, payments,
// credit, refunds) for this guest, rendered with the SAME ledger component as
// the account-wide Ledger and the booking Payments tab — so the rows, signs and
// running balances are identical everywhere. Pending quotes (pre-booking, not
// yet a transaction) sit below. Per-booking controls live on the booking record.
function FinancesPanel({
  gkey,
  txns,
  quotes,
  hasBookings,
  onAction,
  businesses,
  selectedBusiness,
  onBusiness,
}: {
  gkey: string;
  txns: Txn[];
  quotes: QuoteItem[];
  hasBookings: boolean;
  onAction: (action: FinanceAction) => void;
  businesses: { id: string; name: string }[];
  selectedBusiness: string | null;
  onBusiness: (id: string) => void;
}) {
  const [statementOpen, setStatementOpen] = useState(false);
  const actions: {
    key: FinanceAction;
    label: string;
    icon: typeof FileText;
  }[] = [
    { key: "payment", label: "Record payment", icon: CreditCard },
    { key: "refund", label: "Issue refund", icon: RotateCcw },
    { key: "credit", label: "Credit note", icon: FileMinus },
    { key: "addon", label: "Add add-on", icon: Sparkles },
  ];
  const selectedName = businesses.find((b) => b.id === selectedBusiness)?.name;
  return (
    <div className="space-y-6">
      {hasBookings || txns.length > 0 || businesses.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2.5">
          {hasBookings
            ? actions.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => onAction(a.key)}
                  className={`inline-flex items-center gap-1.5 rounded-pill px-4 py-2 text-[13px] font-semibold transition ${
                    a.key === "payment"
                      ? "bg-brand-primary text-white hover:bg-brand-secondary"
                      : "border border-brand-line bg-white text-brand-ink hover:bg-brand-light"
                  }`}
                >
                  <a.icon
                    className={`h-4 w-4 ${a.key === "payment" ? "" : "text-brand-mute"}`}
                  />
                  {a.label}
                </button>
              ))
            : null}
          {txns.length > 0 ? (
            <button
              type="button"
              onClick={() => setStatementOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-4 py-2 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
            >
              <FileText className="h-4 w-4 text-brand-mute" />
              Statement
            </button>
          ) : null}
          {businesses.length > 1 ? (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[12px] font-semibold text-brand-mute">
                Business
              </span>
              <select
                value={selectedBusiness ?? "all"}
                onChange={(e) => onBusiness(e.target.value)}
                className="rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] font-semibold text-brand-ink focus:border-brand-primary focus:outline-none"
                title="Filter this guest's transactions by business"
              >
                <option value="all">All businesses</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}
      {selectedBusiness ? (
        <p className="-mt-3 text-[11.5px] text-brand-mute">
          Showing {selectedName ?? "this business"}&rsquo;s transactions with
          this guest. The headline balance still reflects all businesses.
        </p>
      ) : null}
      <LedgerList
        entries={txns}
        showGuest={false}
        emptyLabel="No transactions for this guest yet."
        minWidth={720}
        canManage
      />
      {txns.length > 0 ? (
        <p className="text-[11.5px] text-brand-mute">
          {txns.length} transaction{txns.length === 1 ? "" : "s"} · Balance
          shows what this guest owes you (or their credit) after each entry.
        </p>
      ) : null}
      {quotes.length > 0 ? (
        <FinanceSection icon={FileText} title="Quotes" count={quotes.length}>
          {quotes.map((q) => (
            <FinanceRow
              key={q.id}
              href={`/dashboard/quotes/${q.id}`}
              primary={q.listingName}
              secondary={`${fmtShort(q.checkIn)} → ${fmtShort(q.checkOut)} · ${fmtDate(q.date.slice(0, 10))}`}
              amount={formatMoney(q.total, q.currency)}
              status={q.status}
            />
          ))}
        </FinanceSection>
      ) : null}

      <StatementDialog
        open={statementOpen}
        onOpenChange={setStatementOpen}
        recipient="guest"
        build={(r) => buildGuestStatementAction({ gkey, ...r })}
        send={(r) =>
          sendGuestStatementAction({
            gkey,
            ...r,
            origin: window.location.origin,
          })
        }
      />
    </div>
  );
}

// ── Bookings panel ──────────────────────────────────────────────────────
// Every booking for this guest — current and historical — newest first. The
// merge rule (page.tsx) already includes same-email manual bookings, so this is
// the guest's full reservation history with this host.
type BookingSort = "newest" | "oldest";

function BookingsPanel({
  bookings,
  currency,
}: {
  bookings: BookingItem[];
  currency: string;
}) {
  const [sort, setSort] = useState<BookingSort>("newest");

  if (bookings.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white px-6 py-12 text-center">
        <Calendar className="mx-auto h-6 w-6 text-brand-line" />
        <p className="mt-3 text-[13px] text-brand-mute">
          No bookings yet for this guest.
        </p>
      </div>
    );
  }
  // Sort by stay date (check-in), falling back to when the booking was made.
  const sorted = [...bookings].sort((a, b) => {
    const ka = a.checkIn ?? a.createdAt;
    const kb = b.checkIn ?? b.createdAt;
    if (ka === kb) return 0;
    const newestFirst = ka < kb ? 1 : -1;
    return sort === "newest" ? newestFirst : -newestFirst;
  });
  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-brand-line px-5 py-3.5">
        <Calendar className="h-4 w-4 text-brand-mute" />
        <span className="font-display text-[15px] font-bold text-brand-ink">
          All bookings
        </span>
        <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
          {bookings.length}
        </span>
        <label className="ml-auto flex items-center gap-1.5 text-[11.5px] text-brand-mute">
          <span className="hidden sm:inline">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as BookingSort)}
            aria-label="Sort bookings by date"
            className="h-7 rounded-pill border border-brand-line bg-white px-2.5 text-[11.5px] font-semibold text-brand-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>
      <div>
        {sorted.map((b) => {
          const tag = statusTag(b.status);
          return (
            <Link
              key={b.id}
              href={`/dashboard/bookings/${b.id}`}
              className="flex items-center gap-3 border-t border-brand-line px-5 py-3 first:border-t-0 hover:bg-brand-light/50"
            >
              {b.listingThumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.listingThumb}
                  alt=""
                  className="h-11 w-14 shrink-0 rounded-[10px] object-cover"
                />
              ) : (
                <div className="h-11 w-14 shrink-0 rounded-[10px] bg-brand-light" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-brand-ink">
                  {b.listingName}
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-brand-mute">
                  {fmtShort(b.checkIn)} → {fmtShort(b.checkOut)} ·{" "}
                  {b.nights ?? 0} night{b.nights === 1 ? "" : "s"} ·{" "}
                  {b.guestsCount} guest
                  {b.guestsCount === 1 ? "" : "s"}
                </div>
                <div className="mt-0.5 font-mono text-[10.5px] text-brand-mute">
                  {b.reference}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-[13px] font-bold tabular-nums text-brand-ink">
                  {formatMoney(b.totalAmount, b.currency || currency)}
                </div>
                {b.balanceDue > 0.005 ? (
                  <div className="mt-0.5 text-[10.5px] font-semibold text-red-600">
                    {formatMoney(b.balanceDue, b.currency || currency)} due
                  </div>
                ) : null}
              </div>
              <span
                className={`shrink-0 rounded-pill border px-2 py-0.5 text-[11px] font-semibold ${tag.cls}`}
              >
                {tag.label}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-brand-mute" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ── Relationships panel ─────────────────────────────────────────────────
// Other guests this person travelled with, materialised from booking party
// manifests (lead booker ↔ each named guest). Each links to that guest's own
// record and back to the booking they share.
function RelationshipsPanel({
  relationships,
  guestName,
}: {
  relationships: RelationshipItem[];
  guestName: string;
}) {
  if (relationships.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white px-6 py-12 text-center">
        <Users className="mx-auto h-6 w-6 text-brand-line" />
        <p className="mt-3 text-[13px] text-brand-mute">
          No connections yet. When {guestName} books with other named guests —
          or is added to someone&rsquo;s booking — those people show up here.
        </p>
      </div>
    );
  }
  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-brand-line px-5 py-3.5">
        <Users className="h-4 w-4 text-brand-mute" />
        <span className="font-display text-[15px] font-bold text-brand-ink">
          Travelled with
        </span>
        <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
          {relationships.length}
        </span>
      </div>
      <div>
        {relationships.map((rel) => {
          const body = (
            <>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-secondary font-display text-[12px] font-bold text-white">
                {initials(rel.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-brand-ink">
                  {rel.name}
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-brand-mute">
                  {rel.email ?? "No email"}
                  {rel.bookingRef ? ` · Booking ${rel.bookingRef}` : ""}
                </div>
              </div>
              {rel.gkey ? (
                <ArrowRight className="h-4 w-4 shrink-0 text-brand-mute" />
              ) : null}
            </>
          );
          return rel.gkey ? (
            <Link
              key={rel.id}
              href={`/dashboard/guests/${rel.gkey}`}
              className="flex items-center gap-3 border-t border-brand-line px-5 py-3 first:border-t-0 hover:bg-brand-light/50"
            >
              {body}
            </Link>
          ) : (
            <div
              key={rel.id}
              className="flex items-center gap-3 border-t border-brand-line px-5 py-3 first:border-t-0"
            >
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Record actions (More menu) ──────────────────────────────────────────
function RecordActions({ r }: { r: GuestRecordData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [tag, setTag] = useState("");

  const newBookingHref = `/dashboard/bookings/new?${new URLSearchParams({
    ...(r.name ? { guestName: r.name } : {}),
    ...(r.email ? { guestEmail: r.email } : {}),
    ...(r.phone ? { guestPhone: r.phone } : {}),
  }).toString()}`;

  async function exportVcard() {
    setOpen(false);
    const res = await exportGuestVcardAction(r.gkey);
    if (!res.ok) {
      void modal.error({ title: "Export failed", description: res.error });
      return;
    }
    const blob = new Blob([res.data!.vcard], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.data!.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function addTag() {
    if (!tag.trim()) return;
    setTagOpen(false);
    const res = await addGuestTagAction(r.gkey, tag.trim());
    setTag("");
    if (!res.ok) {
      void modal.error({ title: "Couldn't tag", description: res.error });
      return;
    }
    router.refresh();
  }

  async function toggleBlock() {
    setOpen(false);
    if (r.is_blocked) {
      const res = await unblockGuestAction(r.gkey);
      if (!res.ok)
        void modal.error({ title: "Couldn't unblock", description: res.error });
      else router.refresh();
      return;
    }
    const ok = await modal.destructive({
      title: `Block ${r.name ?? "this guest"}?`,
      description:
        "They'll be flagged as blocked across your dashboard. This is a display-only flag for now — it won't auto-reject their bookings.",
      confirmLabel: "Block guest",
    });
    if (!ok) return;
    const res = await blockGuestAction(r.gkey);
    if (!res.ok)
      void modal.error({ title: "Couldn't block", description: res.error });
    else router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex h-[42px] w-[42px] items-center justify-center rounded-pill border border-brand-line text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
        title="More"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[224px] rounded-xl border border-brand-line bg-white p-1.5 shadow-lift">
          <Link
            href={newBookingHref}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-brand-ink hover:bg-brand-light"
          >
            <Plus className="h-4 w-4 text-brand-mute" /> New booking for guest
          </Link>
          <button
            onMouseDown={() => {
              setOpen(false);
              setTagOpen(true);
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-brand-ink hover:bg-brand-light"
          >
            <TagIcon className="h-4 w-4 text-brand-mute" /> Add tag
          </button>
          <button
            onMouseDown={() => void exportVcard()}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-brand-ink hover:bg-brand-light"
          >
            <Download className="h-4 w-4 text-brand-mute" /> Export (vCard)
          </button>
          <div className="my-1 h-px bg-brand-line" />
          <button
            onMouseDown={() => void toggleBlock()}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium hover:bg-red-50 ${
              r.is_blocked ? "text-brand-ink" : "text-status-cancelled"
            }`}
          >
            {r.is_blocked ? (
              <>
                <ShieldCheck className="h-4 w-4" /> Unblock guest
              </>
            ) : (
              <>
                <Ban className="h-4 w-4" /> Block guest
              </>
            )}
          </button>
        </div>
      ) : null}

      <FormModal
        open={tagOpen}
        onOpenChange={setTagOpen}
        size="sm"
        title="Add a tag"
        description={`Tag ${r.name ?? "this guest"} (e.g. VIP, Corporate).`}
      >
        <form
          id="record-tag-form"
          onSubmit={(e) => {
            e.preventDefault();
            void addTag();
          }}
        >
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="e.g. VIP"
            autoFocus
            maxLength={40}
            className="h-10 w-full rounded-lg border border-brand-line bg-white px-3 text-sm text-brand-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </form>
        <FormModalFooter>
          <FormModalCancel>Cancel</FormModalCancel>
          <button
            type="submit"
            form="record-tag-form"
            disabled={!tag.trim()}
            className="rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-secondary disabled:opacity-50"
          >
            Add tag
          </button>
        </FormModalFooter>
      </FormModal>
    </div>
  );
}

// ── Notes panel ─────────────────────────────────────────────────────────
function NotesPanel({ gkey, notes }: { gkey: string; notes: NoteItem[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    const res = await addGuestNoteAction(gkey, text.trim());
    setBusy(false);
    if (!res.ok) {
      void modal.error({ title: "Couldn't save note", description: res.error });
      return;
    }
    setText("");
    router.refresh();
  }

  async function togglePin(n: NoteItem) {
    const res = await pinGuestNoteAction(gkey, n.id, !n.isPinned);
    if (!res.ok) {
      void modal.error({ title: "Couldn't update", description: res.error });
      return;
    }
    router.refresh();
  }

  async function remove(n: NoteItem) {
    const ok = await modal.destructive({
      title: "Delete this note?",
      description: "This can't be undone.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    const res = await deleteGuestNoteAction(gkey, n.id);
    if (!res.ok) {
      void modal.error({ title: "Couldn't delete", description: res.error });
      return;
    }
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
        <div className="font-display text-[15px] font-bold text-brand-ink">
          Internal notes
        </div>
        <span className="rounded-pill bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand-mute">
          Host-only · not shown to guest
        </span>
      </div>

      <div className="space-y-4 p-5">
        {notes.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-brand-mute">
            No notes yet. Jot down anything worth remembering about this guest.
          </div>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="group flex gap-2.5">
              <div className="min-w-0 flex-1">
                <div
                  className={`rounded-[12px] rounded-tl-sm px-3 py-2 text-[12.5px] leading-relaxed text-brand-ink ${
                    n.isPinned
                      ? "border border-amber-200 bg-amber-50"
                      : "bg-brand-light"
                  }`}
                >
                  {n.body}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10.5px] text-brand-mute">
                  {n.isPinned ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                      <Pin className="h-3 w-3" /> Pinned
                    </span>
                  ) : null}
                  <span>
                    {n.authorName} ·{" "}
                    {new Date(n.createdAt).toLocaleDateString("en-ZA", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => void togglePin(n)}
                      title={n.isPinned ? "Unpin" : "Pin"}
                      className="flex h-6 w-6 items-center justify-center rounded text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                    >
                      {n.isPinned ? (
                        <PinOff className="h-3.5 w-3.5" />
                      ) : (
                        <Pin className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => void remove(n)}
                      title="Delete"
                      className="flex h-6 w-6 items-center justify-center rounded text-brand-mute hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-brand-line p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void add();
            }
          }}
          placeholder="Add a note…"
          className="flex-1 rounded-[10px] border border-brand-line px-3 py-2.5 text-[13px] text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
        />
        <button
          onClick={() => void add()}
          disabled={busy || !text.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-primary text-white hover:bg-brand-secondary disabled:opacity-50"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

// ── Reputation panel (host → guest rating, cross-host) ───────────────────
// Internal, host-only. The aggregate (avg across every host) sits on top, then
// the signed-in host's own editable review, then peers' reviews (anonymised).
const RATING_DIMS: { key: RatingDimensionKey; label: string }[] = [
  { key: "payments", label: "Payments" },
  { key: "communication", label: "Communication" },
  { key: "cleanliness", label: "Cleanliness" },
  { key: "house_rules", label: "House rules & respect" },
  { key: "integrity", label: "Integrity" },
];

function RatingCard({
  row,
  attribution,
}: {
  row: GuestRatingRow;
  attribution: string;
}) {
  const dims = RATING_DIMS.filter((d) => typeof row.scores[d.key] === "number");
  return (
    <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2">
          <StarRow rating={row.rating} size="md" />
          <span className="font-display text-[14px] font-bold tabular-nums text-brand-ink">
            {row.rating.toFixed(1)}
          </span>
        </span>
        <span className="text-[11.5px] text-brand-mute">{attribution}</span>
      </div>
      {row.summary ? (
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-brand-ink">
          {row.summary}
        </p>
      ) : null}
      {dims.length > 0 ? (
        <div className="mt-3 space-y-1.5 border-t border-brand-line pt-3">
          {dims.map((d) => (
            <div key={d.key}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12.5px] text-brand-mute">{d.label}</span>
                <StarRow rating={row.scores[d.key] as number} />
              </div>
              {row.notes[d.key] ? (
                <p className="mt-0.5 text-[12px] italic text-brand-mute">
                  &ldquo;{row.notes[d.key]}&rdquo;
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReputationPanel({
  guestId,
  guestName,
  reputation,
}: {
  guestId: string | null;
  guestName: string;
  reputation: ReputationData;
}) {
  const router = useRouter();
  const [rateOpen, setRateOpen] = useState(false);
  const [pending, start] = useTransition();

  // Only registered guests (a Wielo account) are rateable.
  if (!reputation.hasAccount || !guestId) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white px-6 py-12 text-center">
        <ShieldCheck className="mx-auto h-6 w-6 text-brand-mute/50" />
        <p className="mt-2 text-[13px] font-semibold text-brand-ink">
          No Wielo account yet
        </p>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-brand-mute">
          Guest ratings attach to a guest&rsquo;s Wielo account. This contact
          booked by email only, so there&rsquo;s nothing to rate yet.
        </p>
      </div>
    );
  }

  const { myRating, otherRatings, aggregate, canRate } = reputation;
  const dimAverages = RATING_DIMS.filter(
    (d) => typeof aggregate.dimensions[d.key] === "number",
  );

  function removeRating() {
    if (!guestId) return;
    void modal
      .destructive({
        title: "Remove your rating?",
        description: `Your review of ${guestName} will be permanently deleted. Other hosts' ratings are unaffected.`,
        confirmLabel: "Remove rating",
      })
      .then((ok) => {
        if (!ok) return;
        start(async () => {
          const res = await deleteGuestRatingAction(guestId);
          if (res.ok) {
            toast.success("Your rating was removed.");
            router.refresh();
          } else {
            void modal.error({
              title: "Couldn't remove",
              description: res.error,
            });
          }
        });
      });
  }

  return (
    <div className="space-y-5">
      {/* Aggregate header */}
      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-pill bg-brand-light">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            </div>
            <div>
              <div className="font-display text-2xl font-extrabold leading-none text-brand-ink">
                {aggregate.overall !== null
                  ? aggregate.overall.toFixed(1)
                  : "—"}
              </div>
              <div className="mt-1 text-[12px] text-brand-mute">
                {aggregate.hostCount === 0
                  ? "Not yet rated"
                  : `Rated by ${aggregate.hostCount} ${
                      aggregate.hostCount === 1 ? "host" : "hosts"
                    }`}
              </div>
            </div>
          </div>
          <p className="max-w-[260px] text-[11.5px] leading-relaxed text-brand-mute">
            Host-only &amp; shared across Wielo. {guestName} never sees this.
          </p>
        </div>
        {dimAverages.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-1.5 border-t border-brand-line pt-4 sm:grid-cols-2">
            {dimAverages.map((d) => (
              <div
                key={d.key}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-[12.5px] text-brand-mute">{d.label}</span>
                <span className="inline-flex items-center gap-1.5">
                  <StarRow rating={aggregate.dimensions[d.key] as number} />
                  <span className="w-7 text-right text-[12px] tabular-nums text-brand-mute">
                    {(aggregate.dimensions[d.key] as number).toFixed(1)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* Your review */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="font-display text-[15px] font-bold text-brand-ink">
            Your review
          </h3>
          {myRating ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setRateOpen(true)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line px-3 py-1.5 text-[12.5px] font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
              >
                <Pencil className="h-3.5 w-3.5 text-brand-mute" /> Edit
              </button>
              <button
                onClick={removeRating}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line px-3 py-1.5 text-[12.5px] font-semibold text-status-cancelled transition hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          ) : null}
        </div>

        {myRating ? (
          <RatingCard row={myRating} attribution="Your review" />
        ) : (
          <div className="rounded-card border border-dashed border-brand-line bg-white px-6 py-8 text-center">
            <p className="text-[13px] text-brand-ink">
              You haven&rsquo;t rated {guestName} yet.
            </p>
            {canRate ? (
              <button
                onClick={() => setRateOpen(true)}
                className="mt-3 inline-flex items-center gap-2 rounded bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-secondary"
              >
                <Star className="h-4 w-4" /> Rate this guest
              </button>
            ) : (
              <p className="mt-2 text-[12px] text-brand-mute">
                Available after a completed stay.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Other hosts */}
      {otherRatings.length > 0 ? (
        <section>
          <h3 className="mb-2 font-display text-[15px] font-bold text-brand-ink">
            Other hosts ({otherRatings.length})
          </h3>
          <div className="space-y-3">
            {otherRatings.map((row) => (
              <RatingCard
                key={row.id}
                row={row}
                attribution={`A verified host · ${fmtDate(row.updatedAt)}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      <RateGuestModal
        open={rateOpen}
        onOpenChange={setRateOpen}
        guestId={guestId}
        guestName={guestName}
        initial={myRating}
      />
    </div>
  );
}

function RateGuestModal({
  open,
  onOpenChange,
  guestId,
  guestName,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  guestId: string;
  guestName: string;
  initial: GuestRatingRow | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const zero: Record<RatingDimensionKey, number> = {
    payments: 0,
    communication: 0,
    cleanliness: 0,
    house_rules: 0,
    integrity: 0,
  };
  const empty: Record<RatingDimensionKey, string> = {
    payments: "",
    communication: "",
    cleanliness: "",
    house_rules: "",
    integrity: "",
  };
  const [scores, setScores] = useState<Record<RatingDimensionKey, number>>(
    initial
      ? {
          payments: initial.scores.payments ?? 0,
          communication: initial.scores.communication ?? 0,
          cleanliness: initial.scores.cleanliness ?? 0,
          house_rules: initial.scores.house_rules ?? 0,
          integrity: initial.scores.integrity ?? 0,
        }
      : zero,
  );
  const [notes, setNotes] = useState<Record<RatingDimensionKey, string>>(
    initial
      ? {
          payments: initial.notes.payments ?? "",
          communication: initial.notes.communication ?? "",
          cleanliness: initial.notes.cleanliness ?? "",
          house_rules: initial.notes.house_rules ?? "",
          integrity: initial.notes.integrity ?? "",
        }
      : empty,
  );

  function submit() {
    if (rating < 1) {
      toast.error("Pick an overall rating.");
      return;
    }
    const input: GuestRatingInput = {
      rating,
      summary: summary.trim() || null,
      rating_payments: scores.payments || null,
      rating_communication: scores.communication || null,
      rating_cleanliness: scores.cleanliness || null,
      rating_house_rules: scores.house_rules || null,
      rating_integrity: scores.integrity || null,
      note_payments: notes.payments.trim() || null,
      note_communication: notes.communication.trim() || null,
      note_cleanliness: notes.cleanliness.trim() || null,
      note_house_rules: notes.house_rules.trim() || null,
      note_integrity: notes.integrity.trim() || null,
    };
    start(async () => {
      const res = await upsertGuestRatingAction(guestId, input);
      if (res.ok) {
        toast.success("Your rating was saved.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={initial ? "Edit your rating" : `Rate ${guestName}`}
      description="Host-only and shared with other Wielo hosts. The guest never sees this."
    >
      <form
        id="rate-guest-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <div className="rounded-lg border border-brand-line px-4 py-3">
          <CategoryStars
            label="Overall rating"
            value={rating}
            onChange={setRating}
            disabled={pending}
          />
        </div>

        <div>
          <label
            htmlFor="rate-guest-summary"
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-mute"
          >
            Summary (optional)
          </label>
          <textarea
            id="rate-guest-summary"
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value.slice(0, 1500))}
            placeholder="How was hosting this guest? Be factual and fair — other hosts rely on it."
            disabled={pending}
            className="mt-1.5 block w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>

        <fieldset className="rounded-lg border border-brand-line px-4 py-3">
          <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-mute">
            Rate by area (optional)
          </legend>
          <div className="mt-1 space-y-3">
            {RATING_DIMS.map((d) => (
              <div key={d.key}>
                <CategoryStars
                  label={d.label}
                  value={scores[d.key]}
                  disabled={pending}
                  onChange={(n) =>
                    setScores((prev) => ({ ...prev, [d.key]: n }))
                  }
                />
                {scores[d.key] > 0 ? (
                  <input
                    value={notes[d.key]}
                    onChange={(e) =>
                      setNotes((prev) => ({
                        ...prev,
                        [d.key]: e.target.value.slice(0, 300),
                      }))
                    }
                    placeholder={`Add a note on ${d.label.toLowerCase()} (optional)`}
                    disabled={pending}
                    className="mt-1.5 block w-full rounded-lg border border-brand-line bg-white px-3 py-1.5 text-[12.5px] text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </fieldset>
      </form>
      <FormModalFooter>
        <FormModalCancel>Cancel</FormModalCancel>
        <button
          type="submit"
          form="rate-guest-form"
          disabled={pending || rating < 1}
          className="rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? "Saving…" : initial ? "Save changes" : "Submit rating"}
        </button>
      </FormModalFooter>
    </FormModal>
  );
}
