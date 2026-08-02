"use client";

import {
  CalendarRange,
  Check,
  ChevronRight,
  Loader2,
  RotateCcw,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";

import {
  approveBookingChangeAction,
  declineBookingChangeAction,
} from "./guest-request-actions";

export type OpenChangeRequest = {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  guestMessage: string | null;
  createdAt: string;
};

export type OpenRefundRequest = {
  id: string;
  amount: number;
  currency: string;
  reason: string | null;
  createdAt: string;
};

/**
 * Host-facing banner: everything the guest is waiting on for this booking —
 * date/add-guest change requests (approve/decline inline) and open refund
 * requests (review on the refund page). Mirrors the amber "action needed"
 * workflow cards already on the booking detail.
 */
export function GuestRequestBanner({
  changeRequests,
  refundRequests,
}: {
  changeRequests: OpenChangeRequest[];
  refundRequests: OpenRefundRequest[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [declining, setDeclining] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const [pending, start] = React.useTransition();

  if (changeRequests.length === 0 && refundRequests.length === 0) return null;

  function approve(id: string) {
    setBusyId(id);
    start(async () => {
      const res = await approveBookingChangeAction(id);
      setBusyId(null);
      if (res.ok) {
        toast.success("Request approved — the guest has been notified.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function confirmDecline(id: string) {
    setBusyId(id);
    start(async () => {
      const res = await declineBookingChangeAction(
        id,
        reason.trim() || undefined,
      );
      setBusyId(null);
      if (res.ok) {
        toast.success("Request declined — the guest has been notified.");
        setDeclining(null);
        setReason("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-card border border-amber-300 bg-amber-50/60 shadow-card">
      <div className="flex items-center gap-2 border-b border-amber-200 px-5 py-3">
        <span className="flex h-2 w-2 rounded-full bg-amber-500" />
        <span className="font-display text-[14px] font-bold text-amber-900">
          Guest requests awaiting you
        </span>
        <span className="rounded-pill bg-amber-200 px-1.5 py-px text-[10.5px] font-semibold text-amber-800">
          {changeRequests.length + refundRequests.length}
        </span>
      </div>

      <div className="divide-y divide-amber-200/70">
        {changeRequests.map((r) => {
          const isDate = r.type === "date_change";
          const summary = isDate
            ? `New dates: ${String(r.payload?.check_in ?? "?")} → ${String(
                r.payload?.check_out ?? "?",
              )}`
            : `Add a guest: ${String(r.payload?.full_name ?? "—")}`;
          const detail = isDate
            ? r.guestMessage
            : [
                r.payload?.email as string | undefined,
                r.payload?.phone as string | undefined,
                r.guestMessage,
              ]
                .filter(Boolean)
                .join(" · ");
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
                    {isDate ? "Date change requested" : "Add a guest requested"}
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-brand-ink">
                    {summary}
                  </div>
                  {detail ? (
                    <div className="mt-0.5 text-[12px] text-brand-mute">
                      {detail}
                    </div>
                  ) : null}
                </div>
              </div>

              {declining === r.id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value.slice(0, 500))}
                    placeholder="Reason for declining (optional, shared with the guest)"
                    className="block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDeclining(null)}
                      disabled={pending}
                      className="rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-brand-light"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmDecline(r.id)}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-[10px] bg-status-cancelled px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                    >
                      {busyId === r.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Confirm decline
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => approve(r.id)}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-[10px] bg-status-confirmed px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {busyId === r.id && pending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeclining(r.id);
                      setReason("");
                    }}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" /> Decline
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {refundRequests.map((r) => (
          <Link
            key={r.id}
            href={`/dashboard/payments/refunds/${r.id}`}
            className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-amber-100/50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-amber-600 ring-1 ring-amber-200">
              <RotateCcw className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-brand-ink">
                Refund requested · {formatMoney(r.amount, r.currency)}
              </div>
              {r.reason ? (
                <div className="mt-0.5 text-[12px] text-brand-mute">
                  {r.reason}
                </div>
              ) : null}
            </div>
            <span className="text-[12px] font-medium text-brand-primary">
              Review
            </span>
            <ChevronRight className="h-4 w-4 text-brand-mute" />
          </Link>
        ))}
      </div>
    </div>
  );
}
