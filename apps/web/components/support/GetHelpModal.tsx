"use client";

import { LifeBuoy, Loader2, Send } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SubmitSuccess } from "@/components/portal/SubmitSuccess";

import { submitHelpRequestAction, type HelpCategory } from "./actions";

/**
 * Reusable "Get help" trigger + modal for logged-in users. Files a ticket into
 * the Wielo Support thread (via submitHelpRequestAction) with a ticket number,
 * the source/context it was opened from, a free-text field, and a category.
 * Extensible: pass category="bug" from a future "Report a bug" entry point and
 * the same modal/action becomes a bug report. `className`/`children` style the
 * trigger so it drops in wherever a "Get help" button lives.
 */
export function GetHelpModal({
  category = "support",
  sourceLabel,
  context,
  bookingId,
  className,
  children,
  ariaLabel,
}: {
  category?: HelpCategory;
  /** Human source, e.g. "Trip · Seaview Cottage, Hermanus". */
  sourceLabel?: string | null;
  /** Structured context lines shown to support (booking ref, dates, …). */
  context?: { label: string; value: string }[];
  /** Booking the ticket relates to — links it onto the trip timeline. */
  bookingId?: string | null;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [ticket, setTicket] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  const isBug = category === "bug";
  const title = isBug ? "Report a bug" : "Get help";

  function reset() {
    setMessage("");
    setTicket(null);
  }

  function submit() {
    const text = message.trim();
    if (text.length < 5) {
      toast.error("Add a little more detail so we can help.");
      return;
    }
    start(async () => {
      const res = await submitHelpRequestAction({
        category,
        message: text,
        sourceLabel: sourceLabel ?? null,
        context: context ?? null,
        bookingId: bookingId ?? null,
      });
      if (res.ok) {
        setTicket(res.ticket);
        setMessage("");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <button type="button" aria-label={ariaLabel} className={className}>
          {children}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md gap-0 rounded-card border-brand-line bg-white p-0">
        {ticket ? (
          <SubmitSuccess
            title={isBug ? "Bug report filed" : "We're on it"}
            primaryHref="/portal/inbox"
            primaryLabel="Open Wielo Support"
            onClose={() => {
              setOpen(false);
              reset();
            }}
          >
            Ticket{" "}
            <span className="font-mono font-semibold text-brand-ink">
              {ticket}
            </span>{" "}
            is in the Wielo Support thread in your inbox — we&apos;ll reply
            there.
          </SubmitSuccess>
        ) : (
          <>
            <DialogHeader className="border-b border-brand-line px-5 py-4 text-left">
              <DialogTitle className="flex items-center gap-2 text-brand-ink">
                <LifeBuoy className="h-4 w-4 text-brand-primary" />
                {title}
              </DialogTitle>
              <DialogDescription className="text-brand-mute">
                {isBug
                  ? "Tell us what went wrong — it goes straight to the Wielo team."
                  : "Technical & account help from the Wielo team — we'll reply in your inbox."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 px-5 py-4">
              {!isBug ? (
                <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] leading-relaxed text-amber-800">
                  Please note: Wielo can&apos;t cancel or refund bookings —
                  those are arranged directly with your host. This ticket is for
                  technical or account support.
                </div>
              ) : null}
              {sourceLabel || (context && context.length > 0) ? (
                <div className="rounded-[10px] bg-brand-light/60 px-3 py-2.5 text-[12px] text-brand-mute">
                  {sourceLabel ? (
                    <div className="font-medium text-brand-ink">
                      {sourceLabel}
                    </div>
                  ) : null}
                  {(context ?? []).map((c) => (
                    <div key={c.label}>
                      <span className="text-brand-mute">{c.label}:</span>{" "}
                      <span className="text-brand-ink">{c.value}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <textarea
                autoFocus
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 4000))}
                placeholder={
                  isBug
                    ? "What happened? What did you expect instead?"
                    : "How can we help?"
                }
                className="block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-brand-line px-5 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {isBug ? "Send report" : "Send request"}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
