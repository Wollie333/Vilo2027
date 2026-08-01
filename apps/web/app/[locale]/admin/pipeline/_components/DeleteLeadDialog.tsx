"use client";

import { AlertTriangle, Trash2, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { deleteLeadAction } from "../actions";

/**
 * Confirm modal for deleting a pipeline lead. Always removes the CRM card; an
 * opt-in checkbox additionally soft-deletes (recoverable) the guest account.
 * Claimed/real accounts (isLead=false) get an extra warning but are still
 * allowed. The dialog owns the mutation; the caller handles what happens after
 * (remove the card from the board, or navigate back off the record page).
 */
export function DeleteLeadDialog({
  leadId,
  leadName,
  leadEmail,
  isLead,
  onClose,
  onDeleted,
}: {
  leadId: string;
  leadName: string;
  leadEmail?: string | null;
  isLead: boolean;
  onClose: () => void;
  onDeleted: (deletedGuest: boolean) => void;
}) {
  const [deleteGuest, setDeleteGuest] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  function confirm() {
    setErr(null);
    startTransition(async () => {
      try {
        const res = await deleteLeadAction({ leadId, deleteGuest });
        onDeleted(res.deletedGuest);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Couldn't delete this lead.");
      }
    });
  }

  const warnClaimed = deleteGuest && !isLead;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      // The dialog can be mounted inside a draggable card — keep pointer/click
      // events from leaking to the card's drag + navigate handlers.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (!pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Delete lead"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] overflow-hidden rounded-card border border-brand-line bg-white shadow-lift"
      >
        <div className="flex items-start gap-3 border-b border-brand-line px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Trash2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[15.5px] font-bold leading-tight">
              Delete lead
            </h2>
            <p className="mt-0.5 truncate text-[12.5px] text-brand-mute">
              {leadName}
              {leadEmail ? ` · ${leadEmail}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={pending}
            className="shrink-0 rounded-lg p-1 text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-[13px] leading-relaxed text-brand-ink">
            This removes the lead card and its activity, notes, tasks and files
            from the pipeline. The guest account stays unless you tick the box
            below.
          </p>

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-brand-line bg-brand-light/40 p-3">
            <input
              type="checkbox"
              checked={deleteGuest}
              disabled={pending}
              onChange={(e) => setDeleteGuest(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-red-600"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-brand-ink">
                Also delete the guest account
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-brand-mute">
                Soft-deletes the guest and everything linked to it. Sign-in is
                blocked and it&apos;s recoverable for 30 days.
              </span>
            </span>
          </label>

          {warnClaimed ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This is a <b>claimed account</b>, not just a lead — it may have
                real bookings or data. It will be soft-deleted (recoverable for
                30 days) and the person won&apos;t be able to sign in.
              </span>
            </div>
          ) : null}

          {err ? (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
              {err}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-brand-line px-5 py-3.5">
          <button
            onClick={onClose}
            disabled={pending}
            className="h-10 rounded-[10px] border border-brand-line bg-white px-3.5 text-[13px] font-medium text-brand-secondary transition hover:bg-brand-light disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={pending}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-red-600 px-3.5 text-[13px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {pending
              ? "Deleting…"
              : deleteGuest
                ? "Delete lead & guest"
                : "Delete lead"}
          </button>
        </div>
      </div>
    </div>
  );
}
