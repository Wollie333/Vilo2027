import { Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface QuotaWidgetProps {
  remainingToday: number;
  remainingMonth: number;
  allowed: boolean;
}

/**
 * Shows the host's remaining quote quota for Looking For posts.
 * Displayed at the top of the browse view.
 */
export function QuotaWidget({
  remainingToday,
  remainingMonth,
  allowed,
}: QuotaWidgetProps) {
  if (!allowed) {
    return (
      <div className="flex items-center justify-between rounded-card border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-amber-800">
          <span className="font-medium">Quota exhausted</span>
          <span className="text-amber-600">
            — Your quote limit resets at midnight
          </span>
        </div>
        <Link
          href="/dashboard/settings/subscription"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-900"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Upgrade for more
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-card border border-brand-line bg-brand-light px-4 py-3">
      <div className="flex items-center gap-4 text-sm text-brand-ink">
        <span>
          <span className="font-semibold">{remainingToday}</span>{" "}
          <span className="text-brand-mute">quotes today</span>
        </span>
        <span className="text-brand-line">·</span>
        <span>
          <span className="font-semibold">{remainingMonth}</span>
          <span className="text-brand-mute">/month</span>
        </span>
      </div>
      {remainingMonth < 10 && (
        <Link
          href="/dashboard/settings/subscription"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:text-brand-secondary"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Upgrade for more
        </Link>
      )}
    </div>
  );
}
