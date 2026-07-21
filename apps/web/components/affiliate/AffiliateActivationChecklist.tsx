import { Check, Clock, Mail } from "lucide-react";

import type { ActivationChecklist } from "@/lib/affiliate/activation";

import { ResendVerificationButton } from "./ResendVerificationButton";

// What a pending partner sees instead of the portal: exactly which steps are
// left. Showing the checklist beats bouncing them to a dead end — the usual
// remaining step is confirming their email, which they can act on right here.
export function AffiliateActivationChecklist({
  checklist,
}: {
  checklist: ActivationChecklist | null;
}) {
  if (!checklist) return null;

  const steps = [
    {
      done: checklist.agreementSigned,
      label: "Affiliate agreement signed",
      hint: "Recorded when you signed up.",
    },
    {
      done: checklist.platformTermsAccepted,
      label: "Platform terms accepted",
      hint: "Recorded when you signed up.",
    },
    ...(checklist.campaignId
      ? [
          {
            done: checklist.campaignRulesAccepted,
            label: "Competition rules accepted",
            hint: "Recorded when you entered the competition.",
          },
        ]
      : []),
    {
      done: checklist.emailConfirmed,
      label: "Email address confirmed",
      hint: "Click the link in the email we sent you.",
    },
  ];

  const remaining = steps.filter((s) => !s.done).length;

  return (
    <div className="mx-auto max-w-[560px] rounded-card border border-brand-line bg-white p-6 shadow-card sm:p-8">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-primary">
        <Clock className="h-3.5 w-3.5" /> Almost there
      </div>
      <h2 className="mt-2 font-display text-[22px] font-bold leading-tight tracking-tight text-brand-ink">
        {remaining === 0
          ? "Activating your partner account…"
          : "One last step to go live"}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-brand-mute">
        Your partner account is created. You&apos;ll get your referral link and
        start earning as soon as the steps below are done — or as soon as our
        team activates you by hand.
      </p>

      <ul className="mt-6 space-y-3">
        {steps.map((s) => (
          <li key={s.label} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                s.done
                  ? "bg-[#ECFDF5] text-[#047857]"
                  : "bg-[#FFFBEB] text-[#B45309]"
              }`}
            >
              {s.done ? (
                <Check className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
            </span>
            <div className="min-w-0">
              <div
                className={`text-[14px] font-semibold ${
                  s.done ? "text-brand-ink" : "text-brand-ink"
                }`}
              >
                {s.label}
              </div>
              <div className="text-[12.5px] leading-relaxed text-brand-mute">
                {s.hint}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {!checklist.emailConfirmed ? (
        <div className="rounded-input mt-6 flex flex-wrap items-center gap-3 border border-brand-line bg-brand-light/40 p-4">
          <Mail className="h-4 w-4 shrink-0 text-brand-primary" />
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-brand-mute">
            Didn&apos;t get the email? Check your spam folder, or send it again.
          </p>
          <ResendVerificationButton />
        </div>
      ) : null}
    </div>
  );
}
