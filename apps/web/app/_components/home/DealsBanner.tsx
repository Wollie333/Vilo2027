import { ArrowRight, Sparkles, Sun, Tag } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { formatMoney } from "@/lib/format";
import { loadFeaturedDeal } from "@/lib/specials/directory";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Copy built from a real deal's own fields — no AI, no hand-written per-deal
 * strings. Every line is derived from something the host actually filled in, so
 * it can never describe an offer that isn't on the deals page.
 */
function dealCopy(deal: {
  title: string;
  badge: string | null;
  savingsPct: number | null;
  perNightPrice: number | null;
  flatTotal: number | null;
  priceMode: "flat" | "per_night";
  currency: string;
  propertyName: string;
  propertyCity: string | null;
  remaining: number;
}) {
  const place = deal.propertyCity
    ? `${deal.propertyName}, ${deal.propertyCity}`
    : deal.propertyName;

  const price =
    deal.priceMode === "per_night" && deal.perNightPrice != null
      ? `${formatMoney(deal.perNightPrice, deal.currency)} a night`
      : deal.flatTotal != null
        ? `${formatMoney(deal.flatTotal, deal.currency)} for the stay`
        : null;

  // Lead with the strongest true fact available, in that order.
  const lead =
    deal.savingsPct != null && deal.savingsPct > 0
      ? `Save ${Math.round(deal.savingsPct)}% at ${place}`
      : price
        ? `${place} — ${price}`
        : place;

  // Scarcity only when it is genuinely scarce; never invented.
  const urgency =
    deal.remaining > 0 && deal.remaining <= 5
      ? ` Only ${deal.remaining} left.`
      : "";

  return {
    badge: deal.badge?.trim() || "Host deal",
    heading: deal.title,
    body: `${lead}.${urgency} Booked direct with the host — no booking fees, no middle-man.`,
    cta: "Browse host deals & specials",
  };
}

export async function DealsBanner() {
  const t = await getTranslations("home");
  // Falls back to the evergreen card when there is no live deal to show, so the
  // home page never renders a hole where an offer used to be.
  const deal = await loadFeaturedDeal(createAdminClient()).catch(() => null);
  const copy = deal ? dealCopy(deal) : null;

  return (
    <section className="border-b border-brand-line">
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
          <div className="relative min-h-[280px] overflow-hidden rounded-card border border-brand-line lg:col-span-7">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                deal?.heroUrl ??
                "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=1200&q=80&auto=format&fit=crop"
              }
              alt={copy ? copy.heading : "Summer at the coast"}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
            <div className="relative max-w-lg p-8 text-white lg:p-10">
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                {copy ? (
                  <Tag className="h-3 w-3" />
                ) : (
                  <Sun className="h-3 w-3" />
                )}{" "}
                {copy ? copy.badge : t("dealsBadge")}
              </span>
              <h3 className="mt-4 font-display text-2xl font-bold leading-tight md:text-3xl">
                {copy ? copy.heading : t("dealsTitle")}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-white/85">
                {copy ? copy.body : t("dealsBody")}
              </p>
              <a
                href="/deals"
                className="mt-5 inline-flex items-center gap-1.5 rounded bg-white px-4 py-2.5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent"
              >
                {copy ? copy.cta : t("dealsCta")}{" "}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="brand-gradient relative overflow-hidden rounded-card p-8 text-white lg:col-span-5 lg:p-10">
            <div
              aria-hidden
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.25) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white ring-1 ring-white/20 backdrop-blur">
                <Sparkles className="h-3 w-3" /> {t("groupBadge")}
              </span>
              <h3 className="mt-4 font-display text-2xl font-bold leading-tight md:text-3xl">
                {t("groupTitle")}
              </h3>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/90">
                {t("groupBody")}
              </p>
              <a
                href="/looking-for/start"
                className="mt-5 inline-flex items-center gap-1.5 rounded bg-white px-4 py-2.5 text-sm font-medium text-brand-secondary transition-colors hover:bg-brand-accent"
              >
                {t("groupCta")} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
