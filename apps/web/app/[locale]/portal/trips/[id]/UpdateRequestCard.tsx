"use client";

import { CalendarRange, Check, Loader2, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";

import { respondToUpdateQuoteAction } from "./actions";

export type UpdateRequest = {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
};

type Quote = {
  quoted_total?: number;
  delta?: number;
  settlement?: string;
  currency?: string;
  check_in?: string;
  check_out?: string;
};

/**
 * Guest-facing amber card mirroring the host "Guest requests" banner. Shows a
 * pending booking-update request: while it's awaiting the host it just reads
 * "waiting to confirm"; once the host sends a quote the guest sees the new total
 * + how any difference is settled, and can Accept (applies + settles, then any
 * balance is payable from the trip) or Decline (booking left exactly as it was).
 */
export function UpdateRequestCard({
  requests,
  hostName,
}: {
  requests: UpdateRequest[];
  hostName: string;
}) {
  const router = useRouter();
  const [busy, start] = React.useTransition();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  if (!requests.length) return null;

  function respond(id: string, decision: "accept" | "decline") {
    setBusyId(id);
    start(async () => {
      const res = await respondToUpdateQuoteAction(id, decision);
      setBusyId(null);
      if (res.ok) {
        toast.success(
          decision === "accept"
            ? "Change confirmed — any balance is now payable below."
            : "Quote declined — your booking is unchanged.",
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-card border border-amber-300 bg-amber-50 shadow-card">
      <div className="flex items-center gap-2 border-b border-amber-200 px-5 py-3">
        <span className="flex h-2 w-2 rounded-full bg-amber-500" />
        <span className="font-display text-[14px] font-bold text-amber-900">
          Booking update
        </span>
      </div>

      <div className="divide-y divide-amber-200/70">
        {requests.map((r) => {
          const isDate = r.type === "date_change";
          const quote = (r.payload?.quote ?? null) as Quote | null;
          const cur = quote?.currency ?? "ZAR";
          const delta = quote?.delta != null ? Number(quote.delta) : null;
          return (
            <div key={r.id} className="px-5 py-3.5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-amber-600 ring-1 ring-amber-200">
                  {isDate ? (
                    <CalendarRange className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-brand-ink">
                    {quote
                      ? "Your host sent a quote"
                      : isDate
                        ? "Date change requested"
                        : "Add-a-guest requested"}
                  </div>
                  {isDate ? (
                    <div className="mt-0.5 text-[12.5px] text-brand-ink">
                      {String(r.payload?.check_in ?? "?")} →{" "}
                      {String(r.payload?.check_out ?? "?")}
                    </div>
                  ) : null}
                  {quote ? (
                    <div className="mt-1.5 space-y-0.5 rounded-[10px] bg-white p-2.5 text-[12.5px] ring-1 ring-amber-200">
                      <div className="flex items-center justify-between">
                        <span className="text-brand-mute">New total</span>
                        <span className="font-semibold text-brand-ink">
                          {formatMoney(Number(quote.quoted_total ?? 0), cur)}
                        </span>
                      </div>
                      {delta != null && Math.abs(delta) >= 0.01 ? (
                        <div className="flex items-center justify-between">
                          <span className="text-brand-mute">
                            {delta > 0
                              ? "To pay now"
                              : quote.settlement === "credit"
                                ? "Store credit to you"
                                : quote.settlement === "none"
                                  ? "No refund (retained)"
                                  : "Refund to you"}
                          </span>
                          <span
                            className={
                              delta > 0
                                ? "font-semibold text-brand-ink"
                                : "font-semibold text-emerald-700"
                            }
                          >
                            {formatMoney(Math.abs(delta), cur)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-0.5 text-[12px] text-brand-mute">
                      Waiting for {hostName} to confirm the price — you&apos;ll
                      accept or decline here.
                    </div>
                  )}
                </div>
              </div>

              {quote ? (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => respond(r.id, "accept")}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-[10px] bg-status-confirmed px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {busy && busyId === r.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => respond(r.id, "decline")}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" /> Decline
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
