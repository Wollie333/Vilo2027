"use client";

import { CreditCard, Loader2, Wallet } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  capturePayPalProductAction,
  startProductPaystackAction,
  startProductPayPalAction,
} from "./actions";

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

// "Pay with card" — opens the Paystack INLINE POPUP (resumeTransaction) so the
// payer stays on the pay page instead of a full redirect to
// checkout.paystack.com. On success we go to /pay/product/[token]?reference=…
// which settles server-side. Falls back to the hosted URL if the inline script
// can't load. Mirrors the guest booking PayNowPanel.
export function PayButton({ token }: { token: string }) {
  const [pending, setPending] = useState(false);

  async function pay() {
    setPending(true);
    const res = await startProductPaystackAction(token);
    if (!res.ok) {
      setPending(false);
      toast.error(res.error);
      return;
    }
    // No access code (shouldn't happen for card) → hosted-page fallback.
    if (!res.accessCode) {
      window.location.href = res.url;
      return;
    }
    const confirmUrl = res.reference
      ? `/pay/product/${token}?reference=${encodeURIComponent(res.reference)}`
      : `/pay/product/${token}`;

    const PaystackPop = await loadPaystack();
    if (!PaystackPop) {
      // Couldn't load the popup script — fall back to hosted checkout.
      window.location.href = res.url;
      return;
    }
    try {
      const popup = new PaystackPop();
      popup.resumeTransaction(res.accessCode, {
        onSuccess: () => {
          window.location.href = confirmUrl;
        },
        onCancel: () => setPending(false),
        onError: () => {
          setPending(false);
          toast.error("Payment could not be completed. Please try again.");
        },
      });
    } catch {
      window.location.href = res.url;
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={pay}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CreditCard className="h-4 w-4" />
      )}
      {pending ? "Opening secure checkout…" : "Pay with card"}
    </button>
  );
}

// PayPal (Wielo platform account) — hands off to the approval URL; capture
// happens on return to /pay/product/[token]?token=<orderId>. `secondary` styles
// it as the alt option when a card button is shown above it.
export function PayPalButton({
  token,
  secondary = false,
}: {
  token: string;
  secondary?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await startProductPayPalAction(token);
          if (r.ok) window.location.href = r.url;
          else toast.error(r.error);
        })
      }
      className={`inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold transition disabled:opacity-60 ${
        secondary
          ? "border border-brand-line bg-white text-brand-ink hover:bg-brand-light"
          : "bg-brand-primary text-white hover:bg-brand-secondary"
      }`}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Wallet className="h-4 w-4" />
      )}
      {pending ? "Redirecting to PayPal…" : "Pay with PayPal"}
    </button>
  );
}

// Minimal typing for the PayPal JS SDK Smart Buttons (no `any`).
type PayPalButtonsConfig = {
  style?: Record<string, unknown>;
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string }) => Promise<void> | void;
  onError?: (err: unknown) => void;
  onCancel?: () => void;
};
type PayPalNamespace = {
  Buttons: (cfg: PayPalButtonsConfig) => {
    render: (el: HTMLElement) => void;
  };
};

const PAYPAL_SDK_ATTR = "data-paypal-sdk";

function loadPayPalSdk(clientId: string): Promise<PayPalNamespace | null> {
  return new Promise((resolve) => {
    const w = window as unknown as { paypal?: PayPalNamespace };
    if (w.paypal) return resolve(w.paypal);
    const src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      clientId,
    )}&currency=USD&intent=capture`;
    const existing = document.querySelector<HTMLScriptElement>(
      `script[${PAYPAL_SDK_ATTR}]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(w.paypal ?? null));
      existing.addEventListener("error", () => resolve(null));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.setAttribute(PAYPAL_SDK_ATTR, "1");
    s.async = true;
    s.onload = () => resolve(w.paypal ?? null);
    s.onerror = () => resolve(null);
    document.body.appendChild(s);
  });
}

// PayPal — the JS SDK Smart Buttons. Approval opens in a PayPal POPUP window
// (PayPal forbids iframe embedding, so there's no inline form like Paystack), so
// the payer stays on the pay page instead of a full redirect to www.paypal.com.
// createOrder → our server creates the order; onApprove → our server captures +
// settles, then we reload into the paid state. Falls back to the redirect button
// if the SDK can't load.
export function ProductPayPalButtons({
  token,
  clientId,
  secondary = false,
}: {
  token: string;
  clientId: string;
  secondary?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  const [state, setState] = useState<
    "loading" | "ready" | "failed" | "capturing"
  >("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const paypal = await loadPayPalSdk(clientId);
      if (cancelled) return;
      if (!paypal || !ref.current || rendered.current) {
        if (!paypal) setState("failed");
        return;
      }
      rendered.current = true;
      try {
        paypal
          .Buttons({
            style: { layout: "horizontal", height: 45, tagline: false },
            createOrder: async () => {
              const r = await startProductPayPalAction(token);
              if (!r.ok) {
                toast.error(r.error);
                throw new Error(r.error);
              }
              return r.orderId;
            },
            onApprove: async (data) => {
              setState("capturing");
              const r = await capturePayPalProductAction(data.orderID);
              if (r.ok) {
                window.location.href = `/pay/product/${token}`;
              } else {
                setState("ready");
                toast.error(r.error);
              }
            },
            onError: () =>
              toast.error("PayPal couldn't complete. Please try again."),
          })
          .render(ref.current);
        setState("ready");
      } catch {
        setState("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, clientId]);

  // SDK unavailable (blocked / offline) → the redirect button still works.
  if (state === "failed") {
    return <PayPalButton token={token} secondary={secondary} />;
  }

  return (
    <div className="w-full">
      {state === "loading" ? (
        <div className="flex items-center justify-center gap-2 rounded-md border border-brand-line bg-white py-3 text-sm font-semibold text-brand-mute">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading PayPal…
        </div>
      ) : null}
      <div ref={ref} />
      {state === "capturing" ? (
        <div className="mt-1 flex items-center justify-center gap-1.5 text-[12px] text-brand-mute">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Completing your
          payment…
        </div>
      ) : null}
    </div>
  );
}
