"use client";

import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit,
  Eye,
  ImagePlus,
  MapPin,
  MessageSquare,
  Package,
  Star,
  Tag,
  Users,
  Zap,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { RecordTabs } from "@/app/[locale]/dashboard/_components/RecordTabs";
import {
  ActivityTimeline,
  type ActivityCategory,
  type ActivityActorKind,
  type ActivityEvent,
} from "@/components/admin/ActivityTimeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InboxAvatar } from "@/components/inbox/InboxAvatar";
import { formatMoney } from "@/lib/format";
import { Link } from "@/i18n/navigation";

import { PostActions } from "./_components/PostActions";
import { RequestMessages } from "./RequestMessages";
import type { RequestRecordData, TimelineEvent } from "./record-data";

// Map a Looking-For timeline event onto the shared ActivityTimeline vocabulary
// so the record's Timeline tab reads like the History/Activity feeds elsewhere.
const TIMELINE_MAP: Record<
  TimelineEvent["kind"],
  { category: ActivityCategory; actor: string; actorKind: ActivityActorKind }
> = {
  posted: { category: "system", actor: "You", actorKind: "user" },
  quote_received: { category: "booking", actor: "Host", actorKind: "host" },
  quote_viewed: { category: "booking", actor: "You", actorKind: "user" },
  quote_accepted: { category: "booking", actor: "You", actorKind: "user" },
  quote_declined: { category: "booking", actor: "You", actorKind: "user" },
  message: { category: "support", actor: "You", actorKind: "user" },
  fulfilled: { category: "booking", actor: "You", actorKind: "user" },
  cancelled: { category: "system", actor: "You", actorKind: "user" },
};

function fmtRel(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diffMs / 86_400_000);
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor(diffMs / 60_000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

/** Elapsed time between two instants, e.g. "3 hours" / "2 days". */
function fmtSince(fromIso: string, toIso: string): string {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return "under an hour";
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""}`;
  const days = Math.round(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""}`;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  draft: "bg-gray-100 text-gray-600",
  expired: "bg-amber-100 text-amber-700",
  fulfilled: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
  suspended: "bg-slate-200 text-slate-700",
};

const STATUS_LABELS: Record<string, string> = {
  suspended: "Paused",
};

const QUOTE_STATUS_STYLES: Record<string, string> = {
  draft: "border-brand-line bg-brand-light text-brand-mute",
  sent: "border-brand-accent bg-brand-accent/40 text-brand-secondary",
  viewed: "border-brand-accent bg-brand-accent/40 text-brand-secondary",
  accepted:
    "border-status-confirmed/30 bg-status-confirmed/10 text-status-confirmed",
  declined:
    "border-status-cancelled/30 bg-status-cancelled/10 text-status-cancelled",
  expired: "border-brand-line bg-brand-light text-brand-mute",
};

export function RequestRecord({
  data,
  detailsSlot,
  requirementsSlot,
}: {
  data: RequestRecordData;
  detailsSlot?: ReactNode;
  requirementsSlot?: ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "overview";
  const { post, responses, unreadTotal } = data;

  const setTab = (t: string) => {
    const next = new URLSearchParams(params.toString());
    if (t === "overview") next.delete("tab");
    else next.set("tab", t);
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();
  const daysLeft = post.expires_at
    ? Math.ceil((new Date(post.expires_at).getTime() - Date.now()) / 86_400_000)
    : null;

  // The guest's originally requested window (+ flexibility) — shown on each
  // quote card next to the host's quoted dates so the match is obvious.
  const flexSuffix =
    post.check_in_date && (post.date_flexibility_days ?? 0) > 0
      ? post.date_flexibility_days === 7
        ? " · ± 1 week"
        : post.date_flexibility_days === 14
          ? " · ± 2 weeks"
          : ` · ± ${post.date_flexibility_days} day${post.date_flexibility_days === 1 ? "" : "s"}`
      : "";
  const requestedDates =
    post.check_in_date && post.check_out_date
      ? `${fmtDate(post.check_in_date)} – ${fmtDate(post.check_out_date)}${flexSuffix}`
      : post.check_in_date
        ? `From ${fmtDate(post.check_in_date)}${flexSuffix}`
        : null;

  // ---- Quote insights. Everything below is derived from data the record
  // already loads — no extra queries — so the Overview can answer "how am I
  // doing?" without the guest opening the Quotes tab and doing the maths.
  const quotes = responses.flatMap((r) => (r.quote ? [r.quote] : []));
  const amounts = quotes.map((q) => q.totalAmount).filter((n) => n > 0);
  const lowest = amounts.length > 0 ? Math.min(...amounts) : null;
  const highest = amounts.length > 0 ? Math.max(...amounts) : null;
  const average =
    amounts.length > 0
      ? amounts.reduce((sum, n) => sum + n, 0) / amounts.length
      : null;
  const quoteCurrency = quotes[0]?.currency ?? post.budget_currency ?? "ZAR";
  const awaiting = quotes.filter(
    (q) => q.status === "sent" || q.status === "viewed",
  ).length;
  const acceptedResponse =
    responses.find((r) => r.quote?.status === "accepted") ?? null;
  const declinedCount = quotes.filter((q) => q.status === "declined").length;

  // Cheapest quote measured against the budget the guest actually asked for.
  const budgetCeiling = post.budget_max ?? null;
  const overBudgetBy =
    lowest !== null && budgetCeiling !== null && lowest > budgetCeiling
      ? lowest - budgetCeiling
      : null;
  const withinBudget =
    lowest !== null && budgetCeiling !== null && lowest <= budgetCeiling;

  const firstQuoteAt =
    responses.length > 0
      ? responses.reduce(
          (earliest, r) => (r.sentAt < earliest ? r.sentAt : earliest),
          responses[0].sentAt,
        )
      : null;

  const guestTotal = post.adults + (post.children ?? 0) + (post.infants ?? 0);
  const guestSummary =
    (post.children ?? 0) > 0 || (post.infants ?? 0) > 0
      ? `${post.adults} adult${post.adults !== 1 ? "s" : ""}${(post.children ?? 0) > 0 ? `, ${post.children} child${(post.children ?? 0) !== 1 ? "ren" : ""}` : ""}${(post.infants ?? 0) > 0 ? `, ${post.infants} infant${(post.infants ?? 0) !== 1 ? "s" : ""}` : ""}`
      : `${post.adults} guest${post.adults !== 1 ? "s" : ""}`;

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "quotes", label: "Quotes", count: responses.length },
    {
      key: "messages",
      label: "Messages",
      count: unreadTotal > 0 ? unreadTotal : undefined,
    },
    { key: "timeline", label: "Timeline", count: data.timeline.length },
  ];

  return (
    <div className="space-y-5">
      {/* Sub-header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="gap-1.5">
          <Link href="/portal/looking-for">
            <ArrowLeft className="h-4 w-4" />
            All requests
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/portal/looking-for/${post.id}/edit`}>
              <Edit className="mr-1.5 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <PostActions postId={post.id} status={post.status} />
        </div>
      </div>

      {/* Identity band */}
      <div className="rounded-card border border-brand-line bg-white p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[post.status] ?? STATUS_STYLES.draft}`}
          >
            {STATUS_LABELS[post.status] ??
              post.status.charAt(0).toUpperCase() + post.status.slice(1)}
          </span>
          <Badge variant="secondary" className="capitalize">
            {post.category}
          </Badge>
          {post.is_urgent && (
            <Badge variant="destructive" className="gap-1">
              <Zap className="h-3 w-3" />
              Urgent
            </Badge>
          )}
          {!post.is_public && <Badge variant="outline">Private</Badge>}
        </div>
        <h1 className="font-display text-xl font-bold text-brand-ink">
          {post.title}
        </h1>

        {post.status === "suspended" && (
          <p className="mt-3 rounded-card border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            This request is <strong>paused</strong> and hidden from hosts while
            our team takes a look. It isn&apos;t receiving new quotes right now
            — we&apos;ll be in touch if anything is needed.
          </p>
        )}

        {/* Stat band */}
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-brand-mute">
          <span className="flex items-center gap-1.5">
            <Eye className="h-4 w-4" />
            {post.view_count} views
          </span>
          <span className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            {responses.length} quote{responses.length !== 1 ? "s" : ""}
          </span>
          {unreadTotal > 0 && (
            <span className="flex items-center gap-1.5 font-medium text-brand-primary">
              {unreadTotal} unread
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            Posted {fmtRel(post.created_at)}
          </span>
          {post.status === "active" && daysLeft !== null && (
            <span
              className={
                daysLeft <= 3 ? "font-medium text-amber-600" : undefined
              }
            >
              {isExpired
                ? "Expired"
                : daysLeft <= 0
                  ? "Expires today"
                  : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <RecordTabs tabs={tabs} active={tab} onSelect={setTab} />

      {/* Panels */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* Cover photo. The guest uploads this on the request form and every
              other surface already renders it (public board, public post page,
              host respond card) — their own record was the only one that didn't. */}
          {post.image_url ? (
            <div className="h-44 w-full overflow-hidden rounded-card border border-brand-line bg-brand-light sm:h-56">
              {/* Fixed banner height rather than an aspect ratio: guests upload
                  anything (portrait phone shots included), and an aspect box
                  would let a tall image push the whole record below the fold. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.image_url}
                alt={post.title}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <Link
              href={`/portal/looking-for/${post.id}/edit`}
              className="flex items-center gap-3 rounded-card border border-dashed border-brand-line bg-white px-5 py-4 transition hover:border-brand-primary/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-primary">
                <ImagePlus className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-brand-ink">
                  Add a photo to your request
                </span>
                <span className="block text-xs text-brand-mute">
                  Requests with a photo stand out to hosts browsing the board.
                </span>
              </span>
              <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-brand-mute" />
            </Link>
          )}

          {/* What to do next — the record should tell the guest, not make them
              work it out from the tabs. */}
          {acceptedResponse ? (
            <NextAction
              tone="success"
              icon={<CheckCircle2 className="h-5 w-5" />}
              title={`You accepted ${acceptedResponse.host.name}'s quote`}
              body={
                acceptedResponse.quote?.convertedBookingId
                  ? "Your booking is confirmed. You can view it under your trips."
                  : "Complete payment to lock in your booking."
              }
              action={
                acceptedResponse.quote
                  ? {
                      label: acceptedResponse.quote.convertedBookingId
                        ? "View booking"
                        : "Pay now",
                      href: acceptedResponse.quote.convertedBookingId
                        ? `/portal/trips/${acceptedResponse.quote.convertedBookingId}`
                        : `/portal/quotes/${acceptedResponse.quote.id}`,
                    }
                  : undefined
              }
            />
          ) : awaiting > 0 ? (
            <NextAction
              tone="primary"
              icon={<MessageSquare className="h-5 w-5" />}
              title={`${awaiting} quote${awaiting !== 1 ? "s" : ""} waiting for your review`}
              body={
                lowest !== null && highest !== null && lowest !== highest
                  ? `Offers range from ${formatMoney(lowest, quoteCurrency)} to ${formatMoney(highest, quoteCurrency)}.`
                  : "Compare the offers and accept the one that suits you."
              }
              action={{
                label: responses.length > 1 ? "Compare quotes" : "View quote",
                href:
                  responses.length > 1
                    ? `/portal/looking-for/${post.id}/quotes`
                    : `/portal/quotes/${quotes[0]?.id ?? ""}`,
              }}
            />
          ) : post.status === "active" && quotes.length === 0 ? (
            <NextAction
              tone="muted"
              icon={<Clock className="h-5 w-5" />}
              title="No quotes yet"
              body={
                post.search_radius_km
                  ? `Hosts with a place within ${post.search_radius_km} km of your pin are being notified. Quotes usually arrive within a day or two.`
                  : "Hosts matching your request are being notified. Quotes usually arrive within a day or two."
              }
            />
          ) : declinedCount > 0 && quotes.length === declinedCount ? (
            <NextAction
              tone="muted"
              icon={<Clock className="h-5 w-5" />}
              title="No open quotes"
              body="Every quote on this request has been declined. Editing your dates, budget or requirements can attract new offers."
              action={{
                label: "Edit request",
                href: `/portal/looking-for/${post.id}/edit`,
              }}
            />
          ) : null}

          {/* Quote summary — answers "how am I doing?" without leaving Overview. */}
          {quotes.length > 0 && (
            <div className="rounded-card border border-brand-line bg-white p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-brand-mute">
                  Quote summary
                </h2>
                {responses.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-auto gap-1 px-2 py-1 text-xs"
                  >
                    <Link href={`/portal/looking-for/${post.id}/quotes`}>
                      Compare all
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Stat
                  label="Quotes in"
                  value={String(quotes.length)}
                  sub={
                    awaiting > 0
                      ? `${awaiting} awaiting you`
                      : declinedCount > 0
                        ? `${declinedCount} declined`
                        : null
                  }
                />
                <Stat
                  label="Lowest"
                  value={
                    lowest !== null ? formatMoney(lowest, quoteCurrency) : "—"
                  }
                  sub={
                    withinBudget
                      ? "Within your budget"
                      : overBudgetBy !== null
                        ? `${formatMoney(overBudgetBy, quoteCurrency)} over budget`
                        : null
                  }
                  subTone={
                    withinBudget
                      ? "good"
                      : overBudgetBy !== null
                        ? "warn"
                        : undefined
                  }
                />
                <Stat
                  label="Average"
                  value={
                    average !== null
                      ? formatMoney(Math.round(average), quoteCurrency)
                      : "—"
                  }
                />
                <Stat
                  label="Highest"
                  value={
                    highest !== null ? formatMoney(highest, quoteCurrency) : "—"
                  }
                />
              </div>

              {/* Who quoted — faces make the list scannable. */}
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-brand-line pt-4">
                <div className="flex items-center gap-2">
                  {responses.slice(0, 5).map((r) => (
                    <InboxAvatar
                      key={r.id}
                      name={r.host.name}
                      imageUrl={r.host.avatarUrl}
                      size={28}
                    />
                  ))}
                  {responses.length > 5 && (
                    <span className="text-xs text-brand-mute">
                      +{responses.length - 5}
                    </span>
                  )}
                </div>
                <p className="text-xs text-brand-mute">
                  {responses.length === 1
                    ? `${responses[0].host.name} quoted`
                    : `${responses.length} hosts quoted`}
                  {firstQuoteAt
                    ? ` · first reply ${fmtSince(post.created_at, firstQuoteAt)} after posting`
                    : ""}
                </p>
              </div>
            </div>
          )}

          <div className="rounded-card border border-brand-line bg-white">
            <div className="grid grid-cols-2 gap-4 p-6 md:grid-cols-4">
              <Fact icon={<MapPin className="h-3.5 w-3.5" />} label="Location">
                {post.location_text ?? post.location_region ?? "Flexible"}
                {post.search_radius_km && post.search_radius_km > 0 ? (
                  <span className="text-brand-primary">
                    {" "}
                    · within {post.search_radius_km} km
                  </span>
                ) : null}
              </Fact>
              <Fact icon={<Calendar className="h-3.5 w-3.5" />} label="Dates">
                {post.check_in_date && post.check_out_date
                  ? `${fmtDate(post.check_in_date)} – ${fmtDate(post.check_out_date)}`
                  : post.check_in_date
                    ? `From ${fmtDate(post.check_in_date)}`
                    : "Flexible"}
                {post.check_in_date && (post.date_flexibility_days ?? 0) > 0 ? (
                  <span className="mt-0.5 block text-xs font-normal text-brand-mute">
                    ± {post.date_flexibility_days} day
                    {post.date_flexibility_days !== 1 ? "s" : ""} flexible
                  </span>
                ) : null}
              </Fact>
              <Fact icon={<Users className="h-3.5 w-3.5" />} label="Guests">
                {guestTotal > 0 ? guestSummary : "Flexible"}
              </Fact>
              <Fact icon={<Banknote className="h-3.5 w-3.5" />} label="Budget">
                {post.budget_min || post.budget_max
                  ? post.budget_min && post.budget_max
                    ? `${formatMoney(post.budget_min, post.budget_currency ?? "ZAR")} – ${formatMoney(post.budget_max, post.budget_currency ?? "ZAR")}`
                    : post.budget_max
                      ? `Up to ${formatMoney(post.budget_max, post.budget_currency ?? "ZAR")}`
                      : `From ${formatMoney(post.budget_min, post.budget_currency ?? "ZAR")}`
                  : "Flexible"}
                {post.budget_per && (post.budget_min || post.budget_max) ? (
                  <span className="font-normal text-brand-mute">
                    {" "}
                    /{post.budget_per}
                  </span>
                ) : null}
                {post.is_all_in_quote ? (
                  <span className="mt-0.5 block text-xs font-normal text-brand-mute">
                    All-inclusive quotes only
                  </span>
                ) : null}
              </Fact>

              {/* Captured on the request but previously shown nowhere. */}
              {post.sub_category || post.event_type ? (
                <Fact icon={<Tag className="h-3.5 w-3.5" />} label="Type">
                  <span className="capitalize">
                    {[post.sub_category, post.event_type]
                      .filter(Boolean)
                      .join(" · ")
                      .replace(/_/g, " ")}
                  </span>
                </Fact>
              ) : null}
              {post.quote_deadline ? (
                <Fact
                  icon={<CalendarClock className="h-3.5 w-3.5" />}
                  label="Quotes needed by"
                >
                  {fmtDate(post.quote_deadline)}
                </Fact>
              ) : null}
              {post.min_host_rating ? (
                <Fact
                  icon={<Star className="h-3.5 w-3.5" />}
                  label="Host rating"
                >
                  {post.min_host_rating}+ stars
                </Fact>
              ) : null}
              {post.vendor_needs && post.vendor_needs.length > 0 ? (
                <Fact
                  icon={<Package className="h-3.5 w-3.5" />}
                  label="Also needs"
                >
                  <span className="capitalize">
                    {post.vendor_needs.join(", ").replace(/_/g, " ")}
                  </span>
                </Fact>
              ) : null}
            </div>
            {(detailsSlot || requirementsSlot) && (
              <div className="space-y-4 border-t border-brand-line p-6">
                {detailsSlot}
                {requirementsSlot}
              </div>
            )}
          </div>

          {/* Recent activity — a preview, with the full feed one tab away. */}
          {data.timeline.length > 0 && (
            <div className="rounded-card border border-brand-line bg-white p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-brand-mute">
                  Recent activity
                </h2>
                {data.timeline.length > 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTab("timeline")}
                    className="h-auto gap-1 px-2 py-1 text-xs"
                  >
                    View all
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <ul className="space-y-3">
                {data.timeline.slice(0, 3).map((ev, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary" />
                    <div className="min-w-0">
                      <p className="text-sm text-brand-ink">{ev.label}</p>
                      <p className="text-xs text-brand-mute">
                        {ev.detail ? `${ev.detail} · ` : ""}
                        {fmtRel(ev.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reach — how the request is performing on the board. */}
          <div className="grid grid-cols-2 gap-4 rounded-card border border-brand-line bg-white p-6 md:grid-cols-4">
            <Stat label="Views" value={String(post.view_count)} />
            <Stat
              label="Quotes"
              value={String(responses.length)}
              sub={
                post.view_count > 0
                  ? `${Math.round((responses.length / post.view_count) * 100)}% of views`
                  : null
              }
            />
            <Stat
              label="First reply"
              value={
                firstQuoteAt ? fmtSince(post.created_at, firstQuoteAt) : "—"
              }
              sub={firstQuoteAt ? "after posting" : "no quotes yet"}
            />
            <Stat
              label="Posted"
              value={fmtDate(post.created_at)}
              sub={
                post.status === "active" && daysLeft !== null && daysLeft > 0
                  ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`
                  : null
              }
            />
          </div>
        </div>
      )}

      {tab === "quotes" && (
        <div className="space-y-3">
          {responses.length > 1 && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/portal/looking-for/${post.id}/quotes`}>
                  Compare all quotes
                </Link>
              </Button>
            </div>
          )}
          {responses.length === 0 ? (
            <EmptyCard
              icon={<MessageSquare className="h-5 w-5" />}
              title="No quotes yet"
              body="Hosts will send you quotes when they see your request."
            />
          ) : (
            responses.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-4 rounded-card border border-brand-line bg-white p-4 shadow-card transition hover:border-brand-primary/40 hover:shadow-lift sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <InboxAvatar
                    name={r.host.name}
                    imageUrl={r.host.avatarUrl}
                    size={44}
                  />
                  <div className="min-w-0">
                    <h3 className="font-medium text-brand-ink">
                      {r.host.name}
                    </h3>
                    <p className="text-sm text-brand-mute">
                      Sent {fmtRel(r.sentAt)}
                    </p>
                    {/* Which listing this quote is actually for. */}
                    {r.quote?.subject?.name && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-brand-mute">
                        {r.quote.subject.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.quote.subject.image}
                            alt=""
                            className="h-5 w-5 shrink-0 rounded object-cover"
                          />
                        )}
                        <span className="truncate">
                          <span className="font-medium text-brand-ink">
                            {r.quote.subject.name}
                          </span>
                          {r.quote.subject.detail
                            ? ` · ${r.quote.subject.detail}`
                            : ""}
                        </span>
                      </p>
                    )}
                    <div className="mt-1 space-y-0.5 text-xs text-brand-mute">
                      {requestedDates && (
                        <p>
                          <span className="font-medium text-brand-ink">
                            Requested:
                          </span>{" "}
                          {requestedDates}
                        </p>
                      )}
                      {r.quote?.checkIn && r.quote?.checkOut && (
                        <p>
                          <span className="font-medium text-brand-ink">
                            Quoted:
                          </span>{" "}
                          {fmtDate(r.quote.checkIn)} –{" "}
                          {fmtDate(r.quote.checkOut)}
                        </p>
                      )}
                    </div>
                    {r.quote?.notes && (
                      <p className="mt-1 line-clamp-2 max-w-md text-sm text-brand-mute">
                        {r.quote.notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:justify-end">
                  {r.quote && (
                    <div className="text-right">
                      <p className="font-display text-[15px] font-bold text-brand-ink">
                        {formatMoney(r.quote.totalAmount, r.quote.currency)}
                      </p>
                      <span
                        className={`mt-0.5 inline-flex items-center rounded-pill border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${QUOTE_STATUS_STYLES[r.quote.status] ?? QUOTE_STATUS_STYLES.sent}`}
                      >
                        {r.quote.status}
                      </span>
                    </div>
                  )}
                  {r.quote && (
                    <Button size="sm" asChild>
                      <Link href={`/portal/quotes/${r.quote.id}`}>
                        View &amp; accept
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "messages" && <RequestMessages data={data} />}

      {tab === "timeline" && (
        <ActivityTimeline
          title="Timeline"
          emptyLabel="No activity yet."
          events={data.timeline.map((ev, i): ActivityEvent => {
            const m = TIMELINE_MAP[ev.kind];
            return {
              id: String(i),
              category: m.category,
              title: ev.label,
              actor: m.actor,
              actorKind: m.actorKind,
              context: ev.detail,
              at: ev.at,
            };
          })}
        />
      )}
    </div>
  );
}

const NEXT_ACTION_TONES = {
  primary: {
    card: "border-brand-primary/30 bg-brand-accent/30",
    icon: "bg-brand-primary text-white",
  },
  success: {
    card: "border-status-confirmed/30 bg-status-confirmed/10",
    icon: "bg-status-confirmed text-white",
  },
  muted: {
    card: "border-brand-line bg-white",
    icon: "bg-brand-light text-brand-mute",
  },
} as const;

/** The "what now?" strip at the top of Overview. */
function NextAction({
  tone,
  icon,
  title,
  body,
  action,
}: {
  tone: keyof typeof NEXT_ACTION_TONES;
  icon: ReactNode;
  title: string;
  body: string;
  action?: { label: string; href: string };
}) {
  const styles = NEXT_ACTION_TONES[tone];
  return (
    <div
      className={`flex flex-col gap-4 rounded-card border p-5 sm:flex-row sm:items-center ${styles.card}`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${styles.icon}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-medium text-brand-ink">{title}</h2>
        <p className="mt-0.5 text-sm text-brand-mute">{body}</p>
      </div>
      {action && (
        <Button size="sm" asChild className="shrink-0">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  subTone,
}: {
  label: string;
  value: string;
  sub?: string | null;
  subTone?: "good" | "warn";
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-brand-mute">{label}</div>
      <p className="font-display text-lg font-bold text-brand-ink">{value}</p>
      {sub ? (
        <p
          className={`text-xs ${
            subTone === "good"
              ? "text-status-confirmed"
              : subTone === "warn"
                ? "text-amber-600"
                : "text-brand-mute"
          }`}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-brand-mute">
        {icon}
        {label}
      </div>
      <p className="text-sm font-medium text-brand-ink">{children}</p>
    </div>
  );
}

function EmptyCard({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-brand-mute">
        {icon}
      </div>
      <h3 className="font-medium text-brand-ink">{title}</h3>
      <p className="mt-1 text-sm text-brand-mute">{body}</p>
    </div>
  );
}
