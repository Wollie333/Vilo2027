import { getBranding } from "@/lib/brand";

import { BrandingForm } from "./BrandNameForm";

export const dynamic = "force-dynamic";

// General tab — brand identity used across the app + on invoices.
export default async function PlatformSettingsGeneralPage() {
  const { brandName, companyName, companyLocation } = await getBranding();

  return (
    <BrandingForm
      brandName={brandName}
      companyName={companyName}
      companyLocation={companyLocation}
    />
  );
}
