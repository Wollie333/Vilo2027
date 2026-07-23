"use client";

import { Wallet } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { requestAffiliatePayoutAction } from "../actions";

// "Request a payout" card — pixel-match of the design. Fee/net are computed
// server-side and passed in; this shows the breakdown and fires the existing
// requestAffiliatePayoutAction against the default method.
function zar2(n: number): string {
  return (
    "R " +
    n
      .toLocaleString("en-ZA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      .replace(/,/g, " ")
  );
}
function zar0(n: number): string {
  return "R " + Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
}

export function RequestPayoutCard({
  available,
  fee,
  net,
  minThreshold,
  method,
  methodLabel,
  hasMethod,
}: {
  available: number;
  fee: number;
  net: number;
  minThreshold: number;
  method: string | null;
  methodLabel: string | null;
  hasMethod: boolean;
}) {
  const [pending, start] = useTransition();
  const belowMin = available < minThreshold;
  const canRequest = hasMethod && !belowMin && available > 0;

  function request() {
    if (!method) return;
    start(async () => {
      const res = await requestAffiliatePayoutAction(method);
      if (res.ok)
        toast.success(`Payout requested — ${zar2(res.data?.net ?? 0)}`);
      else toast.error(res.error ?? "Couldn't request the payout.");
    });
  }

  return (
    <section className="am-card fade overflow-hidden">
      <div className="smallcaps border-b border-brand-line px-5 py-3.5">
        Request a payout
      </div>
      <div className="p-5">
        <div className="rounded-[12px] border border-[#C7F0DC] bg-brand-light p-4 text-center">
          <div className="smallcaps">You can withdraw</div>
          <div className="num mt-1 font-display text-[28px] font-extrabold text-brand-secondary">
            {zar0(available)}
          </div>
        </div>
        <dl className="mt-4 space-y-2 text-[12.5px]">
          <div className="flex justify-between">
            <dt className="text-brand-mute">Cleared balance</dt>
            <dd className="num font-semibold text-brand-ink">
              {zar2(available)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-brand-mute">Transfer fee</dt>
            <dd className="num font-semibold text-brand-ink">− {zar2(fee)}</dd>
          </div>
          <div className="flex justify-between border-t border-brand-line pt-2">
            <dt className="font-semibold text-brand-ink">
              You&apos;ll receive
            </dt>
            <dd className="num font-bold text-brand-secondary">{zar2(net)}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={request}
          disabled={!canRequest || pending}
          className="btn-pri mt-4 w-full justify-center"
        >
          <Wallet className="h-4 w-4" />
          {pending ? "Requesting…" : "Request payout"}
        </button>
        <p className="mt-3 text-[11px] leading-relaxed text-brand-mute">
          {!hasMethod
            ? "Add a payout account below before you can withdraw. "
            : belowMin
              ? `Minimum payout ${zar0(minThreshold)} — keep earning to withdraw. `
              : `Minimum payout ${zar0(minThreshold)}. Paid ${methodLabel ? `by ${methodLabel} ` : ""}within 3 business days. `}
          A remittance document is issued with every payout.
        </p>
      </div>
    </section>
  );
}
