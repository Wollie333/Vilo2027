"use client";

import {
  Check,
  Copy,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  Star,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { sendDocumentLinkAction } from "@/app/[locale]/dashboard/documents-actions";
import { requestReviewsAction } from "@/app/[locale]/dashboard/reviews/actions";

/**
 * Host-facing "Send review link" surface on a completed booking. The link is
 * the public token-gated /review/[id] page; the host copies it, fires a
 * pre-filled WhatsApp / email, or drops it into the guest's inbox thread.
 * Shown only once the stay is completed and no review exists yet. (Guests are
 * also emailed this automatically 5 min after checkout — this is the manual
 * resend.)
 */
export function ReviewLinkCard({
  bookingId,
  url,
  reference,
  listingName,
  guestName,
  guestEmail,
  guestPhone,
}: {
  bookingId: string;
  url: string;
  reference: string;
  listingName: string;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [sending, startSending] = useTransition();
  const [requesting, startRequesting] = useTransition();

  // Fire the full review request (email + in-app + thread card) — the same flow
  // the automatic 5-min-after-checkout send uses, and the bulk modal elsewhere.
  function sendRequest() {
    startRequesting(async () => {
      const r = await requestReviewsAction([bookingId]);
      if (!r.ok) {
        toast.error(r.error);
      } else if (r.sent > 0) {
        toast.success("Review request sent.");
        router.refresh();
      } else {
        toast.error("Couldn't send — this stay may not qualify.");
      }
    });
  }

  function sendToChat() {
    startSending(async () => {
      const r = await sendDocumentLinkAction({
        bookingId,
        url,
        label: "review link",
      });
      if (r.ok) toast.success("Review link sent to the guest's inbox.");
      else toast.error(r.error);
    });
  }

  const greeting = guestName ? `Hi ${guestName.split(" ")[0]}, ` : "";
  const message =
    `${greeting}hope you enjoyed your stay at ${listingName} (booking ${reference}). ` +
    `Would you mind leaving a quick review? It takes about 30 seconds and you can add photos: ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Review link copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy the link manually.");
    }
  }

  const waDigits = (guestPhone ?? "").replace(/\D/g, "");
  const waHref = `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`;
  const mailHref =
    `mailto:${guestEmail ?? ""}` +
    `?subject=${encodeURIComponent(`How was your stay at ${listingName}?`)}` +
    `&body=${encodeURIComponent(message)}`;

  return (
    <div className="rounded-card border border-brand-line bg-brand-light/30">
      <div className="flex items-center gap-2 border-b border-brand-line px-4 py-3">
        <Star className="h-4 w-4 text-brand-secondary" />
        <div className="font-display text-sm font-semibold text-brand-ink">
          Review link
        </div>
      </div>

      <div className="space-y-3 p-4">
        <p className="text-xs text-brand-mute">
          Invite this guest to review their stay. The link is unique to this
          booking and works without a {listingName} account — guests can rate,
          write a review and add photos.
        </p>

        <button
          type="button"
          onClick={sendRequest}
          disabled={requesting}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded bg-brand-primary px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          {requesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Star className="h-4 w-4" />
          )}
          Send review request
        </button>

        <div className="relative py-1 text-center">
          <span className="bg-brand-light/30 px-2 text-[10.5px] uppercase tracking-wider text-brand-mute">
            or share the link
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded border border-brand-line bg-white px-3 py-2 font-mono text-xs text-brand-ink"
          />
          <button
            type="button"
            onClick={copy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-xs font-semibold text-brand-ink transition hover:bg-brand-accent"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-status-confirmed" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-secondary"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Send on WhatsApp
          </a>
          <a
            href={mailHref}
            className={`inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3.5 py-2 text-xs font-semibold text-brand-ink transition hover:bg-brand-accent ${
              guestEmail ? "" : "pointer-events-none opacity-50"
            }`}
            aria-disabled={!guestEmail}
          >
            <Mail className="h-3.5 w-3.5" /> Email the link
          </a>
          <button
            type="button"
            onClick={sendToChat}
            disabled={sending}
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3.5 py-2 text-xs font-semibold text-brand-ink transition hover:bg-brand-accent disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send in chat
          </button>
        </div>
      </div>
    </div>
  );
}
