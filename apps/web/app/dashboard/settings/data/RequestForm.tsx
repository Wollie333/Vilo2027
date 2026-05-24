"use client";

import { AlertTriangle, Download, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelDataRequestAction, createDataRequestAction } from "./actions";

type Existing = {
  id: string;
  request_type: "export" | "deletion";
  status: string;
  created_at: string;
  notes: string | null;
};

export function RequestSection({
  type,
  existing,
}: {
  type: "export" | "deletion";
  existing: Existing | null;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  const isExport = type === "export";
  const Icon = isExport ? Download : Trash2;

  function submit() {
    if (type === "deletion" && !confirm) {
      toast.error("Confirm you understand this is irreversible.");
      return;
    }
    start(async () => {
      const result = await createDataRequestAction({
        requestType: type,
        notes: notes.trim() || null,
      });
      if (result.ok) {
        toast.success("Request submitted — we'll be in touch within 30 days.");
        setNotes("");
        setConfirm(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function cancel(requestId: string) {
    start(async () => {
      const result = await cancelDataRequestAction({ requestId });
      if (result.ok) {
        toast.success("Request cancelled.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (
    existing &&
    (existing.status === "pending" || existing.status === "processing")
  ) {
    return (
      <section
        className={`rounded-card border p-5 shadow-card ${
          isExport
            ? "border-brand-line bg-white"
            : "border-status-cancelled/30 bg-status-cancelled/5"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-card ${
              isExport
                ? "bg-brand-accent text-brand-primary"
                : "bg-status-cancelled/15 text-status-cancelled"
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-base font-semibold text-brand-ink">
              {isExport
                ? "Data export requested"
                : "Account deletion requested"}
            </h2>
            <p className="mt-1 text-[13px] text-brand-mute">
              Requested{" "}
              {new Date(existing.created_at).toLocaleDateString("en-ZA", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              · status{" "}
              <span className="font-medium text-brand-ink">
                {existing.status}
              </span>
            </p>
            <p className="mt-2 text-[12.5px] text-brand-mute">
              POPIA gives us 30 days to fulfil this. We&apos;ll email you when
              it&apos;s ready.
            </p>
            {existing.status === "pending" ? (
              <button
                type="button"
                onClick={() => cancel(existing.id)}
                disabled={pending}
                className="mt-3 text-xs font-medium text-brand-mute underline-offset-2 hover:underline disabled:opacity-60"
              >
                {pending ? "Cancelling…" : "Cancel this request"}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`rounded-card border bg-white p-5 shadow-card ${
        isExport ? "border-brand-line" : "border-status-cancelled/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-card ${
            isExport
              ? "bg-brand-accent text-brand-primary"
              : "bg-status-cancelled/15 text-status-cancelled"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-base font-semibold text-brand-ink">
            {isExport ? "Export your data" : "Delete your account"}
          </h2>
          <p className="mt-1 text-[13px] text-brand-mute">
            {isExport
              ? "Get a copy of every piece of personal information Vilo holds about you — profile, bookings, messages, reviews. Delivered as JSON within 30 days."
              : "Permanently delete your account. Bookings, reviews, and messages tied to it are anonymised. Some data is retained where law requires (tax, dispute records)."}
          </p>

          <label className="mt-3 block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              {isExport ? "Anything to add (optional)" : "Reason (optional)"}
            </span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              placeholder={
                isExport
                  ? "Particular records you need? Let us know."
                  : "Tell us why so we can improve."
              }
              className="mt-1 block w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </label>

          {!isExport ? (
            <label className="mt-3 flex items-start gap-2 text-[12.5px] text-brand-dark">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
              />
              <span>
                I understand this is permanent and{" "}
                <strong>cannot be undone</strong>. Active bookings I&apos;m a
                host on must be completed or cancelled first.
              </span>
            </label>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={pending || (!isExport && !confirm)}
            className={`mt-4 inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
              isExport
                ? "bg-brand-primary hover:bg-brand-secondary"
                : "bg-status-cancelled hover:bg-status-cancelled/90"
            }`}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isExport ? "Request data export" : "Request account deletion"}
          </button>

          {!isExport ? (
            <p className="mt-3 flex items-start gap-1.5 text-[11px] text-brand-mute">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-status-cancelled" />
              <span>
                Per POPIA we may retain some records (financial, dispute) where
                law requires it. The bulk of your data is deleted.
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
