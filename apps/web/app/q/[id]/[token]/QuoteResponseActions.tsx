"use client";

import { CheckCircle2, CircleSlash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { modal } from "@/components/ui/modal-host";

import { guestAcceptQuoteAction, guestDeclineQuoteAction } from "./actions";

export function QuoteResponseActions({
  quoteId,
  token,
}: {
  quoteId: string;
  token: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function accept() {
    start(async () => {
      const r = await guestAcceptQuoteAction(quoteId, token);
      if (r.ok) {
        toast.success("Quote accepted — the host will be in touch.");
        router.refresh();
      } else toast.error(r.error);
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
      const r = await guestDeclineQuoteAction(quoteId, token);
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
        Accepting holds your dates with the host. Payment is arranged afterwards
        directly with them.
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
