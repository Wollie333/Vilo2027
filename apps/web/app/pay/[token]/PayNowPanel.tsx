"use client";

import { CreditCard, Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { initializePayByTokenAction } from "./actions";

/**
 * The "Pay by card" control on the public pay-now page. Calls the token action
 * (which charges the host's own Paystack) and forwards the payer to the
 * returned Paystack checkout URL. Card is only rendered when the host has a
 * live gateway — the page decides that and only mounts this then.
 */
export function PayNowPanel({
  token,
  amountLabel,
}: {
  token: string;
  amountLabel: string;
}) {
  const [pending, setPending] = useState(false);

  async function pay() {
    setPending(true);
    const res = await initializePayByTokenAction(token);
    if (res.ok) {
      // Full-page navigation to Paystack's hosted checkout.
      window.location.href = res.redirectTo;
      return;
    }
    setPending(false);
    toast.error(res.error);
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={pay}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded bg-brand-primary py-3.5 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        {pending ? "Redirecting to Paystack…" : `Pay ${amountLabel} by card`}
      </button>
      <p className="inline-flex w-full items-center justify-center gap-1.5 text-[11px] text-brand-mute">
        <Lock className="h-3 w-3" /> Secured by Paystack · Visa, Mastercard &
        instant EFT
      </p>
    </div>
  );
}
