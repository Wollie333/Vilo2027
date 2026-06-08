"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  Calendar,
  Ban,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  MailCheck,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Pin,
  PinOff,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { sendMessageAction } from "@/app/dashboard/inbox/actions";
import { LedgerList } from "@/components/finance/LedgerList";
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
  exportGuestVcardAction,
  pinGuestNoteAction,
  recordOptOutAction,
  unblockGuestAction,
} from "../actions";

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

export type MessageItem = {
  id: string;
  body: string;
  mine: boolean;
  createdAt: string;
};

export type TemplateItem = { id: string; title: string; body: string };

export type ReviewItem = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  isPublished: boolean;
  listingName: string;
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

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "finances", label: "Finances" },
  { key: "messages", label: "Messages" },
  { key: "reviews", label: "Reviews" },
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
  txns,
  quotes,
  marketingState,
  notes,
  pinnedNote,
  messages,
  conversationId,
  templates,
  prevGkey,
  nextGkey,
  balance,
}: {
  record: GuestRecordData;
  bookings: BookingItem[];
  reviews: ReviewItem[];
  txns: Txn[];
  quotes: QuoteItem[];
  marketingState: "subscribed" | "unsubscribed" | "needs_consent" | "no_email";
  notes: NoteItem[];
  pinnedNote: NoteItem | null;
  messages: MessageItem[];
  conversationId: string | null;
  templates: TemplateItem[];
  prevGkey: string | null;
  nextGkey: string | null;
  balance: { net: number; outstanding: number; storeCredit: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "overview";

  const setTab = (t: string) => {
    const next = new URLSearchParams(params.toString());
    if (t === "overview") next.delete("tab");
    else next.set("tab", t);
    router.push(`${pathname}?${next.toString()}`);
  };

  const r = record;
  const segLabel = r.is_vip
    ? r.is_returning
      ? "VIP · Returning"
      : "VIP"
    : r.is_returning
      ? "Returning"
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

  return (
    <div className="mx-auto max-w-[1040px] px-4 py-5 lg:px-6">
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

      {/* ── Identity header ── */}
      <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <div className="p-6 lg:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-4">
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
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-brand-primary text-white">
                    <BadgeCheck className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-[24px] font-extrabold leading-tight text-brand-ink">
                    {r.name ?? "Guest"}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-pill border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-emerald-700">
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
                      <span
                        key={t}
                        className="rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand-mute"
                      >
                        {t}
                      </span>
                    ))}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px]">
                  {r.email ? (
                    <a
                      href={`mailto:${r.email}`}
                      className="inline-flex items-center gap-2 text-brand-ink hover:text-brand-primary"
                    >
                      <MailCheck className="h-4 w-4 text-brand-mute" />{" "}
                      {r.email}
                    </a>
                  ) : null}
                  {r.phone ? (
                    <a
                      href={`tel:${r.phone}`}
                      className="inline-flex items-center gap-2 text-brand-ink hover:text-brand-primary"
                    >
                      <Phone className="h-4 w-4 text-brand-mute" /> {r.phone}
                    </a>
                  ) : null}
                  {r.country ? (
                    <span className="inline-flex items-center gap-2 text-brand-mute">
                      <MapPin className="h-4 w-4" /> {r.country}
                    </span>
                  ) : null}
                  {r.guest_since ? (
                    <span className="inline-flex items-center gap-2 text-brand-mute">
                      <Calendar className="h-4 w-4" /> Guest since{" "}
                      {new Date(r.guest_since).getFullYear()}
                    </span>
                  ) : null}
                </div>
                {r.is_verified ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-pill bg-status-confirmed/10 px-2 py-0.5 text-[10.5px] font-semibold text-status-confirmed">
                      <MailCheck className="h-3 w-3" /> Email confirmed
                    </span>
                    {r.is_all_direct && r.total_stays > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold text-brand-primary">
                        All direct
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <MarketingConsent gkey={r.gkey} state={marketingState} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/inbox"
                className="inline-flex h-[42px] items-center gap-1.5 rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary"
              >
                <MessageSquare className="h-4 w-4" /> Message
              </Link>
              {r.phone ? (
                <a
                  href={`tel:${r.phone}`}
                  className="inline-flex h-[42px] items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
                >
                  <Phone className="h-4 w-4 text-brand-mute" /> Call
                </a>
              ) : null}
              <RecordActions r={r} />
            </div>
          </div>

          {/* net balance banner */}
          <BalanceBanner balance={balance} currency={r.currency} />

          {/* lifetime stat band */}
          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-brand-line bg-brand-line sm:grid-cols-3 lg:grid-cols-5">
            <StatTile
              label="Total stays"
              value={String(r.total_stays)}
              sub={`${r.total_nights} nights`}
            />
            <StatTile
              label="Lifetime value"
              value={formatMoney(r.lifetime_value, r.currency)}
              sub={`avg ${formatMoney(r.avg_ltv_per_stay, r.currency)} / stay`}
              subTone="good"
            />
            <StatTile
              label="Avg rating left"
              value={r.avg_rating ? `${r.avg_rating}` : "—"}
              valueIcon={
                r.avg_rating ? (
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                ) : undefined
              }
              sub={`from ${r.review_count} review${r.review_count === 1 ? "" : "s"}`}
            />
            <StatTile
              label="Cancellations"
              value={String(r.guest_cancellations)}
              sub={
                r.reliability_pct !== null
                  ? `${r.reliability_pct}% reliable`
                  : "—"
              }
            />
            <div className="col-span-2 bg-brand-secondary p-4 sm:col-span-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                Next stay
              </div>
              {r.next_stay ? (
                <>
                  <div className="mt-1.5 font-display text-[18px] font-bold leading-none text-white">
                    {r.next_stay_in_days === 0
                      ? "Today"
                      : r.next_stay_in_days === 1
                        ? "Tomorrow"
                        : `In ${r.next_stay_in_days} days`}
                  </div>
                  <div className="mt-1 text-[11px] text-brand-accent">
                    {fmtShort(r.next_stay)}
                    {r.next_listing ? ` · ${r.next_listing}` : ""}
                  </div>
                </>
              ) : (
                <div className="mt-1.5 font-display text-[16px] font-bold leading-none text-white">
                  None scheduled
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Tabs ── */}
      <div className="mt-6 border-b border-brand-line">
        <nav className="flex items-stretch gap-7 overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.key;
            const count =
              t.key === "finances"
                ? txns.length
                : t.key === "messages"
                  ? messages.length
                  : t.key === "reviews"
                    ? reviews.length
                    : t.key === "notes"
                      ? notes.length
                      : undefined;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative whitespace-nowrap py-3 text-[14px] font-semibold transition-colors ${
                  active
                    ? "text-brand-secondary"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                {t.label}
                {count !== undefined ? (
                  <span className="ml-1.5 rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
                    {count}
                  </span>
                ) : null}
                {active ? (
                  <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded bg-brand-primary" />
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-6">
        {tab === "overview" ? (
          <Overview
            r={r}
            bookings={bookings}
            nextBooking={nextBooking}
            pinnedNote={pinnedNote}
          />
        ) : tab === "messages" ? (
          <MessagesPanel
            firstName={(r.name ?? "guest").split(/\s+/)[0]}
            messages={messages}
            conversationId={conversationId}
            templates={templates}
            isRegistered={r.is_verified}
          />
        ) : tab === "notes" ? (
          <NotesPanel gkey={r.gkey} notes={notes} />
        ) : tab === "reviews" ? (
          <ReviewsPanel reviews={reviews} />
        ) : (
          <FinancesPanel txns={txns} quotes={quotes} />
        )}
      </div>
      <div className="h-6" />
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  subTone,
  valueIcon,
}: {
  label: string;
  value: string;
  sub: string;
  subTone?: "good";
  valueIcon?: React.ReactNode;
}) {
  return (
    <div className="bg-[#FAFCFB] p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        {label}
      </div>
      <div className="mt-1.5 inline-flex items-center gap-1 font-display text-[22px] font-bold leading-none text-brand-ink">
        {value}
        {valueIcon}
      </div>
      <div
        className={`mt-1 text-[11px] ${subTone === "good" ? "font-medium text-status-confirmed" : "text-brand-mute"}`}
      >
        {sub}
      </div>
    </div>
  );
}

// ── Overview ────────────────────────────────────────────────────────────
function Overview({
  r,
  bookings,
  nextBooking,
  pinnedNote,
}: {
  r: GuestRecordData;
  bookings: BookingItem[];
  nextBooking: BookingItem | undefined;
  pinnedNote: NoteItem | null;
}) {
  const realized = new Set(["confirmed", "checked_in", "completed"]);
  const activity = [...bookings]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 5);
  const latestRequest = bookings.find(
    (b) => b.specialRequests,
  )?.specialRequests;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-6">
        {nextBooking ? (
          <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
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
                    {fmtShort(nextBooking.checkOut)} · {nextBooking.nights}{" "}
                    nights · {nextBooking.guestsCount} guests
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

        <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <div className="border-b border-brand-line px-5 py-3.5">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
              Recent activity
            </div>
          </div>
          <div className="p-5">
            {activity.length === 0 ? (
              <div className="text-[13px] text-brand-mute">
                No activity yet.
              </div>
            ) : (
              <ol className="relative space-y-4 border-l-2 border-brand-line pl-5">
                {activity.map((b) => (
                  <li key={b.id}>
                    <span
                      className={`absolute -left-[7px] mt-0.5 h-3 w-3 rounded-full border-2 border-white ${realized.has(b.status) ? "bg-brand-primary" : "bg-brand-mute"}`}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[13px] font-semibold text-brand-ink">
                        Booked {b.listingName}
                      </div>
                      <div className="text-[11px] text-brand-mute">
                        {fmtShort(b.createdAt.slice(0, 10))}
                      </div>
                    </div>
                    <div className="text-[12px] text-brand-mute">
                      {b.channel && b.channel !== "direct"
                        ? `${b.channel} · `
                        : "Direct · "}
                      {formatMoney(b.totalAmount, b.currency)} ·{" "}
                      {statusTag(b.status).label}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <div className="border-b border-brand-line px-5 py-3.5">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
              Insights
            </div>
          </div>
          <ul className="divide-y divide-brand-line text-[12.5px]">
            {r.preferred_listing ? (
              <li className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="text-brand-mute">Usual listing</span>
                <span className="truncate font-semibold text-brand-ink">
                  {r.preferred_listing}
                </span>
              </li>
            ) : null}
            {r.avg_lead_days !== null ? (
              <li className="flex items-center justify-between px-5 py-3">
                <span className="text-brand-mute">Books ahead</span>
                <span className="font-semibold text-brand-ink">
                  ~{r.avg_lead_days} days
                </span>
              </li>
            ) : null}
            <li className="flex items-center justify-between px-5 py-3">
              <span className="text-brand-mute">Channel</span>
              <span className="font-semibold text-brand-ink">
                {r.is_all_direct && r.total_stays > 0
                  ? "All direct"
                  : r.is_ota
                    ? "Via OTA"
                    : "Direct"}
              </span>
            </li>
            {latestRequest ? (
              <li className="px-5 py-3">
                <div className="text-brand-mute">Needs</div>
                <div className="mt-0.5 font-medium text-brand-ink">
                  {latestRequest}
                </div>
              </li>
            ) : null}
          </ul>
        </section>

        {pinnedNote ? (
          <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                Pinned note
              </div>
              <span className="rounded-pill bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand-mute">
                Host-only
              </span>
            </div>
            <div className="p-4">
              <div className="rounded-[12px] rounded-tl-sm bg-brand-light px-3 py-2 text-[12.5px] leading-relaxed text-brand-ink">
                {pinnedNote.body}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

// ── Net balance banner ──────────────────────────────────────────────────
function BalanceBanner({
  balance,
  currency,
}: {
  balance: { net: number; outstanding: number; storeCredit: number };
  currency: string;
}) {
  const owes = balance.net < -0.001; // guest owes the host
  const credit = balance.net > 0.001; // host owes the guest
  const tone = owes
    ? "border-red-200 bg-red-50"
    : credit
      ? "border-emerald-200 bg-emerald-50"
      : "border-brand-line bg-brand-light";
  const numTone = owes
    ? "text-red-600"
    : credit
      ? "text-emerald-700"
      : "text-brand-ink";
  return (
    <div
      className={`mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border px-5 py-4 ${tone}`}
    >
      <div>
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute">
          Guest balance
        </div>
        <div
          className={`mt-1 font-display text-[26px] font-extrabold leading-none ${numTone}`}
        >
          {owes ? "– " : credit ? "+ " : ""}
          {formatMoney(Math.abs(balance.net), currency)}
        </div>
        <div className="mt-1.5 text-[12px] text-brand-mute">
          {owes
            ? "Owed to you by this guest"
            : credit
              ? "Store credit you owe this guest"
              : "All settled"}
        </div>
      </div>
      <div className="text-right text-[12px] text-brand-mute">
        <div>
          Outstanding{" "}
          <span className="font-semibold text-brand-ink">
            {formatMoney(balance.outstanding, currency)}
          </span>
        </div>
        <div className="mt-1">
          Store credit{" "}
          <span className="font-semibold text-emerald-700">
            {formatMoney(balance.storeCredit, currency)}
          </span>
        </div>
      </div>
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
    <div className="mt-3 inline-flex items-center gap-2.5 rounded-lg border border-brand-line bg-brand-light/40 px-3 py-2">
      <input
        type="checkbox"
        checked={meta.checked}
        disabled
        aria-label="Marketing subscription (read-only)"
        className="h-4 w-4 rounded border-brand-line text-brand-primary disabled:opacity-100"
      />
      <span className={`text-[12px] font-semibold ${meta.tone}`}>
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
          className="text-[12px] font-medium text-brand-mute underline-offset-2 hover:text-status-cancelled hover:underline disabled:opacity-50"
        >
          Record opt-out
        </button>
      ) : (
        <span className="text-[11px] text-brand-mute">guest-controlled</span>
      )}
    </div>
  );
}

// ── Reviews panel ───────────────────────────────────────────────────────
function ReviewsPanel({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white px-6 py-16 text-center text-[13px] text-brand-mute">
        This guest hasn&rsquo;t left any reviews yet.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {reviews.map((rev) => (
        <section
          key={rev.id}
          className="rounded-card border border-brand-line bg-white p-5 shadow-card"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < rev.rating ? "fill-amber-400 text-amber-400" : "text-brand-line"}`}
                />
              ))}
              <span className="ml-1 text-[13px] font-semibold text-brand-ink">
                {rev.rating.toFixed(1)}
              </span>
            </div>
            <span
              className={`rounded-pill border px-2 py-0.5 text-[10.5px] font-semibold ${
                rev.isPublished
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-brand-line bg-brand-light text-brand-mute"
              }`}
            >
              {rev.isPublished ? "Published" : "Hidden"}
            </span>
          </div>
          {rev.body ? (
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-brand-ink">
              &ldquo;{rev.body}&rdquo;
            </p>
          ) : null}
          <div className="mt-2.5 text-[11.5px] text-brand-mute">
            {rev.listingName} · {fmtDate(rev.createdAt.slice(0, 10))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ── Finances panel (invoices · quotes · refunds · credit notes) ──────────
function financeStatusCls(status: string): string {
  const s = status.toLowerCase();
  if (["paid", "issued", "accepted", "completed", "approved"].includes(s))
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["pending", "sent", "draft", "negotiating", "escalated"].includes(s))
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
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
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
function FinancesPanel({ txns, quotes }: { txns: Txn[]; quotes: QuoteItem[] }) {
  return (
    <div className="space-y-6">
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
    </div>
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

// ── Messages panel ──────────────────────────────────────────────────────
function applyTemplate(body: string, firstName: string): string {
  return body.replace(/\{\{\s*guest_name\s*\}\}/gi, firstName);
}

function MessagesPanel({
  firstName,
  messages,
  conversationId,
  templates,
  isRegistered,
}: {
  firstName: string;
  messages: MessageItem[];
  conversationId: string | null;
  templates: TemplateItem[];
  isRegistered: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function send() {
    if (!conversationId || !text.trim()) return;
    setSending(true);
    const res = await sendMessageAction({
      conversation_id: conversationId,
      body: text.trim(),
    });
    setSending(false);
    if (!res.ok) {
      void modal.error({ title: "Couldn't send", description: res.error });
      return;
    }
    setText("");
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
          Message history
        </div>
        <Link
          href="/dashboard/inbox"
          className="text-[12px] font-medium text-brand-primary hover:underline"
        >
          Open in inbox →
        </Link>
      </div>

      {messages.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <div className="text-[13px] font-semibold text-brand-ink">
            No messages yet
          </div>
          <div className="mx-auto mt-1 max-w-sm text-[12.5px] text-brand-mute">
            {isRegistered
              ? "Start a conversation from the inbox — replies will appear here."
              : "This contact has no account, so there's no message thread. Reach them by email or phone."}
          </div>
        </div>
      ) : (
        <div className="thin-scroll max-h-[460px] space-y-3 overflow-y-auto bg-[#FAFCFB] p-5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={m.mine ? "ml-auto" : ""}
              style={{ maxWidth: "78%" }}
            >
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
                  m.mine
                    ? "rounded-br-sm bg-brand-secondary text-white"
                    : "rounded-bl-sm border border-brand-line bg-white text-brand-ink"
                }`}
              >
                {m.body}
              </div>
              <div
                className={`mt-1 text-[10.5px] text-brand-mute ${m.mine ? "text-right" : ""}`}
              >
                {new Date(m.createdAt).toLocaleString("en-ZA", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* reply composer (only when there's a thread to reply to) */}
      {conversationId ? (
        <div className="border-t border-brand-line p-3">
          <div className="flex items-center gap-2">
            {templates.length > 0 ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
                  title="Insert template"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border border-brand-line text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                >
                  <Sparkles className="h-4 w-4" />
                </button>
                {pickerOpen ? (
                  <div className="absolute bottom-[calc(100%+6px)] left-0 z-30 max-h-72 w-72 overflow-y-auto rounded-xl border border-brand-line bg-white p-1.5 shadow-lift">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-mute">
                      Insert template
                    </div>
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        onMouseDown={() => {
                          setText(
                            (prev) =>
                              (prev ? prev + "\n\n" : "") +
                              applyTemplate(t.body, firstName),
                          );
                          setPickerOpen(false);
                        }}
                        className="block w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-brand-ink hover:bg-brand-light"
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={`Reply to ${firstName}…`}
              className="flex-1 rounded-pill border border-brand-line px-4 py-2.5 text-[13px] text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
            />
            <button
              onClick={() => void send()}
              disabled={sending || !text.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-brand-primary text-white hover:bg-brand-secondary disabled:opacity-50"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
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
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
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
