"use client";

import { ArrowRight, ShieldCheck, Star, Users, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { formatMoney } from "@/lib/format";
import { priceStay, type SeasonalRule } from "@/lib/pricing";

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
  weekendPrice,
  cleaningFee,
  currency,
  maxGuests,
  minNights,
  instantBooking,
  rating,
  reviewCount,
  seasonalRules,
  weeklyDiscountPct,
  monthlyDiscountPct,
}: {
  slug: string;
  basePrice: number | null;
  weekendPrice: number | null;
  cleaningFee: number | null;
  currency: string;
  maxGuests: number | null;
  minNights: number | null;
  instantBooking: boolean;
  rating: number | null;
  reviewCount: number | null;
  seasonalRules: SeasonalRule[];
  weeklyDiscountPct: number | null;
  monthlyDiscountPct: number | null;
}) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);

  const nights = nightsBetween(checkIn, checkOut);
  const cap = maxGuests ?? 2;

  // Same engine the checkout + server use, so this whole-listing teaser matches.
  const calc = useMemo(() => {
    if (nights <= 0 || basePrice == null) {
      return {
        subtotal: 0,
        cleaning: 0,
        total: 0,
        discount: {
          losSaving: 0,
          losKind: null as null | "weekly" | "monthly",
          losPct: 0,
        },
      };
    }
    const b = priceStay({
      checkIn,
      checkOut,
      units: [
        {
          roomId: null,
          pricing_mode: "per_room",
          base_price: basePrice,
          price_per_person: null,
          base_occupancy: null,
          extra_guest_price: null,
          weekend_price: weekendPrice,
          cleaning_fee: cleaningFee ?? 0,
          guests,
        },
      ],
      seasonalRules,
      currency,
      totalGuests: guests,
      listingMinNights: minNights ?? 1,
      isWholeCombo: false,
      wholePct: null,
      weeklyPct: weeklyDiscountPct,
      monthlyPct: monthlyDiscountPct,
    });
    return {
      subtotal: b.baseSubtotal,
      cleaning: b.cleaningTotal,
      total: b.total,
      discount: b.discount,
    };
  }, [
    checkIn,
    checkOut,
    basePrice,
    weekendPrice,
    cleaningFee,
    guests,
    seasonalRules,
    currency,
    minNights,
    nights,
    weeklyDiscountPct,
    monthlyDiscountPct,
  ]);

  const canReserve =
    nights > 0 && guests >= 1 && guests <= cap && basePrice != null;

  const reserveHref = `/listing/${encodeURIComponent(
    slug,
  )}/book?from=${checkIn}&to=${checkOut}&guests=${guests}`;

  return (
    <div
      className="book-dark sticky top-20 isolate overflow-hidden rounded-card p-5 text-white"
      style={{
        background:
          "linear-gradient(155deg,#11201A 0%,#0A1410 55%,#060F0B 100%)",
        boxShadow:
          "0 34px 74px -30px rgba(6,40,30,0.72),0 10px 28px -16px rgba(0,0,0,0.34)",
      }}
    >
      <div
        aria-hidden
        className="dotgrid pointer-events-none absolute inset-0 -z-10 opacity-[0.13]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 -z-10 h-56 w-56 rounded-full bg-brand-primary/25 blur-3xl"
      />

      <div className="flex items-baseline justify-between gap-2">
        <div>
          {basePrice != null ? (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                From{" "}
              </span>
              <span className="num font-display text-3xl font-bold tracking-tight text-brand-ink">
                {formatMoney(basePrice, currency)}
              </span>
              <span className="ml-1 text-sm text-brand-mute">/ night</span>
            </>
          ) : (
            <span className="text-sm text-brand-mute">Price on request</span>
          )}
        </div>
        {rating != null && reviewCount != null && reviewCount > 0 ? (
          <div className="flex items-center gap-1 text-sm text-brand-ink">
            <Star className="h-4 w-4 fill-brand-ink stroke-brand-ink" />
            <span className="num font-semibold">{rating.toFixed(2)}</span>
            <span className="text-brand-mute">·</span>
            <span className="num text-brand-mute">{reviewCount}</span>
          </div>
        ) : null}
      </div>

      {instantBooking ? (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-brand-accent px-2 py-0.5 text-[10px] font-bold">
          <Zap className="h-3 w-3" /> Instant book
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-card border border-brand-line">
        <label className="flex cursor-pointer flex-col gap-1 border-r border-brand-line px-3 py-2.5 hover:bg-brand-light">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Check in
          </span>
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="bg-transparent text-sm font-medium text-white outline-none [color-scheme:dark]"
          />
        </label>
        <label className="flex cursor-pointer flex-col gap-1 px-3 py-2.5 hover:bg-brand-light">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Check out
          </span>
          <input
            type="date"
            value={checkOut}
            min={checkIn || undefined}
            onChange={(e) => setCheckOut(e.target.value)}
            className="bg-transparent text-sm font-medium text-white outline-none [color-scheme:dark]"
          />
        </label>
        <label className="col-span-2 flex cursor-pointer items-center gap-2 border-t border-brand-line px-3 py-2.5 hover:bg-brand-light">
          <Users className="h-4 w-4 text-brand-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            Guests
          </span>
          <select
            value={guests}
            onChange={(e) => setGuests(parseInt(e.target.value, 10))}
            className="ml-auto bg-transparent text-sm font-medium text-white outline-none [color-scheme:dark]"
          >
            {Array.from({ length: cap }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n} className="text-brand-ink">
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
        className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded px-5 py-3.5 text-sm font-semibold transition-colors ${
          canReserve
            ? "bg-brand-primary text-white shadow-glow hover:bg-brand-secondary"
            : "cursor-not-allowed border border-white/15 bg-white/[0.06] text-white/50"
        }`}
      >
        {nights > 0
          ? `Reserve · ${formatMoney(calc.total, currency)}`
          : "Pick your dates"}
        {canReserve ? <ArrowRight className="h-4 w-4" /> : null}
      </a>

      <div className="mt-2 text-center text-[11px] text-brand-mute">
        You won&rsquo;t be charged yet.
      </div>

      {nights > 0 && basePrice != null ? (
        <dl className="mt-4 space-y-2 border-t border-brand-line pt-4 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-brand-mute">
              {nights} {nights === 1 ? "night" : "nights"}
            </dt>
            <dd className="num font-medium text-brand-ink">
              {formatMoney(calc.subtotal, currency)}
            </dd>
          </div>
          {calc.discount.losSaving > 0 ? (
            <div className="flex items-center justify-between text-brand-primary">
              <dt>
                {calc.discount.losKind === "monthly" ? "Monthly" : "Weekly"}{" "}
                discount · {calc.discount.losPct}%
              </dt>
              <dd className="num font-medium">
                − {formatMoney(calc.discount.losSaving, currency)}
              </dd>
            </div>
          ) : null}
          {calc.cleaning > 0 ? (
            <div className="flex items-center justify-between">
              <dt className="text-brand-mute">Cleaning fee</dt>
              <dd className="num font-medium text-brand-ink">
                {formatMoney(calc.cleaning, currency)}
              </dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-brand-line pt-2">
            <dt className="font-display font-semibold text-brand-ink">Total</dt>
            <dd className="num font-display font-bold text-brand-ink">
              {formatMoney(calc.total, currency)}
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-5 flex items-start gap-2.5 rounded border border-brand-line bg-brand-light p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
        <div className="text-[11px] leading-relaxed text-brand-mute">
          Held securely until your trip is confirmed. Cancellation terms apply —
          see the host&rsquo;s policy.
        </div>
      </div>
    </div>
  );
}
