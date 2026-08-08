"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type StepPill = {
  /** Accessible label for the step (e.g. "Profile"). */
  label: string;
  /** Completed steps show a green checkmark instead of the number. */
  done: boolean;
};

/**
 * Mobile-only wizard step indicator — a sticky, full-bleed bar of numbered pills
 * (with a green checkmark on completed steps) and connecting lines, matching the
 * finish-setup / signup wizards. Hidden on `lg` and up (desktop keeps its own
 * rail/stepper).
 *
 * Tap a pill to jump to that step (`onJump`). The pills are always clickable —
 * gate progression via completion elsewhere, not by disabling navigation.
 *
 * The bar sits flush under the page header. Because pages pad their content
 * differently, pass a `className` with the negative-margin breakout for the
 * surrounding padding, e.g. `-mx-6 -mt-6 px-6` inside a `p-6` shell.
 */
export function MobileStepPills({
  steps,
  current,
  onJump,
  className,
}: {
  steps: StepPill[];
  current: number;
  onJump: (index: number) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 mb-4 border-b border-brand-line bg-brand-light/95 py-3 backdrop-blur lg:hidden",
        className,
      )}
    >
      <div className="wielo-hide-sb flex items-center gap-1 overflow-x-auto">
        {steps.map((s, i) => {
          const isCurrent = i === current;
          return (
            <div
              key={i}
              className="flex flex-1 items-center gap-1 last:flex-none"
            >
              <button
                type="button"
                onClick={() => onJump(i)}
                aria-label={s.label}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-xs font-semibold transition",
                  s.done
                    ? "bg-brand-primary text-white"
                    : isCurrent
                      ? "border-2 border-brand-primary bg-white text-brand-primary"
                      : "border border-brand-line bg-white text-brand-mute",
                )}
              >
                {s.done ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                ) : (
                  i + 1
                )}
              </button>
              {i < steps.length - 1 ? (
                <div
                  className={cn(
                    "h-px flex-1",
                    i < current ? "bg-brand-primary" : "bg-brand-line",
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
