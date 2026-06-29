import { Search, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";

/**
 * Upgrade prompt shown to hosts without "Looking For" access.
 * Follows the same pattern as WebsiteLocked.tsx.
 */
export function LookingForLocked() {
  return (
    <div className="rounded-card border border-brand-line bg-white p-8 shadow-card">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-secondary">
          <Search className="h-6 w-6" />
        </div>
        <div>
          <div className="font-display text-lg font-bold text-brand-ink">
            Unlock Looking For
          </div>
          <p className="mt-1 max-w-prose text-sm text-brand-mute">
            Browse what travellers are looking for and send them personalised
            quotes. Connect with guests actively searching for accommodation
            like yours.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-brand-ink">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              Browse guest requests in your region
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              Send quotes directly to interested travellers
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              Save and track promising requests
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              Get alerts for new requests in your area
            </li>
          </ul>
          <Link
            href="/dashboard/settings/subscription"
            className="mt-6 inline-flex items-center gap-2 rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
          >
            <Sparkles className="h-4 w-4" />
            Upgrade to Basic
          </Link>
        </div>
      </div>
    </div>
  );
}
