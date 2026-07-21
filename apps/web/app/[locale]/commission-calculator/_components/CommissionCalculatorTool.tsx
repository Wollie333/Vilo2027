"use client";

import { ArrowRight, Check, Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import type { PublicMembershipPricing } from "@/lib/products/membershipPublic";
import {
  clampNumber,
  computeCommissionComparison,
  COMMISSION_PRESETS,
  LISTINGS_MAX,
  LISTINGS_MIN,
  RATE_MAX,
  RATE_MIN,
  REVENUE_MAX,
  REVENUE_MIN,
} from "@/lib/products/commissionMath";

// WS-8 — the shareable commission calculator. Every rand it shows comes from the
// live products row (passed in by the server page), never a constant, and the
// subscription is always subtracted — below break-even it says so plainly.

const groupZA = (n: number) =>
  Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const fmt = (n: number) => `R ${groupZA(n)}`;

export function CommissionCalculatorTool({
  pricing,
  initial,
}: {
  pricing: PublicMembershipPricing;
  initial: { revenue: number; rate: number; listings: number };
}) {
  const [revenueRaw, setRevenueRaw] = useState(groupZA(initial.revenue));
  const [rate, setRate] = useState(initial.rate);
  const [listings, setListings] = useState(initial.listings);

  const revenue = clampNumber(
    parseInt(revenueRaw.replace(/[^0-9]/g, ""), 10) || 0,
    REVENUE_MIN,
    REVENUE_MAX,
  );

  const c = useMemo(
    () =>
      computeCommissionComparison({
        monthlyRevenue: revenue,
        commissionRate: rate,
        listings,
        product: {
          price: pricing.price,
          annual_price: pricing.annual_price,
          per_listing_amount: pricing.per_listing_amount,
        },
      }),
    [revenue, rate, listings, pricing],
  );

  const revenuePct =
    ((revenue - REVENUE_MIN) / (REVENUE_MAX - REVENUE_MIN)) * 100;
  const priced = pricing.price > 0;

  function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}?revenue=${revenue}&rate=${rate}&listings=${listings}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Link copied — it opens with these numbers."))
      .catch(() => toast.error("Could not copy the link."));
  }

  return (
    <div className="rounded-card border border-brand-line bg-white p-6 shadow-card lg:p-8">
      {/* ---- Inputs ---- */}
      <div className="grid gap-7 md:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between text-xs">
            <label htmlFor="revenueInput" className="text-brand-mute">
              Your monthly bookings revenue
            </label>
            <div className="flex items-baseline gap-1 font-mono font-semibold text-brand-ink">
              <span className="text-brand-mute">R</span>
              <input
                id="revenueInput"
                type="text"
                inputMode="numeric"
                value={revenueRaw}
                aria-label="Monthly bookings revenue in rand"
                onChange={(e) => setRevenueRaw(e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={() => setRevenueRaw(groupZA(revenue))}
                className="w-28 border-b border-brand-line bg-transparent text-right text-base outline-none focus:border-brand-primary focus:ring-0"
              />
            </div>
          </div>
          <input
            type="range"
            min={REVENUE_MIN}
            max={REVENUE_MAX}
            step={1000}
            value={revenue}
            aria-label="Monthly bookings revenue slider"
            onChange={(e) => setRevenueRaw(groupZA(Number(e.target.value)))}
            className="wielo-range block w-full"
            style={{ ["--val" as string]: `${revenuePct}%` }}
          />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-brand-mute">
            <span>R 5k</span>
            <span>R 100k</span>
            <span>R 200k</span>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between text-xs">
            <label htmlFor="rateInput" className="text-brand-mute">
              Commission you pay now
            </label>
            <div className="flex items-baseline gap-1 font-mono font-semibold text-brand-ink">
              <input
                id="rateInput"
                type="number"
                min={RATE_MIN}
                max={RATE_MAX}
                step={0.5}
                value={rate}
                aria-label="Commission rate percent"
                onChange={(e) =>
                  setRate(
                    clampNumber(Number(e.target.value), RATE_MIN, RATE_MAX),
                  )
                }
                className="w-16 border-b border-brand-line bg-transparent text-right text-base outline-none focus:border-brand-primary focus:ring-0"
              />
              <span className="text-brand-mute">%</span>
            </div>
          </div>
          <input
            type="range"
            min={RATE_MIN}
            max={RATE_MAX}
            step={0.5}
            value={rate}
            aria-label="Commission rate slider"
            onChange={(e) => setRate(Number(e.target.value))}
            className="wielo-range block w-full"
            style={{
              ["--val" as string]: `${((rate - RATE_MIN) / (RATE_MAX - RATE_MIN)) * 100}%`,
            }}
          />
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {COMMISSION_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setRate(p.rate)}
                className={
                  rate === p.rate
                    ? "rounded-pill border border-brand-primary bg-brand-accent px-2.5 py-1 text-[11px] font-semibold text-brand-secondary"
                    : "rounded-pill border border-brand-line px-2.5 py-1 text-[11px] font-medium text-brand-mute hover:border-brand-primary/40"
                }
                title={`${p.label} — ${p.note}`}
              >
                {p.label} {p.rate}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Listings ---- */}
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-brand-line pt-5">
        <label htmlFor="listingsInput" className="text-xs text-brand-mute">
          Places you rent out
        </label>
        <input
          id="listingsInput"
          type="number"
          min={LISTINGS_MIN}
          max={LISTINGS_MAX}
          value={listings}
          aria-label="Number of listings"
          onChange={(e) =>
            setListings(
              Math.round(
                clampNumber(Number(e.target.value), LISTINGS_MIN, LISTINGS_MAX),
              ),
            )
          }
          className="w-20 rounded-[10px] border border-brand-line px-2.5 py-1.5 text-sm outline-none focus:border-brand-primary"
        />
        {priced ? (
          <span className="text-[12px] text-brand-mute">
            First place is included · each extra{" "}
            {fmt(pricing.per_listing_amount ?? 0)}/mo
          </span>
        ) : null}
      </div>

      {/* ---- Results ---- */}
      {priced ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-card border border-brand-line p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                Commission at {c.commissionRate}%
              </div>
              <div className="num mt-2 font-display text-2xl font-bold text-status-cancelled">
                −{fmt(c.commissionMonthly)}
              </div>
              <div className="mt-1 text-[11px] text-brand-mute">
                every month · {fmt(c.commissionAnnual)} a year
              </div>
            </div>
            <div className="rounded-card border-2 border-brand-primary bg-brand-accent/50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-primary">
                On Wielo
              </div>
              <div className="num mt-2 font-display text-2xl font-bold text-brand-primary">
                {fmt(c.wieloMonthly)}
              </div>
              <div className="mt-1 text-[11px] font-medium text-brand-primary">
                {listings > 1
                  ? `${listings} places · flat fee, 0% commission`
                  : "flat fee, 0% commission"}
              </div>
            </div>
            <div className="rounded-card border border-brand-line p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                {c.betterOnWielo
                  ? "You keep, per year"
                  : "Costs you more, a year"}
              </div>
              <div
                className={`num mt-2 font-display text-2xl font-bold ${
                  c.betterOnWielo ? "text-brand-ink" : "text-status-pending"
                }`}
              >
                {fmt(Math.abs(c.differenceAnnual))}
              </div>
              <div className="mt-1 text-[11px] text-brand-mute">
                commission minus the subscription
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-card bg-brand-light/60 p-4 text-[13px] leading-relaxed text-brand-ink">
            {c.betterOnWielo ? (
              <>
                At {fmt(revenue)} a month, {c.commissionRate}% commission costs
                you <strong>{fmt(c.commissionAnnual)} a year</strong>. Wielo
                costs <strong>{fmt(c.wieloAnnual)}</strong> — you keep the
                difference, <strong>{fmt(c.differenceAnnual)}</strong>. Guests
                pay you directly; we never take a cut of a booking.
              </>
            ) : (
              <>
                Straight up: at {fmt(revenue)} a month you&apos;d pay{" "}
                <strong>{fmt(c.commissionAnnual)}</strong> in commission and{" "}
                <strong>{fmt(c.wieloAnnual)}</strong> for Wielo — the
                subscription is the pricier option today. It starts paying for
                itself from about{" "}
                <strong>{fmt(c.breakEvenMonthlyRevenue)} a month</strong> in
                bookings.
              </>
            )}
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-card border border-brand-line bg-brand-light/60 p-4 text-[13px] text-brand-mute">
          Pricing is being updated — please check back shortly.
        </div>
      )}

      {/* ---- Actions ---- */}
      <div className="mt-6 flex flex-col gap-3 border-t border-brand-line pt-5 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center justify-center gap-1.5 rounded-pill border border-brand-line px-4 py-2 text-[13px] font-medium text-brand-ink transition hover:border-brand-primary/40 hover:bg-brand-light"
        >
          <Link2 className="h-4 w-4" />
          Copy these numbers as a link
        </button>
        <Link
          href="/signup/host"
          className="inline-flex items-center justify-center gap-1.5 rounded-pill bg-brand-primary px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-secondary sm:ml-auto"
        >
          <Check className="h-4 w-4" />
          Start on Wielo
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
