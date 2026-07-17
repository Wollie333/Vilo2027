import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";

// RETIRED (was: TEMP dev harness, plan §8.3) — this route used to render every
// section component with hardcoded picsum sample data through the legacy
// SectionRenderer + a default "warm" preset (no theme skin). It looked like a
// site preview but bypassed the real render path, so it misrepresented how a
// host's actual site looks. The real renderer now lives at /<locale>/site
// (SitePageView), previewable per-theme with ?theme=<slug>&preview=1. We redirect
// rather than 404 so any old bookmark still lands somewhere useful; nothing in
// the app links here.
export default async function RetiredSitePreviewPage() {
  const locale = await getLocale();
  redirect({ href: "/dashboard/website", locale });
}
