"use client";

import { CheckCircle2, LifeBuoy, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
        router.refresh();
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
          <div className="px-6 py-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-brand-primary" />
            <div className="mt-3 text-[15px] font-semibold text-brand-ink">
              {isBug ? "Bug report filed" : "We're on it"}
            </div>
            <p className="mx-auto mt-1.5 max-w-xs text-[13px] text-brand-mute">
              Your ticket{" "}
              <span className="font-mono font-semibold text-brand-ink">
                {ticket}
              </span>{" "}
              is in the Wielo Support thread in your inbox — we'll reply there.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] font-medium text-brand-ink hover:bg-brand-light"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                  router.push("/portal/inbox");
                }}
                className="rounded-[10px] bg-brand-primary px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-secondary"
              >
                Open inbox
              </button>
            </div>
          </div>
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
                  : "Ask the Wielo team anything — we'll reply in your inbox."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 px-5 py-4">
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
