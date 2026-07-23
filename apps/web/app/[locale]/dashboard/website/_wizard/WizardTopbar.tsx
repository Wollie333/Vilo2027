"use client";

import { Bookmark, Check } from "lucide-react";
import { Fragment } from "react";

import { VLogo } from "@/app/[locale]/dashboard/_components/VLogo";

import type { WizardSectionMeta } from "./WizardChrome";

// Focused, one-step-at-a-time wizard header (design handoff: setup/chrome.jsx).
// A sticky bar with the brand mark, a compact horizontal stepper (done / current
// / upcoming), a "Step N of M" counter, a Save-&-exit affordance, and a slim
// progress bar. Pips are clickable only for steps already reached.

function StepPips({
  sections,
  current,
  maxReached,
  completion,
  onJump,
}: {
  sections: WizardSectionMeta[];
  current: number;
  maxReached: number;
  completion: Record<string, boolean>;
  onJump: (i: number) => void;
}) {
  return (
    <div className="hidden items-center gap-1 md:flex">
      {sections.map((s, i) => {
        const reachable = i <= maxReached;
        const isCurrent = i === current;
        const done = reachable && !!completion[s.id] && !isCurrent;
        return (
          <Fragment key={s.id}>
            {i > 0 ? (
              <span
                className={`h-px w-5 ${
                  i <= maxReached ? "bg-brand-primary/40" : "bg-brand-line"
                }`}
              />
            ) : null}
            <button
              type="button"
              onClick={() => reachable && onJump(i)}
              disabled={!reachable}
              title={s.label}
              className={`num flex h-7 min-w-7 items-center justify-center rounded-full border px-0 text-[11px] font-bold transition-colors ${
                isCurrent
                  ? "border-brand-primary bg-brand-primary text-white"
                  : done
                    ? "border-brand-primary/40 bg-brand-accent text-brand-secondary hover:bg-brand-accent/70"
                    : "border-brand-line bg-white text-brand-mute"
              } ${reachable && !isCurrent ? "cursor-pointer" : ""} ${
                !reachable ? "cursor-not-allowed" : ""
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : s.n.replace(/^0/, "")}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

export function WizardTopbar({
  sections,
  current,
  total,
  pct,
  maxReached,
  completion,
  onJump,
  onExit,
}: {
  sections: WizardSectionMeta[];
  current: number;
  total: number;
  pct: number;
  maxReached: number;
  completion: Record<string, boolean>;
  onJump: (i: number) => void;
  onExit: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 shrink-0 bg-white">
      <div className="flex h-16 items-center gap-4 border-b border-brand-line px-4 lg:px-6">
        <button
          type="button"
          onClick={onExit}
          className="flex shrink-0 items-center gap-2.5"
        >
          <VLogo size={34} gradientId="wizard-topbar" />
          <span className="hidden font-display text-[16px] font-bold tracking-tight text-brand-ink sm:block">
            Wielo
          </span>
        </button>

        <div className="mx-auto">
          <StepPips
            sections={sections}
            current={current}
            maxReached={maxReached}
            completion={completion}
            onJump={onJump}
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="num hidden text-[12.5px] font-medium text-brand-mute sm:block">
            Step {current + 1} of {total}
          </span>
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[12.5px] font-semibold text-brand-ink transition hover:bg-brand-light"
          >
            <Bookmark className="h-3.5 w-3.5 text-brand-mute" /> Save &amp; exit
          </button>
        </div>
      </div>
      {/* slim progress bar */}
      <div className="h-1 w-full bg-brand-line">
        <div
          className="h-full bg-brand-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </header>
  );
}
