"use client";

import { Loader2, Tag, X } from "lucide-react";
import { useState, useTransition } from "react";

import { formatMoney } from "@/lib/format";

import { previewSignupPromoAction } from "./actions";

export type AppliedPromo = { code: string; discount: number; total: number };

/**
 * Promo code entry on the signup plan step. This step hands the host straight to
 * the card form, so the code has to be captured BEFORE the order exists — the
 * preview here is cosmetic and the real discount is re-resolved server-side when
 * the order is created (startSignupCheckoutAction), so nothing here sets a price.
 */
export function SignupPromoField({
  slug,
  applied,
  onApplied,
  onRemoved,
}: {
  slug: string;
  applied: AppliedPromo | null;
  onApplied: (promo: AppliedPromo) => void;
  onRemoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function apply() {
    setError(null);
    start(async () => {
      const r = await previewSignupPromoAction(slug, code);
      if (r.ok) {
        onApplied({ code: r.code, discount: r.discount, total: r.total });
        setCode("");
        setOpen(false);
      } else {
        setError(r.error);
      }
    });
  }

  if (applied) {
    return (
      <div className="mt-5 flex items-center justify-between gap-2 rounded-card border border-brand-primary bg-white p-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand-ink">
            <Tag className="h-4 w-4 shrink-0 text-brand-primary" />
            <span className="truncate">“{applied.code}” applied</span>
          </div>
          <div className="mt-1 text-xs text-brand-mute">
            {formatMoney(applied.discount, "ZAR")} off — you’ll pay{" "}
            {formatMoney(applied.total, "ZAR")} at checkout.
          </div>
        </div>
        <button
          type="button"
          onClick={onRemoved}
          aria-label="Remove promo code"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-5 inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-brand-primary underline-offset-4 hover:underline"
      >
        <Tag className="h-4 w-4" />
        Have a promo code?
      </button>
    );
  }

  return (
    <div className="mt-5">
      <div className="flex max-w-sm gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.trim() && !pending) apply();
          }}
          placeholder="Promo code"
          autoFocus
          aria-label="Promo code"
          className="min-w-0 flex-1 rounded-md border border-brand-line bg-white px-3 py-3 text-base uppercase tracking-wide text-brand-ink outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-brand-mute focus:border-brand-primary"
        />
        <button
          type="button"
          onClick={apply}
          disabled={pending || !code.trim()}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-brand-line bg-white px-4 text-sm font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </button>
      </div>
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
