"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";

// The "commission leak" calculator from the launch page. Drag the slider (or
// type) your monthly bookings revenue and it shows what each OTA skims vs Vilo's
// flat R0. Pure client maths — no data fetch. Benchmarks: Lekkeslaap 15% + VAT,
// Booking.com / Airbnb 15%. Annual leak is benchmarked on Lekkeslaap (the SA
// headline rate).
const MIN = 5_000;
const MAX = 200_000;
const LEKKE = 0.17; // 15% + VAT
const BOOKING = 0.15;
const AIRBNB = 0.15;

const clamp = (n: number) => Math.max(MIN, Math.min(MAX, n));
const groupZA = (n: number) =>
  Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const fmt = (n: number) => `R ${groupZA(n)}`;

export function CommissionCalculator() {
  const [raw, setRaw] = useState("65 000");

  const parsed = parseInt(raw.replace(/[^0-9]/g, ""), 10) || 0;
  const revenue = clamp(parsed);
  const pct = ((revenue - MIN) / (MAX - MIN)) * 100;

  const lekkeFee = revenue * LEKKE;
  const bookingFee = revenue * BOOKING;
  const airbnbFee = revenue * AIRBNB;
  const annual = lekkeFee * 12;

  return (
    <div className="rounded-card border border-brand-line bg-white p-6 shadow-card lg:col-span-7 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
            The commission leak calculator
          </div>
          <div className="mt-0.5 font-display text-lg font-semibold text-brand-dark">
            Drag the slider. See the leak.
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-accent px-2 py-1 text-[10px] font-semibold text-brand-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed" /> LIVE
        </span>
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between text-xs">
          <label htmlFor="calcInput" className="text-brand-mute">
            Your monthly bookings revenue
          </label>
          <div className="flex items-baseline gap-1 font-mono font-semibold text-brand-dark">
            <span className="text-brand-mute">R</span>
            <input
              id="calcInput"
              type="text"
              inputMode="numeric"
              value={raw}
              aria-label="Monthly revenue in rand"
              onChange={(e) => setRaw(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => setRaw(groupZA(revenue))}
              className="calc-input w-28 border-b border-brand-line bg-transparent text-right text-base outline-none focus:border-brand-primary focus:ring-0"
            />
          </div>
        </div>
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={1000}
          value={revenue}
          aria-label="Monthly revenue slider"
          onChange={(e) => setRaw(groupZA(Number(e.target.value)))}
          className="vilo-range block w-full"
          style={{ ["--val" as string]: `${pct}%` }}
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-brand-mute">
          <span>R 5k</span>
          <span>R 50k</span>
          <span>R 100k</span>
          <span>R 150k</span>
          <span>R 200k+</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-card border border-brand-line p-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-brand-mute">
            Lekkeslaap 17%
          </div>
          <div className="num-display mt-2 font-display text-xl font-bold text-status-cancelled">
            −{fmt(lekkeFee)}
          </div>
          <div className="mt-1 text-[10px] text-brand-mute">
            15% + VAT, every month
          </div>
        </div>
        <div className="rounded-card border border-brand-line p-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-brand-mute">
            Booking.com 15%
          </div>
          <div className="num-display mt-2 font-display text-xl font-bold text-status-cancelled">
            −{fmt(bookingFee)}
          </div>
          <div className="mt-1 text-[10px] text-brand-mute">
            skimmed off the top
          </div>
        </div>
        <div className="rounded-card border border-brand-line p-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-brand-mute">
            Airbnb 15%
          </div>
          <div className="num-display mt-2 font-display text-xl font-bold text-status-cancelled">
            −{fmt(airbnbFee)}
          </div>
          <div className="mt-1 text-[10px] text-brand-mute">
            host service fee
          </div>
        </div>
        <div className="relative rounded-card border-2 border-brand-primary bg-brand-accent/60 p-4">
          <span className="absolute right-2 top-2 rounded-pill bg-brand-primary px-1.5 py-0.5 text-[9px] font-bold text-white">
            VILO
          </span>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-primary">
            On Vilo
          </div>
          <div className="num-display mt-2 font-display text-xl font-bold text-brand-primary">
            R0
          </div>
          <div className="mt-1 text-[10px] font-medium text-brand-primary">
            commission. Flat fee only.
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-brand-line pt-5 sm:flex-row sm:items-center">
        <div className="text-sm text-brand-mute">
          That&apos;s{" "}
          <span className="num-display font-display text-base font-bold text-brand-dark">
            {fmt(annual)} / year
          </span>{" "}
          you stop handing over.
        </div>
        <a
          href="#scorecard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:text-brand-dark sm:ml-auto"
        >
          Want your exact number? Take the Scorecard
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
