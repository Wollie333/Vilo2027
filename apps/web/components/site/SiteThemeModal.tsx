"use client";

import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";

/**
 * A modal scoped to the ACTIVE site theme. Rendered INLINE (not portaled to
 * document.body) so it inherits the `--site-*` CSS variables from the enclosing
 * <SiteThemeRoot> through the DOM tree — `position: fixed` still pins it to the
 * viewport. This is the website equivalent of the app's Radix PolicyDialog, which
 * portals to <body> and would therefore render in the APP's brand styling instead
 * of the website's theme (the exact bug this component avoids). Use it for every
 * booking-flow overlay (T&Cs, date picker, progress) so the experience feels
 * native to the host's site.
 *
 * Mirrors the GalleryLightbox conventions: Escape to close, body scroll-lock
 * while open, overlay-click closes, content click is swallowed.
 */
export function SiteThemeModal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeLabel = "Close",
}: {
  open: boolean;
  onClose: () => void;
  /** Optional heading rendered in the themed header bar. */
  title?: ReactNode;
  children: ReactNode;
  /** Optional sticky footer (e.g. an accept/cancel button row). */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  closeLabel?: string;
}) {
  const labelId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxW =
    size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? labelId : undefined}
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--site-surface)",
          color: "var(--site-ink)",
          borderColor: "var(--site-line)",
          fontFamily: "var(--site-font-body)",
          borderRadius: "var(--site-radius)",
        }}
        className={`flex max-h-[92vh] w-full ${maxW} flex-col overflow-hidden border shadow-2xl`}
      >
        {/* header */}
        <div
          style={{ borderColor: "var(--site-line)" }}
          className="flex items-center justify-between gap-4 border-b px-5 py-3.5"
        >
          {title ? (
            <h2
              id={labelId}
              style={{
                fontFamily: "var(--site-font-heading)",
                color: "var(--site-ink)",
              }}
              className="text-base font-semibold"
            >
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            style={{ color: "var(--site-mute)" }}
            className="-mr-1 shrink-0 rounded-full p-1.5 transition-colors hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* body */}
        <div className="thin overflow-y-auto px-5 py-4 text-sm leading-relaxed">
          {children}
        </div>

        {/* footer */}
        {footer ? (
          <div
            style={{ borderColor: "var(--site-line)" }}
            className="border-t px-5 py-3.5"
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
