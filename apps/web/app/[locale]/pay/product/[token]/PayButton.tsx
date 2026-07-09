"use client";

import { CreditCard, Loader2, Wallet } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  startProductPaystackAction,
  startProductPayPalAction,
} from "./actions";

export function PayButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await startProductPaystackAction(token);
          if (r.ok) window.location.href = r.url;
          else toast.error(r.error);
        })
      }
      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CreditCard className="h-4 w-4" />
      )}
      {pending ? "Redirecting…" : "Pay with card"}
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
