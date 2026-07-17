"use client";

import { Loader2, Tag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";

import { applyPromoCodeAction, removePromoCodeAction } from "./actions";

// Promo code entry on the Wielo product pay page. The server re-prices the order
// row, so this component never computes money — it applies, then refreshes and
// lets the page re-render the authoritative amount.
export function PromoCodeField({
  token,
  applied,
}: {
  token: string;
  applied: { code: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function apply() {
    setError(null);
    start(async () => {
      const r = await applyPromoCodeAction(token, code);
      if (r.ok) {
        setCode("");
        setOpen(false);
        toast.success(
          `Promo code applied — you saved ${formatMoney(r.discount, "ZAR")}`,
        );
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  function remove() {
    start(async () => {
      const r = await removePromoCodeAction(token);
      if (r.ok) {
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-card border border-brand-line bg-brand-light/40 px-4 py-3">
        <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-brand-ink">
          <Tag className="h-4 w-4 shrink-0 text-brand-secondary" />
          <span className="truncate">Promo code “{applied.code}” applied</span>
        </span>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          aria-label="Remove promo code"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-brand-mute transition hover:bg-white hover:text-brand-ink disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-brand-secondary underline-offset-4 hover:underline"
      >
        <Tag className="h-4 w-4" />
        Have a promo code?
      </button>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.trim() && !pending) apply();
          }}
          placeholder="Promo code"
          autoFocus
          aria-label="Promo code"
          className="min-w-0 flex-1 rounded-md border border-brand-line bg-white px-3 py-3 text-base uppercase tracking-wide text-brand-ink outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-brand-mute focus:border-brand-secondary"
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
