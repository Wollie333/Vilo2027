"use client";

import { Check, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useBrandName } from "@/components/brand/BrandProvider";
import type { CatalogProduct } from "@/lib/products/getProducts";

import { switchToProductAction } from "./actions";
import { formatZar } from "./plans";

type Props = {
  // The admin PRODUCTS catalog (exactly what's active + visible) — the source of
  // truth for what a host can be on. Mirrors the signup wizard's toolkit step.
  products: ReadonlyArray<CatalogProduct>;
  currentProductId: string | null;
};

const CYCLE_LABEL: Record<string, string> = {
  weekly: "week",
  monthly: "month",
  quarterly: "quarter",
  biannual: "6 months",
  annual: "year",
};

export function PlanPicker({ products, currentProductId }: Props) {
  const router = useRouter();
  const brandName = useBrandName();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Upgrade-only: the host can move to a higher-priced plan, but a downgrade (a
  // cheaper plan) is admin-only. Compare against the current plan's price.
  const currentPrice =
    products.find((p) => p.id === currentProductId)?.price ?? 0;

  function switchTo(product: CatalogProduct) {
    if (product.id === currentProductId) {
      toast.info("You're already on this plan.");
      return;
    }
    if (product.price < currentPrice) {
      toast.error(
        "Downgrades are handled by our team — message Wielo support to move to a lower plan.",
      );
      return;
    }
    setPendingId(product.id);
    start(async () => {
      const res = await switchToProductAction({ productId: product.id });
      if (res.ok && res.redirectUrl) {
        // Paid product → hand off to Paystack; activation lands on return.
        window.location.href = res.redirectUrl;
        return;
      }
      setPendingId(null);
      if (res.ok) {
        toast.success(`Switched to ${product.name}.`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  if (products.length === 0) {
    return (
      <section className="rounded-card border border-dashed border-brand-line bg-white p-6 text-sm text-brand-mute shadow-card">
        No plans are available right now. Check back soon.
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <h2 className="font-display text-base font-bold text-brand-ink">
        Switch plan
      </h2>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((p) => {
          const isCurrent = p.id === currentProductId;
          const isDowngrade = !isCurrent && p.price < currentPrice;
          const cycle = CYCLE_LABEL[p.billingCycle ?? "monthly"] ?? "month";
          const submitting = pendingId === p.id && pending;

          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-card border bg-white p-5 shadow-card transition-shadow ${
                isCurrent
                  ? "border-brand-primary ring-1 ring-brand-primary/30"
                  : p.isRecommended
                    ? "border-brand-primary/60"
                    : "border-brand-line"
              }`}
            >
              {p.isRecommended ? (
                <span className="absolute -top-2 right-4 inline-flex items-center gap-1 rounded-pill bg-brand-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm">
                  <Sparkles className="h-3 w-3" />
                  Popular
                </span>
              ) : null}

              <div className="font-display text-base font-semibold text-brand-ink">
                {p.name}
              </div>
              {p.description ? (
                <p className="mt-1 min-h-[32px] text-[12.5px] text-brand-mute">
                  {p.description}
                </p>
              ) : null}

              <div className="mt-4">
                {p.isFree ? (
                  <div className="font-display text-2xl font-bold text-brand-ink">
                    Free
                  </div>
                ) : (
                  <div className="font-display text-2xl font-bold text-brand-ink">
                    {formatZar(p.price)}
                    <span className="text-sm font-medium text-brand-mute">
                      {" "}
                      / {cycle}
                    </span>
                  </div>
                )}
              </div>

              <ul className="mt-4 flex-1 space-y-2 text-[13px] text-brand-dark">
                {p.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                    <span>{b.replace("Wielo", brandName)}</span>
                  </li>
                ))}
              </ul>

              {isDowngrade ? (
                <a
                  href="/support"
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded border border-brand-line bg-white px-3 py-2 text-sm font-semibold text-brand-mute transition-colors hover:bg-brand-light"
                  title="Downgrades are handled by Wielo support"
                >
                  Contact support to switch
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => switchTo(p)}
                  disabled={isCurrent || pending}
                  className={`mt-5 inline-flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    p.isRecommended && !isCurrent
                      ? "bg-brand-primary text-white hover:bg-brand-secondary"
                      : "border border-brand-line bg-white text-brand-ink hover:bg-brand-light"
                  }`}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {isCurrent
                    ? "Current plan"
                    : p.isFree
                      ? `Switch to ${p.name}`
                      : `Upgrade to ${p.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[12px] text-brand-mute">
        Upgrades are instant — paid plans hand off to secure checkout and your
        features update as soon as payment is confirmed. To move to a lower plan
        or cancel, message Wielo support.
      </p>
    </section>
  );
}
