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
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md border border-brand-line bg-brand-light/50 px-3 py-2 font-mono text-xs text-brand-ink">
        {link}
      </code>
      <button
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-2 text-xs font-semibold text-white hover:bg-brand-secondary"
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
