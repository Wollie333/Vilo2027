import { loadActiveThemes } from "@/lib/site/themes.server";

import { WizardHarness } from "./WizardHarness";

// DEV-ONLY (no auth): renders the website setup wizard with real themes + dummy
// prefill so the multi-step flow can be verified without the dashboard create
// gate. Not linked anywhere; reach it at /en/dev/wizard.
export const dynamic = "force-dynamic";

export default async function DevWizardPage() {
  const themes = await loadActiveThemes();
  return (
    <WizardHarness
      businessId="dev-harness"
      defaultName="Olive Grove"
      defaultSubdomain="olive-grove"
      logoPath={null}
      themes={themes}
    />
  );
}
