import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import type { GettingStartedState } from "@/lib/help/queries";

type Step = {
  title: string;
  meta?: string;
  cta?: { label: string; href: string };
};

type Props = {
  state: GettingStartedState;
};

export function GettingStarted({ state }: Props) {
  const steps: { key: keyof GettingStartedState; done: boolean; data: Step }[] =
    [
      {
        key: "account_created",
        done: state.account_created.done,
        data: {
          title: "Create your account",
          meta: state.account_created.meta ?? "Sign up to begin",
        },
      },
      {
        key: "first_listing",
        done: state.first_listing.done,
        data: {
          title: "Publish your first listing",
          meta: state.first_listing.meta ?? "Pictures, pricing, the basics",
          cta: state.first_listing.done
            ? undefined
            : { label: "Add listing", href: "/dashboard/listings/new" },
        },
      },
      {
        key: "paystack_verified",
        done: state.paystack_verified.done,
        data: {
          title: "Verify your Paystack account",
          meta: state.paystack_verified.meta ?? "2 min · so we can pay you out",
          cta: state.paystack_verified.done
            ? undefined
            : { label: "Continue", href: "/dashboard/settings/payouts" },
        },
      },
      {
        key: "ical_connected",
        done: state.ical_connected.done,
        data: {
          title: "Connect your Airbnb calendar",
          meta: state.ical_connected.meta ?? "Prevent double-bookings via iCal",
          cta: state.ical_connected.done
            ? undefined
            : { label: "Connect", href: "/dashboard/calendar-sync" },
        },
      },
      {
        key: "policies_set",
        done: state.policies_set.done,
        data: {
          title: "Set your house rules & cancellation policy",
          meta: state.policies_set.meta ?? "Tell guests what to expect",
          cta: state.policies_set.done
            ? undefined
            : { label: "Set policy", href: "/dashboard/settings/policies" },
        },
      },
    ];

  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const firstIncompleteIdx = steps.findIndex((s) => !s.done);

  return (
    <aside className="flex flex-col rounded-card border border-brand-line bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            For new hosts
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
            Getting started
          </h3>
        </div>
        <span className="num inline-flex items-center rounded-pill bg-brand-accent px-2 py-0.5 text-[10px] font-bold text-brand-secondary">
          {total} steps
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-brand-mute">
        Brand-new to Vilo? Follow this path — most hosts finish in under an
        hour.
      </p>

      <ul className="mt-4 flex-1 space-y-2.5">
        {steps.map((s, idx) => (
          <li
            key={s.key}
            className={`flex items-start gap-3 rounded p-2.5 ${
              s.done
                ? "border border-brand-line bg-brand-light/50"
                : idx === firstIncompleteIdx
                  ? "border-2 border-brand-primary bg-white"
                  : "border border-brand-line"
            }`}
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-[11px] font-bold ${
                s.done
                  ? "bg-emerald-500 text-white"
                  : idx === firstIncompleteIdx
                    ? "bg-brand-primary text-white"
                    : "border border-brand-line bg-brand-light text-brand-mute"
              }`}
            >
              {s.done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={`text-sm font-medium text-brand-ink ${
                  s.done ? "line-through decoration-brand-mute/40" : ""
                }`}
              >
                {s.data.title}
              </div>
              {s.data.meta ? (
                <div className="mt-0.5 text-[11px] text-brand-mute">
                  {s.data.meta}
                </div>
              ) : null}
              {s.data.cta ? (
                <Link
                  href={s.data.cta.href}
                  className="mt-2 inline-flex items-center gap-1 rounded bg-brand-primary px-2.5 py-1 text-[11px] font-medium text-white hover:bg-brand-secondary"
                >
                  {s.data.cta.label} <ArrowRight className="h-3 w-3" />
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-brand-line pt-4">
        <div className="mb-2 flex items-center justify-between text-xs text-brand-ink">
          <span className="font-medium">Onboarding progress</span>
          <span className="num font-mono text-brand-mute">
            <span className="font-semibold text-brand-ink">{doneCount}</span>/
            {total}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-pill bg-brand-light">
          <div
            className="h-full bg-brand-primary"
            style={{ width: `${(doneCount / total) * 100}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
