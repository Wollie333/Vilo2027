"use client";

import {
  ArrowRight,
  Check,
  Info,
  Lightbulb,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import {
  STRENGTH_BAND_LABEL,
  type ListingStrength,
  type StrengthBand,
} from "@/lib/search/listingStrength";

const BAND_STYLES: Record<StrengthBand, { ring: string; text: string }> = {
  strong: { ring: "text-brand-primary", text: "text-brand-primary" },
  good: { ring: "text-brand-secondary", text: "text-brand-secondary" },
  building: { ring: "text-amber-500", text: "text-amber-600" },
  weak: { ring: "text-brand-mute", text: "text-brand-mute" },
};

function ScoreRing({ score, band }: { score: number; band: StrengthBand }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          className="text-brand-line"
        />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className={BAND_STYLES[band].ring}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-extrabold text-brand-ink">
          {score}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-mute">
          / 100
        </span>
      </div>
    </div>
  );
}

/**
 * The transparent Listing Strength card. Presentational — rendered full-page
 * from `/dashboard/properties/[id]/strength`. Two columns on desktop (score +
 * components on the left, coachable quick-wins on the right) so it has room to
 * breathe. Each "Fix" links into the listing editor at the exact tab that
 * resolves it, so ranking stays separate from listing setup.
 */
export function ListingStrengthCard({
  strength,
  listingId,
}: {
  strength: ListingStrength;
  listingId: string;
}) {
  const { score, band, components, checklist, keywordTip, openWins } = strength;
  const editHref = (tab: string) =>
    `/dashboard/properties/${listingId}/edit?tab=${tab}`;

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      {/* Left column — the score and what drives it */}
      <div className="space-y-5">
        {/* Headline */}
        <div className="flex flex-col gap-4 rounded-card border border-brand-line bg-white p-5 sm:flex-row sm:items-center">
          <ScoreRing score={score} band={band} />
          <div className="min-w-0">
            <div className={`text-sm font-semibold ${BAND_STYLES[band].text}`}>
              {STRENGTH_BAND_LABEL[band]}
            </div>
            <p className="mt-1 text-[13.5px] leading-relaxed text-brand-mute">
              How this listing ranks in the Wielo search directory — built only
              from signals you earn or control.{" "}
              {openWins > 0 ? (
                <span className="font-semibold text-brand-ink">
                  {openWins} quick {openWins === 1 ? "win" : "wins"} still open.
                </span>
              ) : (
                <>Every quick win is complete — keep earning great reviews.</>
              )}
            </p>
          </div>
        </div>

        {/* The ethical promise, stated plainly */}
        <div className="flex items-start gap-2.5 rounded-card border border-brand-primary/20 bg-brand-accent/40 p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
          <p className="text-[13px] leading-relaxed text-brand-ink">
            <span className="font-semibold">
              Ranking is earned, not bought.
            </span>{" "}
            Your subscription plan has no effect on your position — every host
            competes on the quality and completeness of their listing.
          </p>
        </div>

        {/* Component breakdown */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-brand-ink">
            What makes up your score
          </h3>
          <div className="space-y-3">
            {components.map((comp) => (
              <div
                key={comp.key}
                className="rounded-card border border-brand-line bg-white p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-brand-ink">
                    {comp.label}
                  </span>
                  <span className="shrink-0 rounded-pill bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand-mute">
                    {comp.weightPct}% of score
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand-light">
                  <div
                    className="h-full rounded-full bg-brand-primary transition-all"
                    style={{ width: `${comp.pct}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[12.5px] text-brand-mute">
                  {comp.tip}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right column — the coachable quick wins */}
      <div className="space-y-5">
        {/* Quick wins — the coachable, host-controlled part */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-primary" />
            <h3 className="text-sm font-semibold text-brand-ink">
              Quick wins {openWins > 0 ? `(${openWins} to go)` : "(all done!)"}
            </h3>
          </div>
          <ul className="divide-y divide-brand-line overflow-hidden rounded-card border border-brand-line bg-white">
            {checklist.map((item) => (
              <li key={item.key} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    item.done
                      ? "bg-brand-primary text-white"
                      : "border border-brand-line bg-brand-light text-brand-mute"
                  }`}
                >
                  {item.done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <span className="text-[11px] font-bold">
                      {item.impact === "high" ? "★" : ""}
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm font-medium ${
                      item.done
                        ? "text-brand-mute line-through"
                        : "text-brand-ink"
                    }`}
                  >
                    {item.label}
                  </div>
                  <div className="text-[12.5px] text-brand-mute">
                    {item.hint}
                  </div>
                </div>
                {!item.done ? (
                  <Link
                    href={editHref(item.tab)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-brand-primary/30 px-3 py-1.5 text-[12.5px] font-semibold text-brand-primary transition-colors hover:bg-brand-accent"
                  >
                    Fix
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        {/* Keyword relevance nudge */}
        {keywordTip ? (
          <div className="flex items-start gap-2.5 rounded-card border border-amber-200 bg-amber-50 p-4">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <div className="text-sm font-semibold text-brand-ink">
                Keyword tip
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-brand-ink/80">
                {keywordTip}
              </p>
            </div>
          </div>
        ) : null}

        {/* Transparency link */}
        <div className="flex items-start gap-2.5 text-[12.5px] text-brand-mute">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Ranking updates within about 15 minutes of a change.{" "}
            <Link
              href="/help/how-search-ranking-works"
              className="font-medium text-brand-primary hover:underline"
            >
              Learn how Wielo search ranking works
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
