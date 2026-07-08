import { getWieloBusinessProfile } from "@/lib/billing/wielo-invoice";

import { WieloBusinessForm } from "../WieloBusinessForm";

export const dynamic = "force-dynamic";

// Business tab — the legal entity that issues Wielo invoices.
export default async function PlatformBusinessSettingsPage() {
  const wieloBusiness = await getWieloBusinessProfile();
  return <WieloBusinessForm initial={wieloBusiness} />;
}
