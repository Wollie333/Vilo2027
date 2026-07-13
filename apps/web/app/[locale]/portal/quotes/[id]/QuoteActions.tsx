"use client";

import { CheckCircle2, CircleSlash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { modal } from "@/components/ui/modal-host";

import { acceptMyQuoteAction, declineMyQuoteAction } from "./actions";

// Auth-gated sibling of app/q/[id]/[token]/QuoteResponseActions.tsx — same UI,
// but it calls the session-gated actions (no accept_token needed).
export function QuoteActions({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function accept() {
    start(async () => {
      const r = await acceptMyQuoteAction(quoteId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      // Thank them, then offer to pay straight away (the booking is held) —
      // same hand-off as the public token flow, so an accept never dead-ends.
      if (r.payToken) {
        const go = await modal.confirm({
          title: "Thank you for accepting! 🎉",
          description:
            "Your dates are now held. Continue to pay and secure your booking — or come back to it later from your trip.",
          confirmLabel: "Continue to pay",
          cancelLabel: "I'll pay later",
        });
        if (go) {
          router.push(`/pay/${r.payToken}`);
          return;
        }
      } else {
        toast.success("Quote accepted — the host will be in touch.");
      }
      router.refresh();
    });
  }

  async function decline() {
    const ok = await modal.destructive({
      title: "Decline this quote?",
      description: "This releases the hold on your dates and can't be undone.",
      confirmLabel: "Decline",
    });
    if (!ok) return;
    start(async () => {
      const r = await declineMyQuoteAction(quoteId);
      if (r.ok) {
        toast.success("Quote declined.");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <h2 className="text-center font-display text-base font-bold text-brand-ink">
        Ready to go ahead?
      </h2>
      <p className="mt-1 text-center text-xs text-brand-mute">
        Accepting holds your dates — you can pay securely right after to confirm
        your booking.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={decline}
          disabled={pending}
          className="gap-1.5"
        >
          <CircleSlash className="h-4 w-4" /> Decline
        </Button>
        <Button
          type="button"
          onClick={accept}
          disabled={pending}
          className="gap-1.5"
        >
          <CheckCircle2 className="h-4 w-4" /> Accept quote
        </Button>
      </div>
    </div>
  );
}
