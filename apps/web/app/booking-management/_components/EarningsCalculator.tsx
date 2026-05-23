"use client";

import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";

const VILO_FEE = 499;
const AIRBNB = 0.18;
const BOOKING = 0.22;
const MIN = 5000;
const MAX = 200000;
const STEP = 1000;
const INITIAL = 65000;

function fmtR(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}R ${Math.round(Math.abs(n))
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

function fmtInputValue(n: number) {
  return Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
}

function parseRevenue(str: string) {
  const n = parseInt(str.replace(/[^0-9]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
}

function clamp(n: number) {
  return Math.max(MIN, Math.min(MAX, n));
}

export function EarningsCalculator() {
  const [revenue, setRevenue] = useState<number>(INITIAL);
  const [inputDraft, setInputDraft] = useState<string>(fmtInputValue(INITIAL));

  const calc = useMemo(() => {
    const rev = clamp(revenue);
    const aFee = rev * AIRBNB;
    const bFee = rev * BOOKING;
    const aNet = rev - aFee;
    const bNet = rev - bFee;
    const vNet = rev - VILO_FEE;
    const delta = vNet - aNet;
    const annual = delta * 12;
    const pct = ((rev - MIN) / (MAX - MIN)) * 100;
    return { rev, aFee, bFee, aNet, bNet, vNet, delta, annual, pct };
  }, [revenue]);

  function handleSliderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = clamp(parseInt(e.target.value, 10));
    setRevenue(v);
    setInputDraft(fmtInputValue(v));
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setInputDraft(raw);
    const parsed = parseRevenue(raw);
    if (parsed >= MIN && parsed <= MAX) {
      setRevenue(parsed);
    }
  }

  function handleInputBlur() {
    const v = clamp(parseRevenue(inputDraft));
    setRevenue(v);
    setInputDraft(fmtInputValue(v));
  }

  return (
    <div className="rounded-card border border-brand-line bg-white p-6 shadow-card lg:col-span-7 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-brand-mute">
            Earnings calculator
          </div>
          <div className="mt-0.5 font-display text-lg font-semibold text-brand-dark">
            What you&rsquo;d keep on Vilo
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-accent px-2 py-1 text-[10px] font-semibold text-brand-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed" />
          LIVE
        </span>
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between text-xs">
          <label htmlFor="bm-calc-input" className="text-brand-mute">
            Your monthly bookings revenue
          </label>
          <div className="flex items-baseline gap-1 font-mono font-semibold text-brand-dark">
            <span className="text-brand-mute">R</span>
            <input
              id="bm-calc-input"
              type="text"
              inputMode="numeric"
              value={inputDraft}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onFocus={(e) => e.target.select()}
              aria-label="Monthly revenue in rand"
              className="calc-input w-28 border-b border-brand-line bg-transparent text-right text-base outline-none focus:border-brand-primary focus:ring-0"
            />
          </div>
        </div>

        <input
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={revenue}
          onChange={handleSliderChange}
          aria-label="Monthly revenue slider"
          className="vilo-range block w-full"
          style={{ "--val": `${calc.pct}%` } as React.CSSProperties}
        />

        <div className="mt-1 flex justify-between font-mono text-[10px] text-brand-mute">
          <span>R 5k</span>
          <span>R 50k</span>
          <span>R 100k</span>
          <span>R 150k</span>
          <span>R 200k+</span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-card border border-brand-line p-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-brand-mute">
            Airbnb 18%
          </div>
          <div className="num-display mt-2 font-display text-2xl font-bold text-brand-mute line-through">
            {fmtR(calc.aNet)}
          </div>
          <div className="mt-1 text-[10px] text-brand-mute">
            −{fmtR(calc.aFee)} in fees
          </div>
        </div>

        <div className="rounded-card border border-brand-line p-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-brand-mute">
            Booking.com 22%
          </div>
          <div className="num-display mt-2 font-display text-2xl font-bold text-brand-mute line-through">
            {fmtR(calc.bNet)}
          </div>
          <div className="mt-1 text-[10px] text-brand-mute">
            −{fmtR(calc.bFee)} in fees
          </div>
        </div>

        <div className="relative rounded-card border-2 border-brand-primary bg-brand-accent/60 p-4">
          <span className="absolute right-2 top-2 rounded-pill bg-brand-primary px-1.5 py-0.5 text-[9px] font-bold text-white">
            VILO
          </span>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-primary">
            Flat R 499/mo
          </div>
          <div className="num-display mt-2 font-display text-2xl font-bold text-brand-primary">
            {fmtR(calc.vNet)}
          </div>
          <div className="mt-1 text-[10px] font-medium text-brand-primary">
            +{fmtR(calc.delta)} in your pocket
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-brand-line pt-5 sm:flex-row sm:items-center">
        <div className="text-sm text-brand-mute">
          That&rsquo;s{" "}
          <span className="num-display font-display text-base font-bold text-brand-dark">
            {fmtR(calc.annual)} / year
          </span>{" "}
          you stop handing over.
        </div>
        <a
          href="#pricing"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:text-brand-dark sm:ml-auto"
        >
          See pricing <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
