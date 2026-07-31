"use client";

import { Gift } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { startTrialConversionCheckoutAction } from "../settings/subscription/actions";

export type HostTrialWidget = {
  referrerName: string | null;
  campaignName: string | null;
  productName: string;
  priceMonthly: number;
  priceAnnual: number | null;
  currency: string;
  trialEndsAt: string;
};

const money = (n: number) =>
  "R " + Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");

function daysLeft(iso: string): number {
  const ms = Date.parse(iso) - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Header chip (left of the $ savings badge) shown ONLY to competition-referred
// hosts on a free trial. Opens a dialog with who referred them, how long is
// left, and a "Buy immediately" option that charges the competition price now
// (monthly or annual) via Paystack.
export function TrialBadge({ trial }: { trial: HostTrialWidget }) {
  const [open, setOpen] = useState(false);
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [pending, startCheckout] = useTransition();

  const left = daysLeft(trial.trialEndsAt);

  function buyNow() {
    startCheckout(async () => {
      const res = await startTrialConversionCheckoutAction({ cycle });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }
      // No charge was due (billing state-only) — reflect the change.
      toast.success("You're all set.");
      window.location.reload();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Your founding trial"
        aria-label={`Founding trial — ${left} day${left === 1 ? "" : "s"} left`}
        className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-brand-primary bg-white px-3 text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-light"
      >
        <Gift className="h-4 w-4 text-brand-primary" />
        <span className="tabular-nums">{left}d</span>
        <span className="hidden text-brand-mute sm:inline">trial</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {trial.campaignName
                ? `Your ${trial.campaignName} trial`
                : "Your founding trial"}
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-card border border-brand-line bg-brand-light/50 p-4">
            <div className="flex items-center gap-2 text-sm text-brand-mute">
              <Gift className="h-4 w-4 text-brand-primary" />
              {trial.productName} — full access
            </div>
            <p className="mt-1 text-3xl font-bold tabular-nums text-brand-ink">
              {left} day{left === 1 ? "" : "s"} left
            </p>
            <p className="mt-1 text-xs text-brand-mute">
              No charge until{" "}
              <span className="font-semibold text-brand-ink">
                {fmtDate(trial.trialEndsAt)}
              </span>
              {trial.referrerName ? (
                <> · referred by {trial.referrerName}</>
              ) : null}
              .
            </p>
          </div>

          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-mute">
              Buy immediately
            </h3>
            <p className="mb-3 text-sm text-brand-mute">
              Lock in your founding price now and keep it for as long as you
              stay. Choose how you&apos;d like to pay:
            </p>

            <div
              role="tablist"
              aria-label="Billing cycle"
              className="inline-flex w-full rounded-pill border border-brand-line bg-white p-1"
            >
              {(["monthly", "annual"] as const).map((c) => {
                const price =
                  c === "annual" ? trial.priceAnnual : trial.priceMonthly;
                if (c === "annual" && trial.priceAnnual == null) return null;
                return (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={cycle === c}
                    onClick={() => setCycle(c)}
                    className={`flex-1 rounded-pill px-3 py-1.5 text-sm font-semibold transition-colors ${
                      cycle === c
                        ? "bg-brand-primary text-white"
                        : "text-brand-ink hover:bg-brand-light"
                    }`}
                  >
                    {c === "annual" ? "Annual" : "Monthly"}
                    {price != null ? (
                      <span className="ml-1 font-normal opacity-90">
                        {money(price)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            type="button"
            onClick={buyNow}
            disabled={pending}
            className="mt-4 w-full"
          >
            {pending
              ? "Starting checkout…"
              : `Pay ${money(cycle === "annual" ? (trial.priceAnnual ?? trial.priceMonthly) : trial.priceMonthly)} ${
                  cycle === "annual" ? "/year" : "/month"
                }`}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
