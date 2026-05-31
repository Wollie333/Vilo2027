"use client";

import { Star, Users, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { applyStayDiscounts } from "./pricing";

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

function nightsBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  const f = new Date(from);
  const t = new Date(to);
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return 0;
  const ms = t.getTime() - f.getTime();
  const n = Math.round(ms / (1000 * 60 * 60 * 24));
  return n > 0 ? n : 0;
}

export function BookingWidget({
  slug,
  basePrice,
  cleaningFee,
  currency,
  maxGuests,
  instantBooking,
  rating,
  reviewCount,
  weeklyDiscountPct,
  monthlyDiscountPct,
}: {
  slug: string;
  basePrice: number | null;
  cleaningFee: number | null;
  currency: string;
  maxGuests: number | null;
  instantBooking: boolean;
  rating: number | null;
  reviewCount: number | null;
  weeklyDiscountPct: number | null;
  monthlyDiscountPct: number | null;
}) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);

  const nights = nightsBetween(checkIn, checkOut);
  const cap = maxGuests ?? 2;

  const calc = useMemo(() => {
    const subtotal = (basePrice ?? 0) * nights;
    const cleaning = nights > 0 ? (cleaningFee ?? 0) : 0;
    const d = applyStayDiscounts({
      base: subtotal,
      cleaning,
      nights,
      isWholeCombo: false,
      wholePct: null,
      weeklyPct: weeklyDiscountPct,
      monthlyPct: monthlyDiscountPct,
    });
    return { subtotal, cleaning, total: d.total, discount: d };
  }, [basePrice, cleaningFee, nights, weeklyDiscountPct, monthlyDiscountPct]);

  const canReserve =
    nights > 0 && guests >= 1 && guests <= cap && basePrice != null;

  const reserveHref = `/listing/${encodeURIComponent(
    slug,
  )}/book?from=${checkIn}&to=${checkOut}&guests=${guests}`;

  return (
    <div className="sticky top-20 rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          {basePrice != null ? (
            <>
              <span className="font-display text-2xl font-bold text-brand-ink">
                {fmtR(basePrice, currency)}
              </span>
              <span className="ml-1 text-sm text-brand-mute">/ night</span>
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

      {instantBooking ? (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-brand-secondary px-2 py-0.5 text-[10px] font-bold text-white">
          <Zap className="h-3 w-3" /> Instant book
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-card border border-brand-line">
        <label className="flex cursor-pointer flex-col gap-1 border-r border-brand-line px-3 py-2.5 hover:bg-brand-light/60">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Check in
          </span>
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="bg-transparent text-sm font-medium text-brand-dark outline-none"
          />
        </label>
        <label className="flex cursor-pointer flex-col gap-1 px-3 py-2.5 hover:bg-brand-light/60">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Check out
          </span>
          <input
            type="date"
            value={checkOut}
            min={checkIn || undefined}
            onChange={(e) => setCheckOut(e.target.value)}
            className="bg-transparent text-sm font-medium text-brand-dark outline-none"
          />
        </label>
        <label className="col-span-2 flex cursor-pointer items-center gap-2 border-t border-brand-line px-3 py-2.5 hover:bg-brand-light/60">
          <Users className="h-4 w-4 text-brand-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Guests
          </span>
          <select
            value={guests}
            onChange={(e) => setGuests(parseInt(e.target.value, 10))}
            className="ml-auto bg-transparent text-sm font-medium text-brand-dark outline-none"
          >
            {Array.from({ length: cap }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "guest" : "guests"}
              </option>
            ))}
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
        {nights > 0
          ? `Reserve · ${fmtR(calc.total, currency)}`
          : "Pick your dates"}
      </a>

      <div className="mt-2 text-center text-[10px] text-brand-mute">
        You won&rsquo;t be charged yet.
      </div>

      {nights > 0 && basePrice != null ? (
        <dl className="mt-4 space-y-2 border-t border-brand-line pt-4 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-brand-mute">
              {fmtR(basePrice, currency)} × {nights}{" "}
              {nights === 1 ? "night" : "nights"}
            </dt>
            <dd className="font-medium text-brand-dark">
              {fmtR(calc.subtotal, currency)}
            </dd>
          </div>
          {calc.discount.losSaving > 0 ? (
            <div className="flex items-center justify-between text-brand-primary">
              <dt>
                {calc.discount.losKind === "monthly" ? "Monthly" : "Weekly"}{" "}
                discount · {calc.discount.losPct}%
              </dt>
              <dd className="font-medium">
                − {fmtR(calc.discount.losSaving, currency)}
              </dd>
            </div>
          ) : null}
          {calc.cleaning > 0 ? (
            <div className="flex items-center justify-between">
              <dt className="text-brand-mute">Cleaning fee</dt>
              <dd className="font-medium text-brand-dark">
                {fmtR(calc.cleaning, currency)}
              </dd>
            </div>
          ) : null}
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
