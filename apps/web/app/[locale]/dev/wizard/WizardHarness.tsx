"use client";

import { WebsiteWizard } from "../../dashboard/website/_wizard/WebsiteWizard";
import type { WizardProps } from "../../dashboard/website/_wizard/wizardState";

// DEV-ONLY client wrapper: renders the full-page wizard (no dashboard create
// gate) so the multi-step flow + live status sidebar can be verified. Build is
// not exercised here (dummy businessId).
export function WizardHarness(props: WizardProps) {
  return (
    <div className="min-h-screen bg-brand-light/30 p-6">
      <div className="mx-auto max-w-5xl">
        <WebsiteWizard {...props} />
      </div>
    </div>
  );
}
