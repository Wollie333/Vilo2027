"use client";

import { CalendarRange } from "lucide-react";

import {
  SeasonalPricingManager,
  type ListingGroup,
  type SeasonalRule,
} from "../../seasonal-pricing/SeasonalPricingManager";

// Seasonal pricing setup step — reuses the canonical seasonal manager (the same
// one at /dashboard/seasonal-pricing) scoped to the listing being set up. Rules
// created here flow through the whole booking price engine: the server-side
// recalc applies them per-night at checkout, on quotes and on the /pay link
// (see lib/pricing/engine.ts → priceStay). This step is optional — a host can
// skip it and add seasons later.
export function StepSeasonal({
  listing,
  rules,
  onContinue,
}: {
  listing: ListingGroup;
  rules: SeasonalRule[];
  onContinue: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-card border border-brand-line bg-brand-light/40 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
          <CalendarRange className="h-4 w-4" />
        </div>
        <p className="text-[13px] leading-relaxed text-brand-mute">
          Charge more over peak dates (December, Easter, long weekends) and less
          in the quiet season. Seasonal rates override your base rate for the
          dates you choose and are applied automatically when a guest books
          those nights — a stay that spans in-season and out-of-season nights is
          priced night by night. This step is optional; you can add seasons any
          time from the dashboard.
        </p>
      </div>

      <SeasonalPricingManager
        listings={[listing]}
        initialRules={rules}
        embedded
      />

      <div className="flex items-center justify-end border-t border-brand-line pt-5">
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-secondary"
        >
          Save &amp; continue
        </button>
      </div>
    </div>
  );
}
