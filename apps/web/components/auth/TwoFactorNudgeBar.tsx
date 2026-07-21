"use client";

import { X } from "lucide-react";
import { useState, useTransition } from "react";

import { dismissMfaPromptAction } from "@/app/[locale]/account/security/actions";
import { Link } from "@/i18n/navigation";

// The dismissible half of the 2FA suggestion. Hidden immediately on dismiss so
// it never lingers while the write lands — and the write is what keeps it gone
// on the next page load.
export function TwoFactorNudgeBar({ icon }: { icon: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const [, start] = useTransition();

  if (hidden) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-brand-line bg-brand-light/60 px-4 py-2.5 text-[13px] text-brand-ink sm:px-6">
      {icon}
      <span className="min-w-0">
        Add two-factor authentication to protect your bookings and payouts.
      </span>
      <Link
        href="/account/security"
        className="font-semibold text-brand-primary hover:underline"
      >
        Turn it on
      </Link>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setHidden(true);
          start(async () => {
            await dismissMfaPromptAction();
          });
        }}
        className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-full text-brand-mute hover:bg-white hover:text-brand-ink"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
