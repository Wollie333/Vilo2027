"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Per-listing iCal export URLs, each copyable. The host pastes one of these into
// Airbnb / Booking.com / Google Calendar etc. to keep them in sync with Wielo.
// The URL + its signed token are computed server-side (page.tsx) — this component
// only renders + copies them (needs the clipboard API, hence a client component).
export type ExportUrl = { listingId: string; listingName: string; url: string };

export function ExportUrlList({ items }: { items: ExportUrl[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      toast.success("Export URL copied");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Couldn't copy — select the text and copy it manually.");
    }
  }

  if (items.length === 0) {
    return (
      <p className="mt-3 text-[13px] text-brand-mute">
        Publish a listing to get its export URL.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2.5">
      {items.map((it) => (
        <div key={it.listingId}>
          <div className="text-[11px] font-semibold text-brand-ink">
            {it.listingName}
          </div>
          <div className="mt-1 flex items-stretch gap-2">
            <input
              type="text"
              readOnly
              value={it.url}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={`iCal export URL for ${it.listingName}`}
              className="min-w-0 flex-1 truncate rounded border border-brand-line bg-brand-light/40 px-2.5 py-2 font-mono text-[11.5px] text-brand-mute"
            />
            <button
              type="button"
              onClick={() => copy(it.url, it.listingId)}
              aria-label={`Copy export URL for ${it.listingName}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-xs font-medium text-brand-ink transition hover:bg-brand-light"
            >
              {copied === it.listingId ? (
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
        </div>
      ))}
    </div>
  );
}
