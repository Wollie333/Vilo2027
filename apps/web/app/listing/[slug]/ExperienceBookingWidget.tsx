"use client";

import { Clock, Star, Users, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { formatSlotLabel, type UpcomingSlot } from "./scheduleSlots";

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

function formatDuration(minutes: number | null): string | null {
  if (minutes == null || minutes <= 0) return null;
  const m = Math.trunc(minutes);
  if (m < 60) return `${m} min`;
  const hours = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours}h ${rem}min`;
}

export function ExperienceBookingWidget({
  slug,
  basePrice,
  privateGroupPrice,
  currency,
  durationMinutes,
  maxParticipants,
  minParticipants,
  instantBooking,
  rating,
  reviewCount,
  slots,
}: {
  slug: string;
  basePrice: number | null;
  privateGroupPrice: number | null;
  currency: string;
  durationMinutes: number | null;
  maxParticipants: number | null;
  minParticipants: number | null;
  instantBooking: boolean;
  rating: number | null;
  reviewCount: number | null;
  slots: UpcomingSlot[];
}) {
  const cap = maxParticipants ?? 8;
  const min = Math.max(1, minParticipants ?? 1);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [participants, setParticipants] = useState(min);

  const calc = useMemo(() => {
    const perPerson = basePrice ?? 0;
    const total = perPerson * participants;
    // If the host set a private-group price and the guest fills the session,
    // offer the lower of (per-person * cap) vs private-group price.
    if (
      privateGroupPrice != null &&
      privateGroupPrice > 0 &&
      participants === cap &&
      privateGroupPrice < total
    ) {
      return { total: privateGroupPrice, isPrivateRate: true };
    }
    return { total, isPrivateRate: false };
  }, [basePrice, participants, privateGroupPrice, cap]);

  const canReserve =
    selectedSlot.length > 0 && participants >= min && basePrice != null;

  const reserveHref = `/listing/${encodeURIComponent(
    slug,
  )}/book?slot=${encodeURIComponent(selectedSlot)}&participants=${participants}`;

  const duration = formatDuration(durationMinutes);

  return (
    <div className="sticky top-20 rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          {basePrice != null ? (
            <>
              <span className="font-display text-2xl font-bold text-brand-ink">
                {fmtR(basePrice, currency)}
              </span>
              <span className="ml-1 text-sm text-brand-mute">per person</span>
            </>
          ) : (
            <span className="text-sm text-brand-mute">Price on request</span>
          )}
        </div>
        {rating != null && reviewCount != null && reviewCount > 0 ? (
          <div className="flex items-center gap-1 text-xs">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-brand-ink">
              {rating.toFixed(1)}
            </span>
            <span className="text-brand-mute">({reviewCount})</span>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {instantBooking ? (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-secondary px-2 py-0.5 text-[10px] font-bold text-white">
            <Zap className="h-3 w-3" /> Instant book
          </span>
        ) : null}
        {duration ? (
          <span className="inline-flex items-center gap-1 text-xs text-brand-mute">
            <Clock className="h-3.5 w-3.5 text-brand-primary" />
            {duration}
          </span>
        ) : null}
      </div>

      <div className="mt-5">
        <label className="block">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Pick a session
          </span>
          {slots.length === 0 ? (
            <p className="mt-2 rounded border border-dashed border-brand-line bg-brand-light/40 px-3 py-2 text-xs text-brand-mute">
              No upcoming sessions scheduled. Message the host to ask about new
              dates.
            </p>
          ) : (
            <select
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
              className="mt-1.5 w-full rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-dark outline-none focus:border-brand-primary"
            >
              <option value="">Choose a date and time…</option>
              {slots.map((s) => (
                <option key={s.iso} value={s.iso}>
                  {formatSlotLabel(s)}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="mt-3 flex items-center gap-2 rounded border border-brand-line bg-white px-3 py-2.5">
          <Users className="h-4 w-4 text-brand-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Participants
          </span>
          <select
            value={participants}
            onChange={(e) => setParticipants(parseInt(e.target.value, 10))}
            className="ml-auto bg-transparent text-sm font-medium text-brand-dark outline-none"
          >
            {Array.from({ length: cap - min + 1 }, (_, i) => i + min).map(
              (n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "person" : "people"}
                </option>
              ),
            )}
          </select>
        </label>
      </div>

      <a
        href={canReserve ? reserveHref : undefined}
        aria-disabled={!canReserve}
        onClick={(e) => {
          if (!canReserve) e.preventDefault();
        }}
        className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded px-4 py-3 text-sm font-medium transition-colors ${
          canReserve
            ? "bg-brand-primary text-white hover:bg-brand-secondary"
            : "cursor-not-allowed bg-brand-line text-brand-mute"
        }`}
      >
        {selectedSlot.length === 0
          ? "Pick a session"
          : `Reserve · ${fmtR(calc.total, currency)}`}
      </a>

      <div className="mt-2 text-center text-[10px] text-brand-mute">
        You won&rsquo;t be charged yet.
      </div>

      {selectedSlot.length > 0 && basePrice != null ? (
        <dl className="mt-4 space-y-2 border-t border-brand-line pt-4 text-sm">
          {calc.isPrivateRate ? (
            <div className="flex items-center justify-between">
              <dt className="text-brand-mute">
                Private group rate ({participants}{" "}
                {participants === 1 ? "person" : "people"})
              </dt>
              <dd className="font-medium text-brand-dark">
                {fmtR(calc.total, currency)}
              </dd>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <dt className="text-brand-mute">
                {fmtR(basePrice, currency)} × {participants}{" "}
                {participants === 1 ? "person" : "people"}
              </dt>
              <dd className="font-medium text-brand-dark">
                {fmtR(calc.total, currency)}
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-brand-line pt-2">
            <dt className="font-display font-semibold text-brand-ink">Total</dt>
            <dd className="font-display font-bold text-brand-ink">
              {fmtR(calc.total, currency)}
            </dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
