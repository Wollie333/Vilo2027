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
}: {
  token: string;
  amountLabel: string;
  cardAvailable?: boolean;
  paypalAvailable?: boolean;
}) {
  const [pending, setPending] = useState<null | "paystack" | "paypal">(null);

  async function payWithPayPal() {
    setPending("paypal");
    const res = await initializePayByTokenAction(token, "paypal");
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
    const res = await initializePayByTokenAction(token, "paystack");
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
            : `Pay ${amountLabel} by card`}
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
            : `Pay ${amountLabel} with PayPal`}
        </button>
      ) : null}
      <p className="inline-flex w-full items-center justify-center gap-1.5 text-[11px] text-brand-mute">
        <Lock className="h-3 w-3" /> Secured payment · your card details never
        touch our servers
      </p>
    </div>
  );
}
