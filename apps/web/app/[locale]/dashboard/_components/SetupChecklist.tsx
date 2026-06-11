import {
  ArrowRight,
  Building2,
  Check,
  CreditCard,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import Link from "next/link";

import { type SetupStep, setupProgress } from "./setupSteps";

const ICONS: Record<SetupStep["key"], typeof Mail> = {
  email_verified: Mail,
  profile_completed: User,
  first_listing: Building2,
  paystack_verified: CreditCard,
  policies_set: ShieldCheck,
  listing_published: Check,
};

// Wide "6 things before you go live" checklist for the first-login
// dashboard. Each row has a numbered/icon avatar, title + helper text,
// and either a Done pill or an inline CTA. The first incomplete row is
// the "current" step and gets a primary highlight.
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const { done, total, pct, firstIncompleteIdx } = setupProgress(steps);

  return (
    <section
      id="setup"
      className="rounded-card border border-brand-line bg-white p-6 shadow-card"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Finish your host setup
          </div>
          <div className="mt-1 font-display text-lg font-bold text-brand-ink">
            {total} things before you go live
          </div>
        </div>
        <div className="text-right">
          <div className="num font-display text-xl font-bold text-brand-primary">
            {done}
            <span className="text-brand-mute">/{total}</span>
          </div>
          <div className="text-[10.5px] text-brand-mute">complete</div>
        </div>
      </div>

      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-pill bg-brand-line">
        <div
          className="h-full rounded-pill bg-brand-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="divide-y divide-brand-line">
        {steps.map((s, idx) => {
          const Icon = ICONS[s.key];
          const isCurrent = idx === firstIncompleteIdx;
          const isBlocked = !s.done && !isCurrent && idx > firstIncompleteIdx;

          return (
            <li key={s.key} className="flex items-center gap-4 py-3.5">
              {s.done ? (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-primary text-white">
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                </span>
              ) : isCurrent ? (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border-2 border-brand-primary bg-brand-accent/40 text-brand-secondary">
                  <Icon className="h-4 w-4" />
                </span>
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border-2 border-dashed border-brand-line text-brand-mute">
                  <Icon className="h-4 w-4" />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className={`text-[14px] font-semibold text-brand-ink ${
                      s.done ? "line-through decoration-brand-line" : ""
                    }`}
                  >
                    {s.title}
                  </div>
                  {isCurrent ? (
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-amber-600">
                      Action needed
                    </span>
                  ) : null}
                </div>
                <div className="text-[12px] text-brand-mute">
                  {s.meta ?? s.description}
                </div>
              </div>

              {s.done ? (
                <span className="rounded-pill bg-brand-accent px-2.5 py-1 text-[10.5px] font-semibold text-brand-secondary">
                  Done
                </span>
              ) : isBlocked ? (
                <span className="rounded-pill bg-brand-line px-2.5 py-1 text-[10.5px] font-medium text-brand-mute">
                  After above
                </span>
              ) : isCurrent ? (
                <Link
                  href={s.href}
                  className="inline-flex items-center gap-1 rounded-[10px] bg-brand-primary px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-secondary"
                >
                  {s.ctaLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <Link
                  href={s.href}
                  className="inline-flex items-center gap-1 rounded-[10px] border border-brand-line px-3.5 py-2 text-[12.5px] font-medium text-brand-ink hover:bg-brand-accent"
                >
                  {s.ctaLabel}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
