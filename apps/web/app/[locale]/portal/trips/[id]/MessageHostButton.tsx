"use client";

import { Loader2, MessageSquare, Send } from "lucide-react";
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
import { SubmitSuccess } from "@/components/portal/SubmitSuccess";

import { messageHostAboutBookingAction } from "./actions";

/**
 * "Message host" trigger + compose modal. Replaces the old `/portal/inbox` link
 * on the trip page and trip cards — the guest writes a message inline and it's
 * posted straight into the booking's host↔guest thread (resolving/creating the
 * thread), plus a host notification. `className`/`children` style the trigger so
 * the same component covers the full-width CTA and the icon-only card button.
 */
export function MessageHostButton({
  bookingId,
  hostFirstName,
  className,
  children,
  ariaLabel,
}: {
  bookingId: string;
  hostFirstName?: string | null;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [pending, start] = React.useTransition();

  const who = hostFirstName?.trim() || "your host";

  function close() {
    setOpen(false);
    // Reset after the close animation, then refresh so any thread state updates.
    setSent(false);
    setBody("");
    router.refresh();
  }

  function submit() {
    const text = body.trim();
    if (text.length < 1) {
      toast.error("Type a message first.");
      return;
    }
    start(async () => {
      const res = await messageHostAboutBookingAction({
        bookingId,
        body: text,
      });
      if (res.ok) {
        setSent(true);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) setOpen(true);
        else close();
      }}
    >
      <DialogTrigger asChild>
        <button type="button" aria-label={ariaLabel} className={className}>
          {children}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md gap-0 rounded-card border-brand-line bg-white p-0">
        {sent ? (
          <SubmitSuccess
            title={`Message sent to ${who}`}
            primaryHref="/portal/inbox"
            primaryLabel="Open inbox"
            onClose={close}
          >
            {who} will see it in your booking thread and reply there.
          </SubmitSuccess>
        ) : (
          <>
            <DialogHeader className="border-b border-brand-line px-5 py-4 text-left">
              <DialogTitle className="flex items-center gap-2 text-brand-ink">
                <MessageSquare className="h-4 w-4 text-brand-primary" />
                Message {who}
              </DialogTitle>
              <DialogDescription className="text-brand-mute">
                Your message goes straight to {who} and appears in your inbox
                thread.
              </DialogDescription>
            </DialogHeader>
            <div className="px-5 py-4">
              <textarea
                autoFocus
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 4000))}
                placeholder={`Ask ${who} a question about your stay…`}
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
                Send message
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
