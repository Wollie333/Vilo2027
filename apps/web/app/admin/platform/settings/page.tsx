import { requirePermission } from "@/lib/admin";
import { getBranding } from "@/lib/brand";
import { getLegalDocuments } from "@/lib/legal";

import { BrandingForm } from "./BrandNameForm";
import { LegalDocsForm } from "./LegalDocsForm";

export const dynamic = "force-dynamic";

export default async function PlatformSettingsPage() {
  await requirePermission("platform.settings");
  const [{ brandName, companyName, companyLocation }, legal] =
    await Promise.all([getBranding(), getLegalDocuments()]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-xl font-bold text-brand-ink">
          Platform settings
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Runtime configuration for the platform.
        </p>
      </header>

      <BrandingForm
        brandName={brandName}
        companyName={companyName}
        companyLocation={companyLocation}
      />

      <section>
        <h2 className="font-display text-base font-bold text-brand-ink">
          Legal documents
        </h2>
        <p className="mb-3 mt-1 text-sm text-brand-mute">
          Platform-wide booking terms &amp; privacy. These apply to every host
          and booking — hosts cannot change them.
        </p>
        <LegalDocsForm
          bookingTermsHtml={legal.booking_terms.html}
          bookingTermsVersion={legal.booking_terms.version}
          privacyHtml={legal.privacy.html}
          privacyVersion={legal.privacy.version}
        />
      </section>
    </div>
  );
}
