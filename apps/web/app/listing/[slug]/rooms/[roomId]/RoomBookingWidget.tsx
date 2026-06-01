"use client";

import { Minus, Plus, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { priceStay, type SeasonalRule } from "@/lib/pricing";

import {
  roomFromNightly,
  roomNightlyBase,
  type RoomPricingMode,
} from "../../roomDisplay";

type Props = {
  roomId: string;
  listingSlug: string;
  currency: string;
  bookingMode: string;
  instantBook: boolean;
  pricing: {
    pricing_mode: RoomPricingMode;
    base_price: number;
    price_per_person: number | null;
    base_occupancy: number | null;
    extra_guest_price: number | null;
  };
  weekendPrice: number | null;
  cleaningFee: number;
  maxGuests: number;
  minNights: number | null;
  seasonalRules: SeasonalRule[];
  weeklyDiscountPct: number | null;
  monthlyDiscountPct: number | null;
};

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

function nightsBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  const f = new Date(`${from}T00:00:00Z`).getTime();
  const t = new Date(`${to}T00:00:00Z`).getTime();
  if (!Number.isFinite(f) || !Number.isFinite(t)) return 0;
  const n = Math.round((t - f) / (1000 * 60 * 60 * 24));
  return n > 0 ? n : 0;
}

export function RoomBookingWidget({
  roomId,
  listingSlug,
  currency,
  bookingMode,
  instantBook,
  pricing,
  weekendPrice,
  cleaningFee,
  maxGuests,
  minNights,
  seasonalRules,
  weeklyDiscountPct,
  monthlyDiscountPct,
}: Props) {
  const cap = Math.max(1, maxGuests);
  const today = new Date().toISOString().slice(0, 10);

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(Math.min(2, cap));

  const nights = nightsBetween(checkIn, checkOut);

  // Per-night base for the chosen guest count — SAME math as roomDisplay so the
  // estimate matches what the server recomputes in the book flow.
  const nightlyBase = useMemo(
    () => roomNightlyBase(pricing, guests),
    [pricing, guests],
  );
  const fromNightly = useMemo(() => roomFromNightly(pricing), [pricing]);

  // Headline (one-guest baseline) — never NaN.
  const headlineAmount = fmtR(fromNightly, currency);
  const headlineSuffix =
    pricing.pricing_mode === "per_person" ? "/ person / night" : "/ night";

  // Stay total via the canonical engine (seasonal + weekend + length-of-stay
  // discounts) so it matches checkout. With no dates yet, fall back to the
  // single-night base so we never surface NaN/zero.
  const breakdown =
    nights > 0
      ? priceStay({
          checkIn,
          checkOut,
          units: [
            {
              roomId,
              pricing_mode: pricing.pricing_mode,
              base_price: pricing.base_price,
              price_per_person: pricing.price_per_person,
              base_occupancy: pricing.base_occupancy,
              extra_guest_price: pricing.extra_guest_price,
              weekend_price: weekendPrice,
              cleaning_fee: cleaningFee,
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
        })
      : null;
  const accommodation = breakdown ? breakdown.baseSubtotal : nightlyBase;
  const total = breakdown ? breakdown.total : nightlyBase;

  // Breakdown line for the accommodation row.
  const perNightLabel =
    pricing.pricing_mode === "per_person"
      ? `${fmtR(pricing.price_per_person ?? 0, currency)} × ${guests} guest${
          guests === 1 ? "" : "s"
        }`
      : fmtR(nightlyBase, currency);
  const labelNights = nights > 0 ? nights : 1;
  const accommodationLabel = `${perNightLabel} × ${labelNights} night${
    labelNights === 1 ? "" : "s"
  }`;

  const isWhole = bookingMode === "whole_listing";

  const bookHref = useMemo(() => {
    if (isWhole) return `/listing/${listingSlug}`;
    const qs = new URLSearchParams();
    qs.set("room_ids", roomId);
    qs.set("room_guests", `${roomId}:${guests}`);
    qs.set("guests", String(guests));
    if (checkIn) qs.set("from", checkIn);
    if (checkOut) qs.set("to", checkOut);
    return `/listing/${listingSlug}/book?${qs.toString()}`;
  }, [isWhole, listingSlug, roomId, guests, checkIn, checkOut]);

  const reserveLabel = isWhole
    ? "See the full listing"
    : `Reserve · ${fmtR(total, currency)}`;

  return (
    <>
      {/* Desktop / tablet sticky card */}
      <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <span className="num font-display text-2xl font-bold tabular-nums text-brand-ink">
              {headlineAmount}
            </span>{" "}
            <span className="text-sm text-brand-mute">{headlineSuffix}</span>
          </div>
          {instantBook ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-brand-accent px-2.5 py-1 text-[11px] font-semibold text-brand-primary">
              <Zap className="h-3.5 w-3.5" /> Instant book
            </span>
          ) : null}
        </div>

        <div className="mt-1 text-xs text-brand-mute">
          Sleeps up to {cap}
          {cleaningFee > 0
            ? ` · ${fmtR(cleaningFee, currency)} cleaning fee`
            : ""}
        </div>

        {!isWhole ? (
          <>
            {/* Date inputs */}
            <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-card border border-brand-line">
              <label className="flex flex-col gap-1 border-r border-brand-line px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-mute">
                  Check-in
                </span>
                <input
                  type="date"
                  min={today}
                  value={checkIn}
                  onChange={(e) => {
                    setCheckIn(e.target.value);
                    if (checkOut && e.target.value >= checkOut) setCheckOut("");
                  }}
                  className="bg-transparent text-sm text-brand-ink outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-mute">
                  Check-out
                </span>
                <input
                  type="date"
                  min={checkIn || today}
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="bg-transparent text-sm text-brand-ink outline-none"
                />
              </label>
            </div>

            {/* Guests stepper */}
            <div className="mt-3 flex items-center justify-between rounded-card border border-brand-line px-3 py-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-mute">
                  Guests
                </span>
                <span className="num text-sm tabular-nums text-brand-ink">
                  {guests} of {cap}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGuests((g) => Math.max(1, g - 1))}
                  disabled={guests <= 1}
                  aria-label="Decrease guests"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-line text-brand-ink transition-colors hover:border-brand-primary hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setGuests((g) => Math.min(cap, g + 1))}
                  disabled={guests >= cap}
                  aria-label="Increase guests"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-line text-brand-ink transition-colors hover:border-brand-primary hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Live breakdown */}
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between text-brand-dark">
                <dt className="text-brand-mute">{accommodationLabel}</dt>
                <dd className="num tabular-nums">
                  {fmtR(accommodation, currency)}
                </dd>
              </div>
              {cleaningFee > 0 ? (
                <div className="flex items-center justify-between text-brand-dark">
                  <dt className="text-brand-mute">Cleaning fee</dt>
                  <dd className="num tabular-nums">
                    {nights > 0 ? fmtR(cleaningFee, currency) : "—"}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between text-brand-dark">
                <dt className="text-brand-mute">Vilo service fee</dt>
                <dd className="font-semibold text-brand-primary">FREE</dd>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-brand-line pt-3 font-display text-base font-bold text-brand-ink">
                <dt>Total</dt>
                <dd className="num tabular-nums">{fmtR(total, currency)}</dd>
              </div>
              <div className="text-right text-[11px] text-brand-mute">
                {nights > 0
                  ? `${nights} night${nights === 1 ? "" : "s"}`
                  : "Add dates for an exact total"}
              </div>
            </dl>
          </>
        ) : null}

        <Link
          href={bookHref}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-pill bg-brand-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
        >
          {reserveLabel}
        </Link>

        {!isWhole ? (
          <>
            <p className="mt-2 text-center text-[11px] text-brand-mute">
              You won&rsquo;t be charged yet.
            </p>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-brand-mute">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-primary" />
              Full refund up to 5 days before check-in. Vilo holds payment until
              your trip is confirmed.
            </p>
          </>
        ) : null}
      </div>

      {/* Mobile sticky bottom bar */}
      {!isWhole ? (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-brand-line bg-white px-5 py-3 shadow-lift lg:hidden">
          <div className="min-w-0">
            <div className="num truncate font-display text-base font-bold tabular-nums text-brand-ink">
              {fmtR(total, currency)}
            </div>
            <div className="truncate text-[11px] text-brand-mute">
              {nights > 0
                ? `${nights} night${nights === 1 ? "" : "s"} · ${guests} guest${
                    guests === 1 ? "" : "s"
                  }`
                : "Estimate · add dates"}
            </div>
          </div>
          <Link
            href={bookHref}
            className="inline-flex shrink-0 items-center justify-center rounded-pill bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
          >
            Reserve
          </Link>
        </div>
      ) : null}
    </>
  );
}
