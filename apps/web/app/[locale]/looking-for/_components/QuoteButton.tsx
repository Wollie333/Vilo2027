"use client";

import { LogIn, MessageSquare, Sparkles } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * "Quote" call-to-action for a public Looking-For request.
 *
 * The quote intent is a single path — `/dashboard/looking-for/respond/[postId]`
 * — and every entry point carries it forward so the guest's first intent
 * survives the whole sign-in / sign-up journey:
 *
 *   • signed-in  → straight to the respond page (which gates host + live listing)
 *   • signed-out → a modal offering Sign in / Join, both with `?next=<intent>`
 *
 * The respond page is the ONE gate: it forwards a non-host to host signup
 * (again carrying `next`), and shows a friendly "finish your listing" state to
 * a brand-new host whose profile isn't live yet.
 */
export function QuoteButton({
  postId,
  authed,
  size = "sm",
  className,
}: {
  postId: string;
  authed: boolean;
  size?: "sm" | "lg";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const intent = `/dashboard/looking-for/respond/${postId}`;
  const encoded = encodeURIComponent(intent);

  const base = cn(
    "inline-flex items-center justify-center gap-1.5 rounded-pill bg-brand-primary font-semibold text-white transition-colors hover:bg-brand-primary/90",
    size === "lg" ? "w-full px-5 py-3 text-sm" : "px-4 py-2 text-xs",
    className,
  );

  if (authed) {
    return (
      <Link href={intent} className={base}>
        <MessageSquare className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} />
        Send a quote
      </Link>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={base}>
        <MessageSquare className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} />
        Send a quote
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-card border-brand-line bg-white p-0">
          <div className="p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent text-brand-primary">
              <MessageSquare className="h-6 w-6" />
            </div>
            <DialogHeader className="text-left">
              <DialogTitle className="font-display text-xl text-brand-ink">
                Sign in to send your quote
              </DialogTitle>
              <DialogDescription className="text-brand-mute">
                Quotes are sent by hosts. Sign in or join — we&apos;ll bring you
                right back to this request so you can quote in seconds.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-3">
              <Link
                href={`/login?next=${encoded}`}
                className="flex w-full items-center justify-center gap-2 rounded-pill bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90"
              >
                <LogIn className="h-4 w-4" />
                Sign in to quote
              </Link>
              <Link
                href={`/signup/host?next=${encoded}`}
                className="flex w-full items-center justify-center gap-2 rounded-pill border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-accent"
              >
                <Sparkles className="h-4 w-4 text-brand-primary" />
                Join as a host
              </Link>
            </div>

            <p className="mt-4 text-center text-xs text-brand-mute">
              New here? Joining sets up your host profile — once your first
              listing is live you can send quotes.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
