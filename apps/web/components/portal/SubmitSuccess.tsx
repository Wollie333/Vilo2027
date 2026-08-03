"use client";

import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Shared "…sent" confirmation shown INSIDE a modal after a guest submits a
 * request (support ticket, message, date change, add-on, refund). Replaces the
 * old toast + router.refresh() (which could error out mid-navigation). Gives a
 * clear primary action (open the thread it landed in) + a Close that returns to
 * the trip and refreshes the page then — so the refresh never blocks the success
 * screen.
 */
export function SubmitSuccess({
  title,
  children,
  primaryHref,
  primaryLabel = "Open inbox",
  onClose,
}: {
  title: string;
  children?: ReactNode;
  /** Where the primary button navigates (the thread this landed in). */
  primaryHref: string;
  primaryLabel?: string;
  /** Called on Close — the caller closes the modal (and may refresh). */
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <div className="px-6 py-8 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-brand-primary" />
      <div className="mt-3 font-display text-[16px] font-bold text-brand-ink">
        {title}
      </div>
      {children ? (
        <div className="mx-auto mt-1.5 max-w-xs text-[13px] text-brand-mute">
          {children}
        </div>
      ) : null}
      <div className="mt-5 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] font-medium text-brand-ink hover:bg-brand-light"
        >
          Close
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            router.push(primaryHref);
          }}
          className="rounded-[10px] bg-brand-primary px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-secondary"
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
