import {
  CreditCard,
  Link2,
  Mail,
  MessageCircle,
  ShieldCheck,
  User,
} from "lucide-react";
import Link from "next/link";

import type { SetupStep } from "./setupSteps";

type Props = {
  firstName: string;
  handle: string;
  email: string;
  emailVerified: boolean;
  steps: SetupStep[];
};

const STEP_ICONS: Record<SetupStep["key"], typeof Mail> = {
  email_verified: Mail,
  profile_completed: User,
  first_listing: User,
  paystack_verified: CreditCard,
  policies_set: ShieldCheck,
  listing_published: Link2,
};

// Right-rail panel that mirrors the design's "Notifications" column. We
// source the items from the same setup-state we already have on hand —
// not from a notifications table — so this works while the real notif
// system is deferred (see project_notification_system_pending.md).
export function SetupSidePanel({
  firstName,
  handle,
  email,
  emailVerified,
  steps,
}: Props) {
  const incompleteSteps = steps.filter((s) => !s.done);
  const newCount = incompleteSteps.length;

  return (
    <section className="rounded-card border border-brand-line bg-white shadow-card">
      <div className="border-b border-brand-line px-5 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              What needs your attention
            </div>
            <div className="mt-1 font-display text-lg font-bold text-brand-ink">
              {newCount} {newCount === 1 ? "item" : "items"}
            </div>
          </div>
        </div>
        <div className="-mb-px mt-4 flex items-center gap-1 text-[12.5px]">
          <button
            type="button"
            className="relative border-b-2 border-brand-primary px-2 pb-2.5 font-semibold text-brand-ink"
          >
            All{" "}
            <span className="num ml-1 rounded-pill bg-brand-accent px-1.5 py-0.5 text-[10px] font-bold text-brand-secondary">
              {newCount + 2}
            </span>
          </button>
          <span className="px-2 pb-2.5 font-medium text-brand-mute">
            Action needed{" "}
            <span className="num ml-1 rounded-pill bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
              {newCount}
            </span>
          </span>
        </div>
      </div>

      <ul className="divide-y divide-brand-line">
        <li className="bg-brand-light/50 px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
          Today
        </li>

        {/* Incomplete setup steps surfaced as action items */}
        {incompleteSteps.map((s) => {
          const Icon = STEP_ICONS[s.key];
          return (
            <li
              key={s.key}
              className="relative flex gap-3 px-5 py-4 hover:bg-brand-light/50"
            >
              <span className="absolute left-2 top-6 h-1.5 w-1.5 rounded-full bg-brand-primary" />
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-amber-500/10 text-amber-600">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-brand-ink">
                  {s.title}
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-brand-mute">
                  {s.description}
                </p>
                <div className="mt-2">
                  <Link
                    href={s.href}
                    className="inline-flex items-center gap-1 rounded-[8px] bg-brand-primary px-2.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-brand-secondary"
                  >
                    {s.ctaLabel} →
                  </Link>
                </div>
              </div>
            </li>
          );
        })}

        {/* Reserved-handle confirmation — informational */}
        <li className="relative flex gap-3 px-5 py-4 hover:bg-brand-light/50">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
            <Link2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-brand-ink">
              Your handle is reserved
            </div>
            <p className="mt-0.5 text-[12px] leading-relaxed text-brand-mute">
              <span className="font-mono text-brand-ink">
                viloplatform.com/{handle}
              </span>{" "}
              is yours. Change it from Settings before you publish.
            </p>
          </div>
        </li>

        {/* Welcome — informational */}
        <li className="relative flex gap-3 px-5 py-4 hover:bg-brand-light/50">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
            <MessageCircle className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-brand-ink">
              Welcome to Vilo, {firstName}.
            </div>
            <p className="mt-0.5 text-[12px] leading-relaxed text-brand-mute">
              A real human will reach out within a day. Until then, anything
              stuck? Reply to this thread.
            </p>
          </div>
        </li>

        {/* Email verified — success row, only when actually verified */}
        {emailVerified ? (
          <li className="relative flex gap-3 px-5 py-4 opacity-90 hover:bg-brand-light/50">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent/60 text-brand-secondary">
              <Mail className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-brand-ink">
                Email verified
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-brand-mute">
                {email} is now your sign-in.
              </p>
            </div>
          </li>
        ) : null}
      </ul>

      <div className="border-t border-brand-line px-5 py-3 text-center">
        <Link
          href="/dashboard/settings"
          className="text-[11.5px] font-medium text-brand-primary hover:underline"
        >
          Open settings →
        </Link>
      </div>
    </section>
  );
}
