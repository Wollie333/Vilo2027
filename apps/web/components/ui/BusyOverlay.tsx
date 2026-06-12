"use client";

import { Loader2 } from "lucide-react";

/**
 * Full-screen "working…" overlay. Show it while a mutation + its follow-up
 * refresh are in flight so the UI never looks frozen/stuck. Pair it with a
 * useTransition that wraps router.refresh() — the transition stays pending
 * until the refreshed server UI commits, so the overlay clears exactly when
 * the updated UI is ready.
 */
export function BusyOverlay({
  show,
  label = "Saving…",
}: {
  show: boolean;
  label?: string;
}) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-card bg-white px-6 py-4 shadow-lift">
        <Loader2 className="h-5 w-5 animate-spin text-brand-primary" />
        <span className="text-sm font-semibold text-brand-ink">{label}</span>
      </div>
    </div>
  );
}
