"use client";

import {
  ArrowRight,
  BedDouble,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  CornerUpLeft,
  CreditCard,
  FileText,
  MessageSquare,
  Plus,
  Send,
  Star,
  type LucideIcon,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import type {
  NextAction,
  NextActionIcon,
  NextActionTone,
} from "@/lib/guests/next-action";

// The "What to do" banner: one contextual call-to-action telling the host the
// single best next move for this guest. It renders whatever the canonical
// resolver (lib/guests/next-action) decided — it makes no decisions of its own.
// Route CTAs deep-link to existing flows; tab CTAs hand back to the record's own
// tab switcher (messages / reviews) so the action happens where it already lives.

const ICONS: Record<NextActionIcon, LucideIcon> = {
  "check-circle": CheckCircle2,
  "file-text": FileText,
  "credit-card": CreditCard,
  "message-square": MessageSquare,
  "bed-double": BedDouble,
  "calendar-clock": CalendarClock,
  star: Star,
  "calendar-plus": CalendarPlus,
  "arrow-right": ArrowRight,
  "corner-up-left": CornerUpLeft,
  send: Send,
  plus: Plus,
};

// Tone palette mirrors the Vilo design mock (Guest Record v2). Inline so the
// exact brand greens/ambers survive Tailwind's JIT purge without arbitrary-value
// sprawl across the file.
const TONES: Record<
  NextActionTone,
  { bg: string; border: string; accent: string; ink: string; btn: string }
> = {
  green: {
    bg: "#ECFDF5",
    border: "#C7F0DC",
    accent: "#10B981",
    ink: "#064E3B",
    btn: "#10B981",
  },
  sky: {
    bg: "#E6F6FE",
    border: "#BFE7FA",
    accent: "#0EA5E9",
    ink: "#075985",
    btn: "#0EA5E9",
  },
  amber: {
    bg: "#FFFBEB",
    border: "#FCE9B6",
    accent: "#F59E0B",
    ink: "#92400E",
    btn: "#F59E0B",
  },
  neutral: {
    bg: "#F4FBF7",
    border: "#E4EFE8",
    accent: "#4A7C6A",
    ink: "#064E3B",
    btn: "#064E3B",
  },
};

export function WhatToDoBanner({
  action,
  onTab,
}: {
  action: NextAction;
  onTab: (tab: string) => void;
}) {
  const t = TONES[action.tone];
  const HeadIcon = ICONS[action.icon];
  const cta = action.cta;
  const CtaIcon = cta ? ICONS[cta.icon] : null;

  const ctaInner = cta ? (
    <>
      {CtaIcon ? <CtaIcon className="h-4 w-4" /> : null}
      {cta.label}
    </>
  ) : null;

  const ctaClass =
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-pill px-4 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-110";

  return (
    <section
      className="mt-5 overflow-hidden rounded-card border shadow-card"
      style={{ borderColor: t.border }}
    >
      <div
        className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
        style={{ background: t.bg }}
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-white"
          style={{ color: t.accent }}
        >
          <HeadIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-[10.5px] font-bold uppercase tracking-[0.1em]"
            style={{ color: t.accent }}
          >
            What to do
          </div>
          <div
            className="font-display text-[16px] font-extrabold leading-snug"
            style={{ color: t.ink }}
          >
            {action.headline}
          </div>
          <div
            className="mt-1 text-[13px] leading-relaxed"
            style={{ color: t.ink, opacity: 0.8 }}
          >
            {action.body}
          </div>
        </div>
        {cta ? (
          cta.kind === "route" ? (
            <Link
              href={cta.href}
              className={ctaClass}
              style={{ background: t.btn }}
            >
              {ctaInner}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => onTab(cta.tab)}
              className={ctaClass}
              style={{ background: t.btn }}
            >
              {ctaInner}
            </button>
          )
        ) : null}
      </div>
    </section>
  );
}
