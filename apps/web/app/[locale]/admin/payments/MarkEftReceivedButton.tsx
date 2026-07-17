"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { markProductEftReceived } from "./actions";

// Settle a pending product-order EFT once the admin has seen the funds land.
// Shown only on pending EFT rows (see the payments table). One click marks the
// order paid — activating the plan, granting credits, recording any promo — so
// confirm first, because it's how the buyer actually gets what they paid for.
export function MarkEftReceivedButton({
  providerReference,
  label,
}: {
  providerReference: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function settle() {
    if (
      !confirm(
        `Mark this EFT as received?\n\n${label}\n\nThis activates the purchase — only do it once the money is in the bank.`,
      )
    ) {
      return;
    }
    start(async () => {
      const r = await markProductEftReceived({ providerReference });
      if (r.ok) {
        toast.success("EFT settled — the purchase is now active.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={settle}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Check className="h-3.5 w-3.5" />
      )}
      Mark received
    </button>
  );
}
