"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ProductLinkRow({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-brand-mute">
        {link.replace(/^https?:\/\//, "")}
      </code>
      <button
        onClick={copy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-[9px] border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
