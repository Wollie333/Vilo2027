"use client";

import {
  ArrowLeft,
  Banknote,
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  MapPin,
  MessageSquare,
  Users,
  Zap,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { RecordTabs } from "@/app/[locale]/dashboard/_components/RecordTabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InboxAvatar } from "@/components/inbox/InboxAvatar";
import { formatMoney } from "@/lib/format";
import { Link } from "@/i18n/navigation";

import { PostActions } from "./_components/PostActions";
import { RequestMessages } from "./RequestMessages";
import type { RequestRecordData, TimelineEvent } from "./record-data";

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

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  draft: "bg-gray-100 text-gray-600",
  expired: "bg-amber-100 text-amber-700",
  fulfilled: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
};

const QUOTE_STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
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
            {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
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
          <div className="rounded-card border border-brand-line bg-white">
            <div className="grid grid-cols-2 gap-4 p-6 md:grid-cols-4">
              <Fact icon={<MapPin className="h-3.5 w-3.5" />} label="Location">
                {post.location_text ?? post.location_region ?? "Flexible"}
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
              </Fact>
            </div>
            {(detailsSlot || requirementsSlot) && (
              <div className="space-y-4 border-t border-brand-line p-6">
                {detailsSlot}
                {requirementsSlot}
              </div>
            )}
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
                className="flex flex-col gap-4 rounded-card border border-brand-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
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
                      <p className="font-semibold text-brand-ink">
                        {formatMoney(r.quote.totalAmount, r.quote.currency)}
                      </p>
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${QUOTE_STATUS_STYLES[r.quote.status] ?? QUOTE_STATUS_STYLES.sent}`}
                      >
                        {r.quote.status.charAt(0).toUpperCase() +
                          r.quote.status.slice(1)}
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
        <div className="rounded-card border border-brand-line bg-white p-6">
          {data.timeline.length === 0 ? (
            <p className="text-sm text-brand-mute">No activity yet.</p>
          ) : (
            <ol className="space-y-4">
              {data.timeline.map((ev, i) => (
                <TimelineRow key={i} ev={ev} />
              ))}
            </ol>
          )}
        </div>
      )}
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

const TIMELINE_TINT: Record<TimelineEvent["kind"], string> = {
  posted: "bg-brand-light text-brand-mute",
  quote_received: "bg-blue-100 text-blue-700",
  quote_viewed: "bg-blue-50 text-blue-600",
  quote_accepted: "bg-green-100 text-green-700",
  quote_declined: "bg-red-100 text-red-700",
  message: "bg-brand-light text-brand-mute",
  fulfilled: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
};

function TimelineRow({ ev }: { ev: TimelineEvent }) {
  const Icon =
    ev.kind === "quote_accepted" || ev.kind === "fulfilled"
      ? CheckCircle
      : ev.kind === "quote_received"
        ? MessageSquare
        : Clock;
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${TIMELINE_TINT[ev.kind]}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-brand-ink">{ev.label}</p>
        {ev.detail && <p className="text-xs text-brand-mute">{ev.detail}</p>}
      </div>
      <time className="shrink-0 text-xs text-brand-mute">{fmtRel(ev.at)}</time>
    </li>
  );
}
