"use client";

import { Banknote, CreditCard, Loader2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";

import { initializePaymentForBookingAction } from "../actions";

export function PayForm({
  bookingId,
  currency,
  total,
  deposit,
  eftAvailable,
  cardAvailable = true,
  paypalAvailable = false,
  initialMethod,
}: {
  bookingId: string;
  currency: string;
  total: number;
  deposit: number | null; // null when there's no separate deposit
  eftAvailable: boolean;
  cardAvailable?: boolean;
  paypalAvailable?: boolean;
  /** Rail to pre-select (e.g. the "Pay with PayPal" option on the success page
   * deep-links here). Honoured only when that rail is actually available. */
  initialMethod?: "paystack" | "eft" | "paypal";
}) {
  // Default to the deposit when the host set one.
  const [amount, setAmount] = useState<"deposit" | "full">(
    deposit != null ? "deposit" : "full",
  );
  const [method, setMethod] = useState<"paystack" | "eft" | "paypal">(() => {
    if (initialMethod === "paystack" && cardAvailable) return "paystack";
    if (initialMethod === "paypal" && paypalAvailable) return "paypal";
    if (initialMethod === "eft" && eftAvailable) return "eft";
    return cardAvailable ? "paystack" : paypalAvailable ? "paypal" : "eft";
  });
  const [pending, setPending] = useState(false);

  const payNow = amount === "deposit" && deposit != null ? deposit : total;
  const balance = payNow >= total ? 0 : total - payNow;

  async function pay() {
    if (pending) return;
    setPending(true);
    try {
      const r = await initializePaymentForBookingAction(bookingId, {
        method,
        amount,
      });
      if (r.ok) {
        window.location.assign(r.redirectTo);
        return; // keep spinner through navigation
      }
      toast.error(r.error);
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Amount */}
      {deposit != null ? (
        <section className="rounded-card border border-brand-line bg-white p-4 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            How much to pay now
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <AmountOption
              active={amount === "deposit"}
              onClick={() => setAmount("deposit")}
              label="Deposit"
              value={formatMoney(deposit, currency)}
              note="Balance due before check-in"
            />
            <AmountOption
              active={amount === "full"}
              onClick={() => setAmount("full")}
              label="Pay in full"
              value={formatMoney(total, currency)}
              note="Nothing left to pay"
            />
          </div>
        </section>
      ) : null}

      {/* Method */}
      <section className="rounded-card border border-brand-line bg-white p-4 shadow-card">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          Payment method
        </div>
        <div className="mt-3 space-y-2.5">
          {cardAvailable ? (
            <MethodOption
              active={method === "paystack"}
              onClick={() => setMethod("paystack")}
              icon={<CreditCard className="h-4 w-4" />}
              label="Card"
              note="Secure card payment via Paystack"
            />
          ) : null}
          {paypalAvailable ? (
            <MethodOption
              active={method === "paypal"}
              onClick={() => setMethod("paypal")}
              icon={<Wallet className="h-4 w-4" />}
              label="PayPal"
              note="Pay in USD with your PayPal account or card"
            />
          ) : null}
          {eftAvailable ? (
            <MethodOption
              active={method === "eft"}
              onClick={() => setMethod("eft")}
              icon={<Banknote className="h-4 w-4" />}
              label="EFT / bank transfer"
              note="Get the host's banking details and reference"
            />
          ) : null}
        </div>
      </section>

      <div className="rounded-card border border-brand-line bg-brand-light/50 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-brand-mute">Paying now</span>
          <span className="num font-display text-lg font-bold text-brand-ink">
            {formatMoney(payNow, currency)}
          </span>
        </div>
        {balance > 0 ? (
          <div className="mt-1 flex items-center justify-between text-xs text-brand-mute">
            <span>Balance due later</span>
            <span className="num">{formatMoney(balance, currency)}</span>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={pay}
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-brand-primary text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : method === "eft" ? (
          "Reserve & get EFT details"
        ) : (
          `Pay ${formatMoney(payNow, currency)}`
        )}
      </button>
    </div>
  );
}

function AmountOption({
  active,
  onClick,
  label,
  value,
  note,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[10px] border p-3 text-left transition ${
        active
          ? "border-brand-primary bg-brand-accent/40 ring-2 ring-brand-primary/20"
          : "border-brand-line bg-white hover:bg-brand-light"
      }`}
    >
      <div className="text-[12px] font-semibold text-brand-ink">{label}</div>
      <div className="num mt-0.5 font-display text-base font-bold text-brand-ink">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-brand-mute">{note}</div>
    </button>
  );
}

function MethodOption({
  active,
  onClick,
  icon,
  label,
  note,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  note: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[10px] border p-3 text-left transition ${
        active
          ? "border-brand-primary bg-brand-accent/40 ring-2 ring-brand-primary/20"
          : "border-brand-line bg-white hover:bg-brand-light"
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-brand-ink">
          {label}
        </span>
        <span className="block text-[11px] text-brand-mute">{note}</span>
      </span>
    </button>
  );
}
