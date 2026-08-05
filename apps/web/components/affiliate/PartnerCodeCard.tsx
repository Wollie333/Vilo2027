"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// A compact, self-contained card showing an affiliate's bare PARTNER CODE (their
// slug) with one-tap copy. Reused wherever the code should always be to hand:
// the admin affiliate record (top-right), and — via the affiliate shell — every
// page of the partner's own portal. The code is what a referred host types into
// signup's "Referred by" field.
export function PartnerCodeCard({
  slug,
  className = "",
}: {
  slug: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(slug);
      setCopied(true);
      toast.success("Partner code copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  }

  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-[11px] border border-brand-accent bg-brand-light/60 px-3 py-2 ${className}`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-brand-primary">
        <KeyRound className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-brand-mute">
          Partner code
        </div>
        <div className="truncate font-mono text-[13.5px] font-semibold text-brand-ink">
          {slug}
        </div>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy partner code"
        className="shrink-0 rounded-md border border-brand-line bg-white p-1.5 text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
