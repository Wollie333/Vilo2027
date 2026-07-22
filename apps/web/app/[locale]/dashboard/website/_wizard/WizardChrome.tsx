"use client";

import {
  Check,
  CheckCircle2,
  ListChecks,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";

// One setup section — rendered as a numbered card down the page AND a row in the
// sticky progress rail. `required` drives the publish gate.
export type WizardSectionMeta = {
  id: string;
  /** Two-digit display number, e.g. "01". */
  n: string;
  /** Card title. */
  label: string;
  /** Short label for the rail. */
  rail: string;
  required: boolean;
  /** Optional one-line subtitle under the card title (the warm framing line). */
  hint?: string;
};

/* -------------------------------------------------------------------------- */
/* Completion ring — SVG donut showing overall % (mirrors the design).        */
/* -------------------------------------------------------------------------- */
const RING_CIRCUMFERENCE = 2 * Math.PI * 15.5; // r=15.5 → ~97.39

export function CompletionRing({ pct }: { pct: number }) {
  return (
    <div className="relative h-14 w-14">
      <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="#DCEAE0"
          strokeWidth="4"
        />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="#10B981"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
          className="transition-all duration-500"
        />
      </svg>
      <div className="wz-num absolute inset-0 flex items-center justify-center font-display text-sm font-bold text-brand-ink">
        {pct}%
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Section card — the numbered "step page" block.                             */
/* -------------------------------------------------------------------------- */
export function SectionCard({
  meta,
  complete,
  active,
  children,
}: {
  meta: WizardSectionMeta;
  complete: boolean;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={`sec-${meta.id}`}
      data-section={meta.id}
      className={`wz-section scroll-mt-24 rounded-card border border-brand-line bg-white shadow-card ${
        active ? "is-active" : ""
      }`}
    >
      <div className="flex items-start gap-4 border-b border-brand-line px-5 py-5 md:px-7">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-card font-display text-sm font-bold transition-colors ${
            complete
              ? "bg-brand-primary text-white"
              : "bg-brand-accent text-brand-secondary"
          }`}
        >
          {complete ? <Check className="h-5 w-5" /> : meta.n}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold text-brand-ink">
              {meta.label}
            </h2>
            <span className="rounded-pill bg-brand-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-mute">
              {meta.required ? "Required" : "Optional"}
            </span>
            {complete ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> Done
              </span>
            ) : null}
          </div>
          {meta.hint ? (
            <p className="mt-0.5 text-[13px] leading-snug text-brand-mute">
              {meta.hint}
            </p>
          ) : null}
        </div>
      </div>
      <div className="px-5 py-6 md:px-7">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Sticky progress rail with scroll-spy status + publish gate.                */
/* -------------------------------------------------------------------------- */
export function ProgressRail({
  sections,
  active,
  completion,
  pct,
  onJump,
  ready,
  onPublish,
}: {
  sections: WizardSectionMeta[];
  active: string;
  completion: Record<string, boolean>;
  pct: number;
  onJump: (id: string) => void;
  ready: boolean;
  onPublish: () => void;
}) {
  return (
    <div className="sticky top-24 space-y-4">
      <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Setup progress
          </span>
          <span className="wz-num font-display text-sm font-bold text-brand-primary">
            {pct}%
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-pill bg-brand-light">
          <div
            className="h-full rounded-pill bg-brand-gradient transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <nav className="mt-4 space-y-0.5">
          {sections.map((s) => {
            const done = !!completion[s.id];
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onJump(s.id)}
                className={`group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${
                  isActive ? "bg-brand-accent" : "hover:bg-brand-light"
                }`}
              >
                <span
                  className={`wz-num flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors ${
                    done
                      ? "border-brand-primary bg-brand-primary text-white"
                      : isActive
                        ? "border-brand-primary bg-white text-brand-primary"
                        : "border-brand-line bg-white text-brand-mute"
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : s.n.replace(/^0/, "")}
                </span>
                <span
                  className={`flex-1 truncate text-[13px] font-medium ${
                    isActive
                      ? "text-brand-ink"
                      : "text-brand-mute group-hover:text-brand-ink"
                  }`}
                >
                  {s.rail}
                </span>
                {s.required && !done ? (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-pending"
                    title="Required"
                  />
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      <button
        type="button"
        onClick={onPublish}
        disabled={!ready}
        className={`flex w-full items-center justify-center gap-2 rounded-card px-4 py-3 text-sm font-semibold shadow-card transition-all ${
          ready
            ? "bg-brand-primary text-white hover:bg-brand-secondary hover:shadow-glow"
            : "cursor-not-allowed bg-brand-line text-brand-mute"
        }`}
      >
        <Rocket className="h-4 w-4" />
        {ready ? "Build my website" : "Finish required steps"}
      </button>
      {!ready ? (
        <p className="px-1 text-center text-[11px] leading-relaxed text-brand-mute">
          Complete the required steps to build your site. You can keep editing
          everything after.
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Publish bar — the CTA row inside the final "Review & publish" card.        */
/* -------------------------------------------------------------------------- */
export function PublishBar({
  ready,
  missing,
  onPublish,
  onJump,
}: {
  ready: boolean;
  missing: WizardSectionMeta[];
  onPublish: () => void;
  onJump: (id: string) => void;
}) {
  const Ic: LucideIcon = ready ? Rocket : ListChecks;
  return (
    <div
      className={`flex flex-col gap-4 rounded-card border p-5 md:flex-row md:items-center ${
        ready
          ? "border-brand-primary/40 bg-brand-accent/40"
          : "border-brand-line bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-card ${
            ready
              ? "bg-brand-primary text-white"
              : "bg-brand-light text-brand-mute"
          }`}
        >
          <Ic className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-base font-bold text-brand-ink">
            {ready ? "Ready to build" : "A few things left"}
          </div>
          {ready ? (
            <p className="mt-0.5 text-sm text-brand-mute">
              We&apos;ll build every page, wire up bookings and take your site
              live.
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-brand-mute">
              Finish:{" "}
              {missing.map((m, i) => (
                <span key={m.id}>
                  <button
                    type="button"
                    onClick={() => onJump(m.id)}
                    className="font-medium text-brand-primary hover:underline"
                  >
                    {m.label}
                  </button>
                  {i < missing.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 md:ml-auto">
        <button
          type="button"
          onClick={onPublish}
          disabled={!ready}
          className={`inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold shadow-card transition-all ${
            ready
              ? "bg-brand-primary text-white hover:bg-brand-secondary hover:shadow-glow"
              : "cursor-not-allowed bg-brand-line text-brand-mute"
          }`}
        >
          <Rocket className="h-4 w-4" /> Build my website
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Confetti — publish celebration.                                            */
/* -------------------------------------------------------------------------- */
export function Confetti() {
  const pieces = useMemo(() => {
    const colors = [
      "#10B981",
      "#064E3B",
      "#D1FAE5",
      "#34D399",
      "#A7F3D0",
      "#F4A836",
    ];
    return Array.from({ length: 70 }).map((_, i) => ({
      left: Math.random() * 100,
      dx: Math.random() * 220 - 110 + "px",
      d: (3 + Math.random() * 2.5).toFixed(2) + "s",
      delay: (Math.random() * 0.8).toFixed(2) + "s",
      bg: colors[i % colors.length],
      rot: Math.random() * 180,
    }));
  }, []);
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[80] overflow-hidden"
      aria-hidden
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="wz-confetti"
          style={
            {
              left: p.left + "%",
              background: p.bg,
              transform: `rotate(${p.rot}deg)`,
              "--wz-dx": p.dx,
              "--wz-d": p.d,
              "--wz-delay": p.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
