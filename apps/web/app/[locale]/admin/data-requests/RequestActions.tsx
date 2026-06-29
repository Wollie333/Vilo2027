"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  fulfillDeletion,
  fulfillExport,
  markProcessing,
  rejectRequest,
} from "./actions";

type Mode = "processing" | "complete" | "reject";

/** Trigger a client-side download of generated export JSON. */
function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function RequestActions({
  requestId,
  requestType,
  status,
}: {
  requestId: string;
  requestType: "export" | "deletion";
  status: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  const completeLabel =
    requestType === "export" ? "Fulfil export" : "Fulfil deletion";

  function submit() {
    if (reason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters.");
      return;
    }
    start(async () => {
      const input = { requestId, reason: reason.trim() };
      if (mode === "complete") {
        if (requestType === "export") {
          const res = await fulfillExport(input);
          if (res.ok) {
            downloadJson(res.filename, res.json);
            toast.success("Export generated & downloaded.");
          } else {
            toast.error(res.error);
            return;
          }
        } else {
          const res = await fulfillDeletion(input);
          if (res.ok) {
            toast.success(
              res.method === "hard_deleted"
                ? "User hard-deleted."
                : "User anonymised (had records).",
            );
          } else {
            toast.error(res.error);
            return;
          }
        }
        setMode(null);
        setReason("");
        router.refresh();
        return;
      }

      const fn = mode === "reject" ? rejectRequest : markProcessing;
      const result = await fn(input);
      if (result.ok) {
        toast.success(
          mode === "reject" ? "Request rejected." : "Marked as processing.",
        );
        setMode(null);
        setReason("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (mode == null) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {status === "pending" ? (
          <button
            type="button"
            onClick={() => setMode("processing")}
            className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-light"
          >
            Mark processing
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setMode("complete")}
          className="rounded bg-status-confirmed px-3 py-1.5 text-xs font-semibold text-white hover:bg-status-confirmed/90"
        >
          {completeLabel}
        </button>
        <button
          type="button"
          onClick={() => setMode("reject")}
          className="rounded border border-status-cancelled/30 bg-status-cancelled/5 px-3 py-1.5 text-xs font-semibold text-status-cancelled hover:bg-status-cancelled/10"
        >
          Reject
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded border border-brand-line bg-brand-light/60 p-3">
      <textarea
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 500))}
        placeholder={
          mode === "reject"
            ? "Reason for rejection (will be shown to user)"
            : "Internal note (audit trail)"
        }
        className="block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setMode(null);
            setReason("");
          }}
          disabled={pending}
          className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${
            mode === "reject"
              ? "bg-status-cancelled hover:bg-status-cancelled/90"
              : mode === "complete"
                ? "bg-status-confirmed hover:bg-status-confirmed/90"
                : "bg-brand-primary hover:bg-brand-secondary"
          }`}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Confirm
        </button>
      </div>
    </div>
  );
}
