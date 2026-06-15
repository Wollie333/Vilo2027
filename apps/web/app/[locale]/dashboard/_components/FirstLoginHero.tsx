import { ArrowRight, Check, Link2, Play } from "lucide-react";
import { Link } from "@/i18n/navigation";

import { getBrandName } from "@/lib/brand";

import { type SetupStep, setupProgress } from "./setupSteps";

type Props = {
  firstName: string;
  handle: string;
  steps: SetupStep[];
};

// First-login hero, modeled on the "Welcome to Vilo, Thandi." card in the
// design — gradient left side with the greeting + handle pill + CTAs,
// dark right side with a progress ring and the four most-prominent step
// chips. The full 6-row checklist lives below in SetupChecklist.
export async function FirstLoginHero({ firstName, handle, steps }: Props) {
  const brand = await getBrandName();
  const { done, total, pct, nextStep } = setupProgress(steps);
  // The four chip-form steps that summarize progress at a glance. We pick
  // the most action-y subset rather than rendering all six twice — the
  // full checklist is right below the hero.
  const chipKeys: Array<SetupStep["key"]> = [
    "profile_completed",
    "first_listing",
    "paystack_verified",
    "listing_published",
  ];
  const chipSteps = chipKeys
    .map((k) => steps.find((s) => s.key === k))
    .filter((s): s is SetupStep => Boolean(s));

  // Stroke math for the progress ring: r=52, circumference = 2πr ≈ 326.7.
  const RING_CIRC = 326.7;
  const ringOffset = RING_CIRC * (1 - pct / 100);

  return (
    <section className="relative overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="grid gap-0 md:grid-cols-[1.5fr_1fr]">
        {/* Left: greeting */}
        <div
          className="relative p-7 text-white md:p-8"
          style={{
            backgroundImage:
              "linear-gradient(145deg, #030806 0%, #0a1510 50%, #051209 100%)",
          }}
        >
          <div
            aria-hidden
            className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-brand-primary/30 blur-3xl"
          />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-accent backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              Account created · today
            </div>
            <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight md:text-[34px]">
              Welcome to {brand}, {firstName}.
            </h2>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-brand-accent/80">
              Your direct-booking page is reserved. Finish a few quick steps and
              you&rsquo;ll be ready to take guests this weekend.
            </p>

            {/* Handle preview */}
            <div className="mt-5 inline-flex items-center gap-2 rounded-[10px] border border-white/15 bg-black/20 px-3 py-2 text-[12px] backdrop-blur">
              <Link2 className="h-3.5 w-3.5 text-brand-primary" />
              <span className="font-mono text-brand-accent/70">
                viloplatform.com/
              </span>
              <span className="font-mono font-semibold text-white">
                {handle}
              </span>
              <Link
                href={`/${handle}`}
                target="_blank"
                className="ml-2 rounded border border-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white/80 hover:bg-white/10"
              >
                Preview
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link
                href="/dashboard/setup"
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_32px_-10px_rgba(16,185,129,0.35)] transition-colors hover:bg-white hover:text-brand-secondary"
              >
                Finish setting up
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard/help"
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/20 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
              >
                <Play className="h-4 w-4" />
                Watch 2-min tour
              </Link>
            </div>
          </div>
        </div>

        {/* Right: progress */}
        <div className="flex flex-col justify-center bg-brand-dark/95 p-7 text-white md:p-8">
          <div className="flex items-center gap-5">
            <div className="relative h-[100px] w-[100px] shrink-0">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="rgba(255,255,255,0.20)"
                  strokeWidth="10"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={ringOffset}
                  style={{ transition: "stroke-dashoffset 600ms ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="num font-display text-2xl font-bold leading-none">
                  {pct}
                  <span className="text-base">%</span>
                </div>
                <div className="mt-0.5 text-[9.5px] uppercase tracking-wider text-brand-accent/70">
                  complete
                </div>
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-primary">
                Setup progress
              </div>
              <div className="mt-1 font-display text-[15px] font-semibold">
                {done} of {total} steps done
              </div>
              <div className="mt-1 text-[12px] text-brand-accent/70">
                {nextStep ? `Next: ${nextStep.title}` : "All steps complete"}
              </div>
            </div>
          </div>

          <ul className="mt-5 space-y-1.5 text-[12.5px]">
            {chipSteps.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                {s.done ? (
                  <>
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-primary text-brand-dark">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    <span className="text-white/90 line-through decoration-brand-primary/70">
                      {s.title}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="h-4 w-4 rounded-full border border-white/30" />
                    <span className="font-medium text-white">{s.title}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
