"use client";

import { TrendingDown, CheckCircle2, ArrowRight } from "lucide-react";
import { useState } from "react";

// "What are you paying the OTAs?" — the emotional core of the partner page.
//
// Illustration only: it multiplies the visitor's OWN numbers by a published
// commission rate. It never claims a Wielo figure it cannot stand behind —
// the Wielo column is simply the guest total, because a Wielo payout IS the
// guest total. The competitor rates are host-side service fees and are labelled
// as approximate in the footnote, because they genuinely vary by plan.

const COMPETITORS = [
  { label: "Airbnb ~15%", rate: 0.15 },
  { label: "Booking.com ~17%", rate: 0.17 },
  { label: "Agent / OTA ~20%", rate: 0.2 },
];

const zar = (n: number) => `R${Math.round(n).toLocaleString("en-ZA")}`;

export function PartnerCalculator({ ctaHref }: { ctaHref: string }) {
  const [rate, setRate] = useState(1200);
  const [nights, setNights] = useState(14);
  const [comp, setComp] = useState(0.15);

  const guestTotal = rate * nights;
  const lost = guestTotal * comp;
  const current = guestTotal - lost;

  return (
    <div className="mt-10 grid items-center gap-6 lg:grid-cols-2 lg:gap-10">
      <div className="rounded-card border border-brand-line bg-white p-6 shadow-card lg:p-8">
        <div className="flex items-center justify-between">
          <label
            htmlFor="pc-rate"
            className="text-[13.5px] font-semibold text-brand-ink"
          >
            Nightly rate
          </label>
          <span className="text-[19px] font-bold tabular-nums text-brand-ink">
            {zar(rate)}
          </span>
        </div>
        <input
          id="pc-rate"
          type="range"
          min={300}
          max={6000}
          step={50}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          className="partner-range mt-3"
        />

        <div className="mt-8 flex items-center justify-between">
          <label
            htmlFor="pc-nights"
            className="text-[13.5px] font-semibold text-brand-ink"
          >
            Booked nights / month
          </label>
          <span className="text-[19px] font-bold tabular-nums text-brand-ink">
            {nights}
          </span>
        </div>
        <input
          id="pc-nights"
          type="range"
          min={1}
          max={30}
          step={1}
          value={nights}
          onChange={(e) => setNights(Number(e.target.value))}
          className="partner-range mt-3"
        />

        <div className="mt-8">
          <span className="mb-3 block text-[13.5px] font-semibold text-brand-ink">
            Where are you booking now?
          </span>
          <div className="flex flex-wrap gap-2">
            {COMPETITORS.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setComp(c.rate)}
                aria-pressed={comp === c.rate}
                className={
                  comp === c.rate
                    ? "inline-flex items-center rounded-pill border border-brand-primary bg-brand-light px-4 py-2 text-[13px] font-semibold text-brand-secondary"
                    : "inline-flex items-center rounded-pill border border-brand-line bg-white px-4 py-2 text-[13px] font-semibold text-brand-mute hover:border-brand-primary"
                }
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-mute">
              On your platform
            </div>
            <div className="mt-2 text-[13px] text-brand-mute line-through">
              {zar(guestTotal)}
            </div>
            <div className="mt-1 font-display text-[30px] font-extrabold tabular-nums text-brand-ink">
              {zar(current)}
            </div>
            <div className="mt-2 flex items-center gap-1 text-[12px] text-[#C0504A]">
              <TrendingDown className="h-4 w-4" />
              &minus;{zar(lost)} taken
            </div>
          </div>
          <div className="rounded-card border border-brand-primary bg-white p-5 shadow-card">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-primary">
              On Wielo
            </div>
            <div className="mt-2 text-[13px] text-brand-mute">
              {zar(guestTotal)}
            </div>
            <div className="mt-1 font-display text-[30px] font-extrabold tabular-nums text-brand-primary">
              {zar(guestTotal)}
            </div>
            <div className="mt-2 flex items-center gap-1 text-[12px] text-brand-primary">
              <CheckCircle2 className="h-4 w-4" /> You keep 100%
            </div>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-5 rounded-card bg-brand-secondary p-6 text-white sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#34E5A0]">
              You&rsquo;d keep an extra
            </div>
            <div className="mt-1 font-display text-[38px] font-extrabold tabular-nums leading-none text-[#34E5A0] sm:text-[46px]">
              {zar(lost)}
              <span className="text-[18px] font-bold text-[#9FC6B7]"> /mo</span>
            </div>
            <div className="mt-2 text-[13px] text-[#B7D8CB]">
              <span className="font-semibold text-white">{zar(lost * 12)}</span>{" "}
              a year back in your pocket.
            </div>
          </div>
          <a
            href={ctaHref}
            className="inline-flex h-[54px] w-full shrink-0 items-center justify-center gap-2 rounded-pill bg-[#34E5A0] px-7 text-[15.5px] font-bold text-brand-ink transition hover:brightness-105 sm:w-auto"
          >
            Claim it <ArrowRight className="h-[18px] w-[18px]" />
          </a>
        </div>
      </div>
    </div>
  );
}
