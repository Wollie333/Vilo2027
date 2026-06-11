import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { ArrowLeft, Check, TrendingUp } from "lucide-react";

import { formatMoney } from "@/lib/format";
import { getHostSavings } from "@/lib/savings/getHostSavings";
import {
  computeSavings,
  HEADLINE_OTA_RATE,
} from "@/lib/savings/ota-competitors";

export const metadata: Metadata = {
  title: "Your savings vs OTAs",
};

export const dynamic = "force-dynamic";

export default async function SavingsReportPage() {
  const savings = await getHostSavings();
  if (!savings) redirect("/dashboard/reports");

  const { directRevenue, savedSoFar, rows } = computeSavings(
    savings.direct_revenue,
  );
  const currency = savings.currency;
  const hasData = directRevenue > 0;

  const since = savings.first_booking_date
    ? new Date(savings.first_booking_date).toLocaleDateString("en-ZA", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <>
      {/* Header */}
      <header className="border-b border-brand-line bg-white">
        <div className="px-5 py-6 lg:px-8 lg:py-7">
          <Link
            href="/dashboard/reports"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-mute transition-colors hover:text-brand-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Tools · Analytics · Savings
          </Link>
          <h1 className="mt-0.5 font-display text-xl font-bold leading-none text-brand-ink lg:text-2xl">
            Your savings vs the OTAs
          </h1>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-[1520px] space-y-6 px-5 py-6 lg:space-y-7 lg:px-8 lg:py-7">
        {/* Dark hero — headline savings */}
        <section
          className="relative grid gap-6 overflow-hidden rounded-card p-6 text-white shadow-lift md:grid-cols-[1.6fr_1fr] lg:p-8"
          style={{
            background:
              "linear-gradient(145deg, #030806 0%, #0a1510 50%, #051209 100%)",
          }}
        >
          {/* Blur orb accent */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-brand-primary/30 blur-3xl" />

          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent">
              <TrendingUp className="h-3 w-3" />
              Commission saved
            </span>
            <div className="mt-3 font-display text-4xl font-bold leading-none lg:text-5xl">
              {hasData
                ? formatMoney(savedSoFar, currency)
                : formatMoney(0, currency)}
            </div>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
              {hasData ? (
                <>
                  That&apos;s what you&apos;ve kept
                  {since ? ` since ${since}` : ""} by taking{" "}
                  {savings.booking_count}{" "}
                  {savings.booking_count === 1 ? "booking" : "bookings"}{" "}
                  directly through Vilo — money a typical OTA at{" "}
                  {Math.round(HEADLINE_OTA_RATE * 100)}% commission would have
                  taken off the top.
                </>
              ) : (
                <>
                  Once you take direct bookings through Vilo, this is where
                  you&apos;ll see exactly how much commission you&apos;ve kept
                  versus each major OTA.
                </>
              )}
            </p>
          </div>

          {/* Right stat block */}
          <div className="relative rounded-card bg-white/5 p-5 ring-1 ring-white/10">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-primary">
              Direct booking revenue
            </div>
            <div className="mt-1 font-display text-2xl font-bold">
              {formatMoney(directRevenue, currency)}
            </div>
            <div className="mt-4 space-y-2 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-brand-primary" />
                {savings.booking_count} direct{" "}
                {savings.booking_count === 1 ? "booking" : "bookings"}
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-brand-primary" />
                0% commission on Vilo
              </div>
            </div>
          </div>
        </section>

        {/* Competitor comparison */}
        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card lg:p-6">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-brand-ink">
                What each OTA would have charged you
              </h2>
              <p className="mt-1 text-sm text-brand-mute">
                Their typical commission applied to your{" "}
                {formatMoney(directRevenue, currency)} in direct bookings.
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-line text-left text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
                  <th className="pb-2 pr-4 font-semibold">Platform</th>
                  <th className="pb-2 pr-4 font-semibold">
                    Typical commission
                  </th>
                  <th className="pb-2 text-right font-semibold">
                    You&apos;d have paid
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Vilo — the contrast row */}
                <tr className="border-b border-brand-line bg-brand-accent/40">
                  <td className="py-3 pr-4">
                    <div className="font-semibold text-brand-ink">Vilo</div>
                    <div className="text-xs text-brand-mute">
                      Direct bookings — what you actually use
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center rounded-pill bg-brand-primary/10 px-2 py-0.5 text-xs font-semibold text-brand-secondary">
                      0%
                    </span>
                  </td>
                  <td className="py-3 text-right font-display text-base font-bold text-brand-secondary">
                    {formatMoney(0, currency)}
                  </td>
                </tr>

                {rows.map((row) => (
                  <tr
                    key={row.name}
                    className="border-b border-brand-line last:border-0"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-brand-ink">
                          {row.name}
                        </span>
                        {row.scope === "za" ? (
                          <span className="rounded-pill bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-mute">
                            SA
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-brand-mute">{row.note}</div>
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-brand-ink">
                      {Math.round(row.rate * 100)}%
                    </td>
                    <td className="py-3 text-right font-display text-base font-bold tabular-nums text-brand-ink">
                      {formatMoney(row.wouldHavePaid, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-brand-mute">
            Commission rates are typical host-side figures for the South African
            market and vary by listing, plan and promotion. Your savings are
            estimated against your confirmed direct-booking revenue.
          </p>
        </section>
      </div>
    </>
  );
}
