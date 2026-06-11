import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Mail,
  MessageSquareWarning,
  Star,
} from "lucide-react";

import type { ReviewActivityRow } from "@/lib/reviews/activity";

import { StarRow } from "./StarRow";

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const wks = Math.round(days / 7);
  if (wks < 5) return `${wks}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

function untilLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "any moment";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.round(mins / 60);
  return `in ${hrs}h`;
}

function RequestCell({ row }: { row: ReviewActivityRow }) {
  if (row.requestSentAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-brand-mute">
        <Mail className="h-3.5 w-3.5 text-brand-secondary" />
        Sent {ago(row.requestSentAt)}
      </span>
    );
  }
  if (row.requestScheduledAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-status-pending">
        <Clock className="h-3.5 w-3.5" />
        Scheduled {untilLabel(row.requestScheduledAt)}
      </span>
    );
  }
  return <span className="text-[12.5px] text-brand-mute">Not sent</span>;
}

function StatusBadge({ row }: { row: ReviewActivityRow }) {
  switch (row.state) {
    case "needs_response":
      return (
        <Link
          href={`/dashboard/bookings/${row.bookingId}?tab=review`}
          className="inline-flex items-center gap-1.5 rounded-pill border border-status-pending/30 bg-status-pending/10 px-2.5 py-1 text-[11px] font-semibold text-status-pending transition hover:bg-status-pending/20"
        >
          <MessageSquareWarning className="h-3.5 w-3.5" />
          Needs response
        </Link>
      );
    case "responded":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-pill border border-status-confirmed/30 bg-status-confirmed/10 px-2.5 py-1 text-[11px] font-semibold text-status-confirmed">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Replied
        </span>
      );
    case "requested":
      return (
        <span className="rounded-pill border border-brand-line bg-brand-light px-2.5 py-1 text-[11px] font-medium text-brand-mute">
          Awaiting review
        </span>
      );
    case "scheduled":
      return (
        <span className="rounded-pill border border-brand-line bg-brand-light px-2.5 py-1 text-[11px] font-medium text-brand-mute">
          Request scheduled
        </span>
      );
    default:
      return (
        <span className="rounded-pill border border-brand-line bg-brand-light px-2.5 py-1 text-[11px] font-medium text-brand-mute">
          No request yet
        </span>
      );
  }
}

export function ReviewActivityTable({ rows }: { rows: ReviewActivityRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <Star className="h-6 w-6" />
        </div>
        <h2 className="font-display text-lg font-bold text-brand-ink">
          No completed stays yet
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
          Once a guest checks out, the review request is sent automatically and
          its progress shows up here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left">
          <thead>
            <tr className="border-b border-brand-line bg-brand-light/40 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-brand-mute">
              <th className="px-4 py-3">Guest &amp; stay</th>
              <th className="px-4 py-3">Review request</th>
              <th className="px-4 py-3">Review</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {rows.map((row) => (
              <tr key={row.bookingId} className="hover:bg-brand-light/30">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/bookings/${row.bookingId}?tab=review`}
                    className="text-[13.5px] font-semibold text-brand-ink hover:text-brand-primary"
                  >
                    {row.guestName}
                  </Link>
                  <div className="text-[11.5px] text-brand-mute">
                    {row.listingName}
                    {row.stayMonth ? ` · ${row.stayMonth}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <RequestCell row={row} />
                </td>
                <td className="px-4 py-3">
                  {row.rating != null ? (
                    <div className="flex items-center gap-2">
                      <StarRow rating={row.rating} />
                      <span className="num text-[12.5px] font-semibold text-brand-ink">
                        {row.rating.toFixed(1)}
                      </span>
                      {row.reviewedAt ? (
                        <span className="text-[11px] text-brand-mute">
                          · {ago(row.reviewedAt)}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-[12.5px] text-brand-mute">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
