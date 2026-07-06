import { loadActiveThemes } from "@/lib/site/themes.server";

import type {
  WizardPaymentMethod,
  WizardPolicy,
} from "../../dashboard/website/_wizard/wizardState";
import { WizardHarness } from "./WizardHarness";

// DEV-ONLY (no auth): renders the website setup wizard with real themes + dummy
// prefill/account data so the multi-step flow can be verified without the
// dashboard create gate. Not linked anywhere; reach it at /en/dev/wizard.
export const dynamic = "force-dynamic";

const DEMO_PAYMENTS: WizardPaymentMethod[] = [
  {
    key: "paystack",
    status: "active",
    editHref: "/dashboard/settings/banking",
  },
  { key: "paypal", status: "review", editHref: "/dashboard/settings/banking" },
  { key: "eft", status: "active", editHref: "/dashboard/settings/banking" },
];

const DEMO_POLICIES: WizardPolicy[] = [
  {
    key: "p1",
    type: "check_in_out",
    name: "Standard check-in",
    summary: "Check-in 14:00 · Check-out 10:00",
    configured: true,
    editHref: "/dashboard/policies",
  },
  {
    key: "p2",
    type: "cancellation",
    name: "Flexible",
    summary: "Free cancellation up to 7 days before arrival",
    configured: true,
    editHref: "/dashboard/policies",
  },
  {
    key: "type:house_rules",
    type: "house_rules",
    name: "",
    summary: "",
    configured: false,
    editHref: "/dashboard/policies",
  },
  {
    key: "type:booking_terms",
    type: "booking_terms",
    name: "",
    summary: "",
    configured: false,
    editHref: "/dashboard/policies",
  },
];

export default async function DevWizardPage() {
  const themes = await loadActiveThemes();
  return (
    <WizardHarness
      businessId="dev-harness"
      defaultName="Olive Grove"
      defaultSubdomain="olive-grove"
      logoPath={null}
      themes={themes}
      paymentMethods={DEMO_PAYMENTS}
      policies={DEMO_POLICIES}
    />
  );
}
