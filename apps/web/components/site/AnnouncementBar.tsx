"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import type { SiteConversion } from "@/lib/site/types";

/**
 * Dismissible announcement bar (Phase 6A slice 2). A slim full-width strip above
 * the header with optional CTA link. Dismissal is remembered in `localStorage`
 * keyed by the message content, so editing the text re-shows the bar. Themed via
 * `--site-*` (accent surface). Rendered nothing until enabled with text.
 *
 * In preview mode (`preview`) it always shows and never persists dismissal, so
 * the host sees their edit in the live builder preview.
 */
export function AnnouncementBar({
  announcement,
  preview = false,
}: {
  announcement?: SiteConversion["announcement"];
  preview?: boolean;
}) {
  const text = announcement?.enabled ? announcement.text?.trim() : "";
  const linkLabel = announcement?.linkLabel?.trim();
  const linkHref = announcement?.linkHref?.trim();
  // Stable per-message key so a new message re-appears after a prior dismissal.
  const storageKey = `wielo-ann:${(text ?? "").slice(0, 64)}`;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (preview || !text) return;
    try {
      if (window.localStorage.getItem(storageKey) === "1") setDismissed(true);
    } catch {
      // localStorage may be unavailable (private mode) — just keep showing.
    }
  }, [preview, text, storageKey]);

  if (!text || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    if (preview) return;
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
  }

  const showLink = linkLabel && linkHref && /^(https?:\/\/|\/)/i.test(linkHref);

  return (
    <div
      style={{
        background: "var(--site-accent)",
        color: "var(--site-accent-ink)",
      }}
      className="relative px-5 py-2 text-center text-[13px] font-medium"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-1 pr-6">
        <span>{text}</span>
        {showLink ? (
          <a
            href={linkHref}
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            {linkLabel}
          </a>
        ) : null}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 transition-opacity hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
