import { Coins, Plus, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// Sending one Looking-For quote costs this many credits (mirrors
// LOOKING_FOR_QUOTE_CREDIT_COST). At or below the "low" threshold we warn the
// host BEFORE they build the whole quote, rather than only blocking at send.
const LOW_THRESHOLD = 3;

/**
 * Heads-up banner on the host respond page when the host's quote-credit wallet
 * is empty or running low. Empty = a hard warning (they can't send until they
 * top up); low = a soft nudge. Renders nothing when they have plenty. Keeps the
 * "out of credits" surprise off the send button.
 */
export function LowCreditBanner({
  balance,
  cost = 1,
}: {
  balance: number;
  cost?: number;
}) {
  const canAfford = balance >= cost;

  if (balance > LOW_THRESHOLD) return null;

  if (!canAfford) {
    return (
      <div className="flex flex-col gap-3 rounded-card border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              You&apos;re out of quote credits
            </p>
            <p className="mt-0.5 text-sm text-amber-800">
              Sending a quote costs {cost} credit{cost === 1 ? "" : "s"}. Top up
              to respond to this request.
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="shrink-0 gap-1.5">
          <Link href="/dashboard/credits">
            <Plus className="h-4 w-4" />
            Top up credits
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-brand-line bg-brand-light/50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <Coins className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" />
        <div>
          <p className="text-sm font-semibold text-brand-ink">
            {balance} credit{balance === 1 ? "" : "s"} left
          </p>
          <p className="mt-0.5 text-sm text-brand-mute">
            Each quote you send costs {cost} credit{cost === 1 ? "" : "s"}. Top
            up so you don&apos;t run out mid-response.
          </p>
        </div>
      </div>
      <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5">
        <Link href="/dashboard/credits">
          <Plus className="h-4 w-4" />
          Top up
        </Link>
      </Button>
    </div>
  );
}
