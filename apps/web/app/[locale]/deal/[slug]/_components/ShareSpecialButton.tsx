"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Copies this deal's public, account-less link (/deal/[slug]) so the host
 * — or a guest — can pass the deal around. localePrefix is "as-needed" so the
 * default-locale URL is unprefixed and clean. Mirrors the row-menu copy action
 * in the Specials manager and the PaymentLinkCard copy pattern.
 */
export function ShareSpecialButton({
  slug,
  label,
  copiedLabel,
  copiedToast,
  errorToast,
}: {
  slug: string;
  label: string;
  copiedLabel: string;
  copiedToast: string;
  errorToast: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/deal/${slug}`,
      );
      setCopied(true);
      toast.success(copiedToast);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(errorToast);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 py-1.5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Share2 className="h-3.5 w-3.5" />
      )}
      {copied ? copiedLabel : label}
    </button>
  );
}
