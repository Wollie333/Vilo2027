"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { modal } from "@/components/ui/modal-host";
import { formatMoney } from "@/lib/format";

/**
 * A pulsing "Quote accepted" pill shown wherever an accepted-but-not-yet-
 * converted quote needs the host's attention (booking + guest records, lists).
 * It auto-opens a prompt to convert the quote into a booking & request payment;
 * the host can dismiss it (the pill keeps pulsing because the underlying quote
 * is still accepted) and click the pill any time to reopen the prompt.
 *
 * The prompt routes to the quote record, where the Convert / set-payment modal
 * lives — completing or declining there clears the accepted state, so the pill
 * disappears on the next load.
 */
export function AcceptedQuotePill({
  quoteId,
  guestFirstName,
  amount,
  currency,
  autoOpen = false,
  size = "sm",
}: {
  quoteId: string;
  guestFirstName: string;
  amount: number;
  currency: string;
  /** Records auto-open the prompt once; list rows don't. */
  autoOpen?: boolean;
  size?: "sm" | "xs";
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const opened = useRef(false);

  async function prompt() {
    if (busy) return;
    setBusy(true);
    const ok = await modal.confirm({
      title: "Quote accepted — convert it",
      description: `${guestFirstName}'s quote for ${formatMoney(
        amount,
        currency,
      )} is accepted. Convert it to a booking, set the deposit (or full amount) and send the payment card to the guest.`,
      confirmLabel: "Convert & request payment",
      cancelLabel: "Later",
    });
    setBusy(false);
    if (ok) start(() => router.push(`/dashboard/quotes/${quoteId}`));
  }

  useEffect(() => {
    if (autoOpen && !opened.current) {
      opened.current = true;
      void prompt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  return (
    <button
      type="button"
      onClick={prompt}
      title="Quote accepted — convert to a booking"
      className={`inline-flex items-center gap-1.5 rounded-pill border border-status-pending/30 bg-status-pending/10 font-semibold text-status-pending transition hover:bg-status-pending/20 ${
        size === "xs"
          ? "px-2 py-0.5 text-[10.5px]"
          : "px-2.5 py-1 text-[11.5px]"
      }`}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-pending opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-status-pending" />
      </span>
      <CheckCircle2 className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      Quote accepted
    </button>
  );
}
