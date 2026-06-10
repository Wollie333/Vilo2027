"use client";

import { Flag, Hourglass } from "lucide-react";

import { useBrandName } from "@/components/brand/BrandProvider";
import { ReviewPhotoGrid } from "@/components/reviews/ReviewPhotoGrid";

import { ReplyComposer } from "./ReplyComposer";
import { StarRow } from "./StarRow";

// Avatar colour palette mirrors the design HTML (av-1 … av-7). Hash the
// guest's name into one of them so the colour is stable per guest.
const AVATAR_STYLES = [
  "bg-brand-secondary text-white",
  "bg-brand-accent text-brand-secondary",
  "bg-brand-dark text-white",
  "bg-brand-mute text-white",
  "bg-amber-100 text-amber-900",
  "bg-indigo-100 text-indigo-900",
  "bg-pink-100 text-pink-900",
] as const;

function avatarStyle(seed: string): string {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_STYLES[Math.abs(n) % AVATAR_STYLES.length];
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "G"
  );
}

function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} months ago`;
  const years = Math.round(days / 365);
  return `${years}y ago`;
}

export type ReviewCardProps = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  hostResponse: string | null;
  hostRespondedAt: string | null;
  flagged: boolean;
  guestName: string;
  listingName: string;
  nights: number | null;
  stayMonth: string | null; // pre-formatted "Sept 2025"
  photos: string[];
};

export function ReviewCard(props: ReviewCardProps) {
  const brandName = useBrandName();
  const hasReply = props.hostResponse != null && props.hostResponse.length > 0;
  const av = avatarStyle(props.guestName);

  return (
    <article className="rounded-card border border-brand-line bg-white p-6 shadow-card">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-[13px] font-bold ${av}`}
          aria-hidden
        >
          {initials(props.guestName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-display text-[15px] font-semibold text-brand-ink">
                {props.guestName}
              </div>
              <div className="mt-0.5 text-[12px] text-brand-mute">
                Stayed at {props.listingName}
                {props.nights
                  ? ` · ${props.nights} ${props.nights === 1 ? "night" : "nights"}`
                  : ""}
                {props.stayMonth ? ` · ${props.stayMonth}` : ""}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <StarRow rating={props.rating} />
              <div className="mt-0.5 text-[11px] text-brand-mute">
                {relativeAge(props.createdAt)} · via {brandName} direct
              </div>
            </div>
          </div>

          {props.body ? (
            <p className="mt-3 text-[14.5px] leading-relaxed text-brand-ink">
              {props.body}
            </p>
          ) : (
            <p className="mt-3 text-[14px] italic leading-relaxed text-brand-mute">
              Rating only — no written review.
            </p>
          )}

          {props.photos.length > 0 ? (
            <div className="mt-3">
              <ReviewPhotoGrid urls={props.photos} size="sm" />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {props.flagged ? (
              <span className="inline-flex items-center gap-1 rounded-pill border border-status-cancelled/30 bg-status-cancelled/10 px-2 py-0.5 text-[11px] font-medium text-status-cancelled">
                <Flag className="h-3 w-3" />
                Flagged
              </span>
            ) : null}
            {!hasReply ? (
              <span className="inline-flex items-center gap-1 rounded-pill border border-status-pending/30 bg-status-pending/10 px-2 py-0.5 text-[11px] font-medium text-status-pending">
                <Hourglass className="h-3 w-3" />
                Awaiting your reply
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-pill border border-brand-line bg-brand-light/60 px-2 py-0.5 text-[11px] font-medium text-brand-mute">
                Replied{" "}
                {props.hostRespondedAt
                  ? relativeAge(props.hostRespondedAt)
                  : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      <ReplyComposer
        reviewId={props.id}
        guestName={props.guestName}
        initialBody={props.hostResponse ?? ""}
        hasReply={hasReply}
      />
    </article>
  );
}
