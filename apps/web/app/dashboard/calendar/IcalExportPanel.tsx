"use client";

import { Check, Copy, Rss } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function IcalExportPanel({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  function onCopy() {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        toast.success("Calendar URL copied");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Couldn't copy — copy it manually."));
  }

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <Rss className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-display text-base font-semibold text-brand-ink">
            iCal export
          </div>
          <p className="mt-1 text-sm text-brand-mute">
            Subscribe to this URL from Airbnb, Booking.com, Google Calendar or
            Apple Calendar to mirror Vilo&rsquo;s blocked dates. Re-syncs every
            few minutes.
          </p>

          <div className="mt-4 flex items-stretch overflow-hidden rounded border border-brand-line bg-brand-light/40">
            <code
              className="min-w-0 flex-1 overflow-x-auto px-3 py-2 font-mono text-[11px] text-brand-ink"
              aria-label="iCal export URL"
            >
              {url}
            </code>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1.5 border-l border-brand-line bg-white px-3 text-xs font-medium text-brand-ink transition-colors hover:bg-brand-accent"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </>
              )}
            </button>
          </div>

          <p className="mt-3 text-[11px] text-brand-mute">
            Anyone with this URL can read your blocked dates — don&rsquo;t share
            it publicly. Per-listing token rotation lands later.
          </p>
        </div>
      </div>
    </div>
  );
}
