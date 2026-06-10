"use client";

import { DollarSign } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  fetchMySavingsSummary,
  type SavingsSummary,
} from "@/app/dashboard/_actions/savings";
import { Modal } from "@/components/ui/modal";
import { formatMoney } from "@/lib/format";

/**
 * Header "$" badge → "Vilo has saved you R X so far" modal. Sits to the left of
 * the direct-booking-link icon. The figure is fetched lazily on click (server
 * action) so it never costs anything on a normal dashboard navigation.
 */
export function SavingsBadge() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [summary, setSummary] = React.useState<SavingsSummary | null>(null);

  async function handleClick() {
    setLoading(true);
    try {
      setSummary(await fetchMySavingsSummary());
    } finally {
      setLoading(false);
      setOpen(true);
    }
  }

  const saved = summary
    ? formatMoney(summary.savedSoFar, summary.currency)
    : "—";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        title="See how much Vilo has saved you"
        aria-label="See how much Vilo has saved you in commission"
        className="inline-flex h-9 w-9 items-center justify-center rounded border border-brand-line bg-white text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-50"
      >
        <DollarSign className="h-4 w-4" />
      </button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        intent="success"
        icon={DollarSign}
        title="Vilo has saved you"
        description={
          summary && summary.savedSoFar > 0 ? (
            <span className="block">
              <span className="mt-1 block font-display text-3xl font-bold text-brand-ink">
                {saved}
              </span>
              <span className="mt-2 block">
                in booking commission across {summary.bookingCount}{" "}
                {summary.bookingCount === 1
                  ? "direct booking"
                  : "direct bookings"}{" "}
                — versus the typical 15% an OTA would have taken.
              </span>
            </span>
          ) : (
            "Once you take direct bookings through Vilo, this is where you'll see the commission you've kept versus the big OTAs."
          )
        }
        actions={
          summary && summary.savedSoFar > 0
            ? [
                {
                  label: "See full breakdown",
                  onClick: () => {
                    router.push("/dashboard/reports/savings");
                    return true;
                  },
                },
                { label: "Close", kind: "ghost" },
              ]
            : [{ label: "Got it" }]
        }
      />
    </>
  );
}
