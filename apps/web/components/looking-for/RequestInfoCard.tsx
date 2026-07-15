import { Banknote, Calendar, MapPin, Search, Users, Zap } from "lucide-react";
import type { ReactNode } from "react";

import { formatMoney } from "@/lib/format";

// Compact, horizontal "what the guest is looking for" card — image left, title +
// key facts middle, condensed requirement chips below. One shared component so
// the host respond page, the guest CRM record, and the public search cards all
// show the request identically. Presentational (no client hooks / server-only
// imports) so it drops into server OR client trees.

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

function flexLabel(days: number): string {
  if (days === 7) return "± 1 week";
  if (days === 14) return "± 2 weeks";
  return `± ${days} day${days === 1 ? "" : "s"}`;
}

export type RequestInfoCardProps = {
  title: string;
  category: string;
  imageUrl?: string | null;
  eyebrow?: string | null;
  locationText?: string | null;
  locationRegion?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  flexDays?: number | null;
  adults?: number | null;
  childrenCount?: number | null;
  infants?: number | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  budgetPer?: string | null;
  budgetCurrency?: string | null;
  isUrgent?: boolean;
  /** Condensed requirement chips (e.g. <RequestRequirements variant="compact">). */
  requirements?: ReactNode;
  className?: string;
};

export function RequestInfoCard({
  title,
  category,
  imageUrl,
  eyebrow,
  locationText,
  locationRegion,
  checkIn,
  checkOut,
  flexDays,
  adults,
  childrenCount,
  infants,
  budgetMin,
  budgetMax,
  budgetPer,
  budgetCurrency,
  isUrgent,
  requirements,
  className,
}: RequestInfoCardProps) {
  const guests = (adults ?? 0) + (childrenCount ?? 0) + (infants ?? 0);
  const cur = budgetCurrency ?? "ZAR";
  const budget =
    budgetMin || budgetMax
      ? budgetMin && budgetMax
        ? `${formatMoney(budgetMin, cur)} – ${formatMoney(budgetMax, cur)}`
        : budgetMax
          ? `Up to ${formatMoney(budgetMax, cur)}`
          : `From ${formatMoney(budgetMin, cur)}`
      : null;

  const dates =
    checkIn && checkOut
      ? `${fmtDate(checkIn)} – ${fmtDate(checkOut)}`
      : checkIn
        ? `From ${fmtDate(checkIn)}`
        : "Flexible dates";

  return (
    <div
      className={`overflow-hidden rounded-card border border-brand-line bg-white ${className ?? ""}`}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Image */}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={title}
            className="h-36 w-full shrink-0 object-cover sm:h-auto sm:w-44"
          />
        ) : (
          <div className="flex h-36 w-full shrink-0 items-center justify-center bg-brand-accent text-brand-primary sm:h-auto sm:w-44">
            <Search className="h-8 w-8" />
          </div>
        )}

        {/* Details */}
        <div className="min-w-0 flex-1 p-4">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
              {eyebrow}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <h2 className="truncate font-display text-base font-bold text-brand-ink">
              {title}
            </h2>
            <span className="shrink-0 rounded-pill bg-brand-light px-2 py-0.5 text-[11px] font-medium capitalize text-brand-mute">
              {category}
            </span>
            {isUrgent ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                <Zap className="h-3 w-3" />
                Urgent
              </span>
            ) : null}
          </div>

          {/* Fact row */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-brand-mute">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {locationText ?? locationRegion ?? "Flexible"}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {dates}
              {checkIn && (flexDays ?? 0) > 0 ? (
                <span className="text-brand-primary">
                  · {flexLabel(flexDays as number)}
                </span>
              ) : null}
            </span>
            {guests > 0 ? (
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 shrink-0" />
                {guests} guest{guests !== 1 ? "s" : ""}
              </span>
            ) : null}
            {budget ? (
              <span className="flex items-center gap-1.5">
                <Banknote className="h-3.5 w-3.5 shrink-0" />
                {budget}
                {budgetPer ? (
                  <span className="text-brand-mute/70">/{budgetPer}</span>
                ) : null}
              </span>
            ) : null}
          </div>

          {/* Requirement chips */}
          {requirements ? <div className="mt-3">{requirements}</div> : null}
        </div>
      </div>
    </div>
  );
}
