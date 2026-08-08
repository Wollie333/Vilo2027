"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

import { Link } from "@/i18n/navigation";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Header trial countdown for hosts — same pill styling as the Credit pill, sat to
// the left of the header buttons. Ticks every second down to the trial's end and
// clamps to zero (0d 00:00:00) once it expires. Mount-gated (now starts null) so
// the server and first client render agree — no hydration mismatch on the clock.
// Clicking it opens subscription settings to manage / convert the trial.
export function TrialCountdownPill({ trialEndsAt }: { trialEndsAt: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  let label = "—";
  if (now !== null) {
    const diff = Math.max(0, new Date(trialEndsAt).getTime() - now);
    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff % 86_400_000) / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1_000);
    label = `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  return (
    <Link
      href="/dashboard/settings/subscription"
      title="Your trial — time remaining"
      aria-label={`Trial time remaining: ${label}`}
      className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-light"
    >
      <Clock className="h-4 w-4 text-brand-primary" />
      <span className="tabular-nums">{label}</span>
      <span className="hidden text-brand-mute sm:inline">trial</span>
    </Link>
  );
}
