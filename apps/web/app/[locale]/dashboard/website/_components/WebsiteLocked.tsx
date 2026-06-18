import { Globe, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

/**
 * W15 — shown when the host's plan doesn't grant `website_builder`. Mirrors the
 * upgrade-card pattern used by gated pages (e.g. Reports) so a locked surface
 * reads consistently across the dashboard. The actions enforce the gate too —
 * this is the graceful UI for a host who lands here without entitlement.
 */
export async function WebsiteLocked() {
  const t = await getTranslations("website");
  return (
    <div className="rounded-card border border-brand-line bg-white p-8 shadow-card">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-secondary">
          <Globe className="h-6 w-6" />
        </div>
        <div>
          <div className="font-display text-lg font-bold text-brand-ink">
            {t("lockedTitle")}
          </div>
          <p className="mt-1 max-w-prose text-sm text-brand-mute">
            {t("lockedBody")}
          </p>
          <Link
            href="/dashboard/settings/subscription"
            className="mt-4 inline-flex items-center gap-2 rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
          >
            <Sparkles className="h-4 w-4" />
            {t("lockedCta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
