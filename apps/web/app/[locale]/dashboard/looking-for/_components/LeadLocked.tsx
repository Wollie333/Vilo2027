"use client";

import { Lock, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { unlockLeadAction } from "../actions";

/**
 * The paywall on a single Looking-For lead. The request itself is never dropped
 * — it's here, the host just hasn't spent a lead credit on it yet.
 *
 * Deliberately dumb: all the money rules (idempotency, unlimited-allowance
 * bypass, insufficient balance) live in `lib/looking-for/leadAccess.ts`. This
 * only calls the action and reports what came back.
 */
export function LeadLocked({
  postId,
  balance,
  cost = 1,
  compact = false,
}: {
  postId: string;
  /** Lead-credit balance, so we can show "top up" rather than a doomed unlock. */
  balance: number;
  cost?: number;
  /** Tighter layout for a board card vs the full respond page. */
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canAfford = balance >= cost;

  function handleUnlock() {
    setError(null);
    startTransition(async () => {
      const r = await unlockLeadAction(postId);
      if (!r.success) setError(r.error);
      // Success needs no local state: the action revalidates and the server
      // re-renders this lead unlocked.
    });
  }

  return (
    <div
      className={`rounded-card border border-brand-line bg-white ${compact ? "p-4" : "p-6"}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-secondary">
          <Lock className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-brand-ink">
            {canAfford ? "See this request" : "You're out of Wielo credits"}
          </h3>
          <p className="mt-0.5 text-sm text-brand-mute">
            {canAfford
              ? `${cost} credit${cost !== 1 ? "s" : ""} to see the guest's details and full brief. Sending a quote costs 1 more. You have ${balance}.`
              : "This request is waiting for you. Top up to see the guest's details and quote."}
          </p>

          {error && (
            <p className="mt-2 text-sm text-status-cancelled">{error}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canAfford ? (
              <Button size="sm" onClick={handleUnlock} disabled={pending}>
                {pending ? "Unlocking…" : `See request · ${cost} credit`}
              </Button>
            ) : (
              <Button size="sm" asChild>
                <Link href="/dashboard/settings/subscription">
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Buy Wielo credits
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
