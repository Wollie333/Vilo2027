"use client";

import { CreditCard, Loader2, Lock, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { initializePayByTokenAction } from "./actions";

const PAYSTACK_INLINE_SRC = "https://js.paystack.co/v2/inline.js";

type PaystackPopup = {
  resumeTransaction: (
    accessCode: string,
    callbacks?: {
      onSuccess?: (txn: { reference?: string }) => void;
      onCancel?: () => void;
      onError?: (err: unknown) => void;
    },
  ) => void;
};
type PaystackPopCtor = new () => PaystackPopup;

/** Load the Paystack inline script once and resolve the global constructor. */
function loadPaystack(): Promise<PaystackPopCtor | null> {
  return new Promise((resolve) => {
    const w = window as unknown as { PaystackPop?: PaystackPopCtor };
    if (w.PaystackPop) return resolve(w.PaystackPop);
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${PAYSTACK_INLINE_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(w.PaystackPop ?? null));
      existing.addEventListener("error", () => resolve(null));
      return;
    }
    const s = document.createElement("script");
    s.src = PAYSTACK_INLINE_SRC;
    s.async = true;
    s.onload = () => resolve(w.PaystackPop ?? null);
    s.onerror = () => resolve(null);
    document.body.appendChild(s);
  });
}

/**
 * The "Pay by card" control on the public pay-now page. Initialises the
 * transaction server-side (host's own Paystack, ledger row + metadata), then
 * opens the Paystack INLINE POPUP via `resumeTransaction(accessCode)` — no
 * full-page hop. On success the payer is sent to the confirm URL
 * (`/pay/[token]?reference=…`) which verifies + confirms server-side. If the
 * inline script can't load, we gracefully fall back to the hosted checkout URL.
 */
export function PayNowPanel({
  token,
  amountLabel,
  cardAvailable = true,
  paypalAvailable = false,
  depositLabel = null,
  fullLabel,
}: {
  token: string;
  amountLabel: string;
  cardAvailable?: boolean;
  paypalAvailable?: boolean;
  /** Formatted deposit amount when a deposit is due up front; null = pay in full only. */
  depositLabel?: string | null;
  /** Formatted full outstanding — shown as the alternative to the deposit. */
  fullLabel?: string;
}) {
  const [pending, setPending] = useState<null | "paystack" | "paypal">(null);
  // When a deposit is offered, the payer chooses deposit-now vs pay-in-full;
  // default to the deposit (the smaller, expected up-front amount).
  const [choice, setChoice] = useState<"deposit" | "full">(
    depositLabel ? "deposit" : "full",
  );
  const payAmount: "deposit" | "full" = depositLabel ? choice : "full";
  const payLabel =
    depositLabel && choice === "deposit"
      ? depositLabel
      : (fullLabel ?? amountLabel);

  async function payWithPayPal() {
    setPending("paypal");
    const res = await initializePayByTokenAction(token, "paypal", payAmount);
    if (!res.ok) {
      setPending(null);
      toast.error(res.error);
      return;
    }
    // PayPal returns an approval URL (no accessCode) — hand off to PayPal.
    window.location.href = res.redirectTo;
  }

  async function pay() {
    setPending("paystack");
    const res = await initializePayByTokenAction(token, "paystack", payAmount);
    if (!res.ok) {
      setPending(null);
      toast.error(res.error);
      return;
    }

    // EFT fallback (no card rail this attempt) → navigate to the landing page.
    if (!res.accessCode) {
      window.location.href = res.redirectTo;
      return;
    }

    const confirmUrl = res.reference
      ? `/pay/${token}?reference=${encodeURIComponent(res.reference)}`
      : `/pay/${token}`;

    const PaystackPop = await loadPaystack();
    if (!PaystackPop) {
      // Couldn't load the popup script — fall back to hosted checkout.
      window.location.href = res.redirectTo;
      return;
    }

    try {
      const popup = new PaystackPop();
      popup.resumeTransaction(res.accessCode, {
        onSuccess: () => {
          window.location.href = confirmUrl;
        },
        onCancel: () => setPending(null),
        onError: () => {
          setPending(null);
          toast.error("Payment could not be completed. Please try again.");
        },
      });
    } catch {
      window.location.href = res.redirectTo;
    }
  }

  return (
    <div className="space-y-3">
      {/* Deposit vs pay-in-full choice — only when a deposit is due up front. */}
      {depositLabel ? (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["deposit", "Pay deposit", depositLabel],
              ["full", "Pay in full", fullLabel ?? amountLabel],
            ] as const
          ).map(([value, label, amt]) => (
            <button
              key={value}
              type="button"
              onClick={() => setChoice(value)}
              disabled={!!pending}
              aria-pressed={choice === value}
              className={`rounded-card border px-3 py-2.5 text-center transition disabled:opacity-60 ${
                choice === value
                  ? "border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary"
                  : "border-brand-line bg-white hover:bg-brand-light"
              }`}
            >
              <div className="text-[11px] font-medium text-brand-mute">
                {label}
              </div>
              <div className="font-display text-sm font-semibold text-brand-ink">
                {amt}
              </div>
            </button>
          ))}
        </div>
      ) : null}
      {cardAvailable ? (
        <button
          type="button"
          onClick={pay}
          disabled={!!pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded bg-brand-primary py-3.5 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === "paystack" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4" />
          )}
          {pending === "paystack"
            ? "Opening secure checkout…"
            : `Pay ${payLabel} by card`}
        </button>
      ) : null}
      {paypalAvailable ? (
        <button
          type="button"
          onClick={payWithPayPal}
          disabled={!!pending}
          className={`inline-flex w-full items-center justify-center gap-2 rounded py-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
            cardAvailable
              ? "border border-brand-line bg-white text-brand-ink hover:bg-brand-light"
              : "bg-brand-primary text-white shadow-glow hover:bg-brand-primary/90"
          }`}
        >
          {pending === "paypal" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wallet className="h-4 w-4" />
          )}
          {pending === "paypal"
            ? "Redirecting to PayPal…"
            : `Pay ${payLabel} with PayPal`}
        </button>
      ) : null}
      <p className="inline-flex w-full items-center justify-center gap-1.5 text-[11px] text-brand-mute">
        <Lock className="h-3 w-3" /> Secured payment · your card details never
        touch our servers
      </p>
    </div>
  );
}
