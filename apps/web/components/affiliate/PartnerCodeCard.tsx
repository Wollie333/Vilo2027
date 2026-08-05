"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// A compact, self-contained card showing an affiliate's shareable identifiers:
// the 5-digit PARTNER CODE (number) and their username/handle (slug). A referred
// host can be attributed by EITHER — both are copyable. Reused on the admin
// affiliate record (top-right) and, via the affiliate shell, every page of the
// partner's own portal.
export function PartnerCodeCard({
  partnerNumber,
  slug,
  className = "",
}: {
  partnerNumber: string;
  slug: string;
  className?: string;
}) {
  const [copied, setCopied] = useState<"code" | "handle" | null>(null);

  async function copy(value: string, which: "code" | "handle") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      toast.success(
        which === "code" ? "Partner code copied" : "Username copied",
      );
      setTimeout(() => setCopied(null), 1500);
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
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[15px] font-bold tracking-wide text-brand-ink">
            {partnerNumber}
          </span>
          <button
            type="button"
            onClick={() => copy(partnerNumber, "code")}
            aria-label="Copy partner code"
            className="shrink-0 rounded border border-brand-line bg-white p-1 text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
          >
            {copied === "code" ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={() => copy(slug, "handle")}
          title="Copy username"
          className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-brand-mute transition hover:text-brand-ink"
        >
          <span className="truncate">@{slug}</span>
          {copied === "handle" ? (
            <Check className="h-2.5 w-2.5" />
          ) : (
            <Copy className="h-2.5 w-2.5" />
          )}
        </button>
      </div>
    </div>
  );
}
