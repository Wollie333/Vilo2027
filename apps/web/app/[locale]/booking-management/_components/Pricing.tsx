"use client";

import { ArrowRight, Check } from "lucide-react";

import { useBrandName } from "@/components/brand/BrandProvider";
import type { CatalogProduct } from "@/lib/products/getProducts";

const CYCLE_LABEL: Record<string, string> = {
  weekly: "week",
  monthly: "month",
  quarterly: "quarter",
  biannual: "6 months",
  annual: "year",
};

function rand(n: number): string {
  return "R " + Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
}

// CTA: free products start signup directly; paid products go to their standalone
// page (/p/[slug]) which collects payment then routes into the signup flow.
function ctaFor(p: CatalogProduct): { href: string; label: string } {
  if (p.isFree) return { href: "/signup/host", label: "Get started free" };
  const href = p.slug ? `/p/${p.slug}` : "/signup/host";
  const label =
    p.trialDays > 0 ? `Start ${p.trialDays}-day trial` : "Subscribe";
  return { href, label };
}

export function Pricing({ products }: { products: CatalogProduct[] }) {
  const brandName = useBrandName();

  return (
    <section id="pricing" className="border-b border-brand-line bg-white">
      <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Pricing
          </div>
          <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
            Flat fee. Forever.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-brand-mute">
            No commissions, no per-booking nibbling. Pick the plan that fits —
            change or cancel any time.
          </p>
        </div>

        {products.length === 0 ? (
          <p className="text-center text-brand-mute">
            Plans are being set up — check back shortly.
          </p>
        ) : (
          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 md:grid-cols-3 lg:gap-5">
            {products.map((p) => {
              const isPopular = p.isRecommended;
              const cta = ctaFor(p);
              const cycle = CYCLE_LABEL[p.billingCycle ?? "monthly"] ?? "month";
              return (
                <div
                  key={p.id}
                  className={
                    isPopular
                      ? "relative flex flex-col rounded-card border-2 border-brand-primary bg-brand-light p-7 shadow-card"
                      : "flex flex-col rounded-card border border-brand-line bg-white p-7"
                  }
                >
                  {isPopular ? (
                    <span className="ribbon absolute -top-3 left-1/2 -translate-x-1/2 rounded-pill px-3 py-1 text-[10px] font-bold tracking-wider">
                      MOST POPULAR
                    </span>
                  ) : null}

                  <div>
                    <div
                      className={`text-[11px] font-semibold uppercase tracking-wider ${
                        isPopular ? "text-brand-primary" : "text-brand-mute"
                      }`}
                    >
                      {p.name}
                    </div>
                    {p.description ? (
                      <div className="mt-1 font-display text-lg font-bold leading-snug text-brand-dark">
                        {p.description}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="num-display font-display text-5xl font-bold text-brand-dark">
                      {p.isFree ? "Free" : rand(p.price)}
                    </span>
                    {!p.isFree ? (
                      <span className="text-sm text-brand-mute">/{cycle}</span>
                    ) : null}
                  </div>
                  <div className="mt-1 min-h-[18px] text-xs text-brand-mute">
                    {p.trialDays > 0
                      ? `${p.trialDays}-day free trial`
                      : p.isFree
                        ? "No card required"
                        : ""}
                    {p.setupFee > 0
                      ? ` · ${rand(p.setupFee)} ${p.setupFeeLabel || "setup"} once-off`
                      : ""}
                  </div>

                  <a
                    href={cta.href}
                    className={
                      isPopular
                        ? "mt-6 inline-flex items-center justify-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 font-medium text-white transition-colors hover:bg-brand-dark"
                        : "mt-6 inline-flex items-center justify-center gap-1.5 rounded border border-brand-primary px-4 py-2.5 font-medium text-brand-primary transition-colors hover:bg-brand-accent"
                    }
                  >
                    {cta.label}
                    {isPopular ? <ArrowRight className="h-4 w-4" /> : null}
                  </a>

                  <ul className="mt-7 space-y-3 text-sm text-brand-dark">
                    {p.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                        <span>{b.replace(/Vilo/g, brandName)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
