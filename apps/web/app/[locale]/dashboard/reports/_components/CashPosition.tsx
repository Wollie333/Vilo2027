"use client";

import Link from "next/link";
import {
  Banknote,
  Wallet,
  RotateCcw,
  TrendingUp,
  Percent,
  ArrowUpRight,
  Activity,
} from "lucide-react";

import { formatMoney } from "@/lib/format";

export interface CashPositionData {
  /** Cash received this period. */
  collected: number;
  /** Cash received over all time (lifetime). */
  collectedLifetime: number;
  /** Cash refunded this period. */
  refunded: number;
  /** Refund count this period. */
  refundCount: number;
  /** Live balance guests still owe across the whole account. */
  outstanding: number;
  /** How many guests currently owe money. */
  owingGuests: number;
  /** Booked value this period (accrual — what the reports above show). */
  bookedValue: number;
  currency: string;
}

interface CashPositionProps {
  data: CashPositionData;
  periodLabel: string;
}

export function CashPosition({ data, periodLabel }: CashPositionProps) {
  const {
    collected,
    collectedLifetime,
    refunded,
    refundCount,
    outstanding,
    owingGuests,
    bookedValue,
    currency,
  } = data;

  const netCash = Math.round((collected - refunded) * 100) / 100;

  // Lifetime collection rate: of everything billed-and-still-tracked, how much
  // has actually landed. collectedLifetime + outstanding ≈ total billable.
  const billable = collectedLifetime + outstanding;
  const collectionRate =
    billable > 0 ? Math.round((collectedLifetime / billable) * 1000) / 10 : 0;

  // Reconciliation bar: collected vs outstanding (live, all-time).
  const collectedPct = billable > 0 ? (collectedLifetime / billable) * 100 : 0;

  // Bridge accrual → cash for the explainer line (period booked vs collected).
  const gap = Math.round((bookedValue - collected) * 100) / 100;

  return (
    <section className="rounded-card border border-brand-line bg-white p-5 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-brand-mute">
            <Activity className="h-3.5 w-3.5 text-brand-secondary" />
            Cash position
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-accent px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-brand-secondary">
              Live from your ledger
            </span>
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
            {formatMoney(collected, currency)}{" "}
            <span className="text-sm font-medium text-brand-mute">
              collected · {periodLabel}
            </span>
          </h3>
        </div>
        <Link
          href="/dashboard/ledger"
          className="inline-flex items-center gap-1 self-start rounded-full border border-brand-line px-3 py-1.5 text-xs font-medium text-brand-ink transition-colors hover:bg-brand-light sm:self-auto"
        >
          Open ledger
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Accrual → cash explainer */}
      <p className="mt-3 text-xs leading-relaxed text-brand-mute">
        The KPIs above show{" "}
        <span className="font-medium text-brand-ink">booked value</span> —{" "}
        {formatMoney(bookedValue, currency)} guests committed to this period.
        This panel shows the{" "}
        <span className="font-medium text-brand-ink">actual money</span>, drawn
        straight from your payment ledger.
        {gap > 0.5 && (
          <>
            {" "}
            {formatMoney(gap, currency)} of this period&apos;s bookings is still
            to be collected.
          </>
        )}
      </p>

      {/* Collected vs outstanding bar (lifetime, live) */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] font-medium text-brand-mute">
          <span>Lifetime collection</span>
          <span className="text-brand-ink">{collectionRate.toFixed(1)}%</span>
        </div>
        <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-brand-light">
          <div
            className="h-full rounded-l-full bg-brand-primary transition-all"
            style={{ width: `${Math.min(100, Math.max(0, collectedPct))}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-brand-mute">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
            {formatMoney(collectedLifetime, currency)} collected
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-light ring-1 ring-brand-line" />
            {formatMoney(outstanding, currency)} outstanding
          </span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={<Banknote className="h-3.5 w-3.5 text-brand-secondary" />}
          label="Collected"
          value={formatMoney(collected, currency)}
          sub={`${formatMoney(collectedLifetime, currency)} all-time`}
        />
        <MetricCard
          icon={<Wallet className="h-3.5 w-3.5 text-amber-600" />}
          label="Outstanding"
          value={formatMoney(outstanding, currency)}
          sub={
            owingGuests > 0
              ? `${owingGuests} guest${owingGuests === 1 ? "" : "s"} owing`
              : "Fully settled"
          }
          tone={outstanding > 0.5 ? "warn" : "default"}
        />
        <MetricCard
          icon={<RotateCcw className="h-3.5 w-3.5 text-status-cancelled" />}
          label="Refunded"
          value={formatMoney(refunded, currency)}
          sub={`${refundCount} refund${refundCount === 1 ? "" : "s"}`}
          tone={refunded > 0.5 ? "danger" : "default"}
        />
        <MetricCard
          icon={<TrendingUp className="h-3.5 w-3.5 text-brand-secondary" />}
          label="Net cash"
          value={formatMoney(netCash, currency)}
          sub="Collected − refunded"
        />
      </div>

      {/* Collection rate footer chip */}
      <div className="mt-3 flex items-center gap-2 rounded border border-brand-line bg-brand-light/60 p-3">
        <Percent className="h-4 w-4 shrink-0 text-brand-secondary" />
        <div className="text-xs text-brand-ink">
          <strong className="font-semibold">
            {collectionRate.toFixed(1)}% collected
          </strong>{" "}
          of everything you&apos;ve billed.{" "}
          {outstanding > 0.5 ? (
            <span className="text-brand-mute">
              {formatMoney(outstanding, currency)} still owed across{" "}
              {owingGuests} guest{owingGuests === 1 ? "" : "s"} — chase it from
              the ledger.
            </span>
          ) : (
            <span className="text-brand-mute">
              Every booking is paid up. Nice.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "warn" | "danger";
}) {
  const valueTone =
    tone === "warn"
      ? "text-amber-700"
      : tone === "danger"
        ? "text-status-cancelled"
        : "text-brand-ink";
  return (
    <div className="rounded border border-brand-line bg-white p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-mute">
        {icon}
        {label}
      </div>
      <div className={`mt-2 font-display text-xl font-bold ${valueTone}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-brand-mute">{sub}</div>
    </div>
  );
}
