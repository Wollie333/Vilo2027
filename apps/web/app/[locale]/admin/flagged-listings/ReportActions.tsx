"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { actionReport, dismissReport, markReviewing } from "./actions";

type Mode = "action" | "dismiss";

export function ReportActions({
  reportId,
  status,
}: {
  reportId: string;
  status: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  function review() {
    start(async () => {
      const res = await markReviewing({ reportId });
      if (res.ok) {
        toast.success("Marked as reviewing.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function submit() {
    if (reason.trim().length < 5) {
      toast.error("Add a short note (at least 5 characters).");
      return;
    }
    start(async () => {
      const fn = mode === "dismiss" ? dismissReport : actionReport;
      const res = await fn({ reportId, reason: reason.trim() });
      if (res.ok) {
        toast.success(
          mode === "dismiss" ? "Report dismissed." : "Report actioned.",
        );
        setMode(null);
        setReason("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  if (mode == null) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {status === "open" ? (
          <button
            type="button"
            onClick={review}
            disabled={pending}
            className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-light disabled:opacity-60"
          >
            Mark reviewing
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setMode("action")}
          className="rounded bg-status-confirmed px-3 py-1.5 text-xs font-semibold text-white hover:bg-status-confirmed/90"
        >
          Mark actioned
        </button>
        <button
          type="button"
          onClick={() => setMode("dismiss")}
          className="rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-semibold text-brand-mute hover:bg-brand-light hover:text-brand-ink"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded border border-brand-line bg-brand-light/60 p-3">
      <textarea
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 1000))}
        placeholder={
          mode === "dismiss"
            ? "Why is this being dismissed? (internal note)"
            : "What action was taken? (internal note)"
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
            mode === "dismiss"
              ? "bg-brand-mute hover:bg-brand-ink"
              : "bg-status-confirmed hover:bg-status-confirmed/90"
          }`}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Confirm
        </button>
      </div>
    </div>
  );
}
