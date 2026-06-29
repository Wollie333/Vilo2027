"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setHostActive } from "./actions";

export function SuspendHostButton({
  hostId,
  isActive,
}: {
  hostId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const next = !isActive; // the state we'll move TO

  function submit() {
    if (reason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters.");
      return;
    }
    start(async () => {
      const result = await setHostActive({
        hostId,
        active: next,
        reason: reason.trim(),
      });
      if (result.ok) {
        toast.success(next ? "Host reactivated." : "Host suspended.");
        setOpen(false);
        setReason("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center rounded px-3 py-2 text-xs font-semibold transition-colors ${
          isActive
            ? "border border-brand-line bg-white text-brand-ink hover:bg-brand-light"
            : "bg-brand-primary text-white hover:bg-brand-secondary"
        }`}
      >
        {isActive ? "Suspend host" : "Reactivate host"}
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded border border-brand-line bg-brand-light/60 p-3">
      <p className="text-[12.5px] text-brand-dark">
        {isActive
          ? "Suspend this host — their listings should stop taking new bookings until reactivated."
          : "Reactivate this host so their listings can take bookings again."}
      </p>
      <textarea
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 500))}
        placeholder="Reason (required, ≥ 5 chars)"
        className="block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
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
            next
              ? "bg-brand-primary hover:bg-brand-secondary"
              : "bg-status-cancelled hover:bg-status-cancelled/90"
          }`}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Confirm
        </button>
      </div>
    </div>
  );
}
