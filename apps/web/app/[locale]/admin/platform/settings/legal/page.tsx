import { getLegalDocuments } from "@/lib/legal";

import { LegalDocsForm } from "../LegalDocsForm";

export const dynamic = "force-dynamic";

// Legal tab — platform-wide booking terms + privacy. These render on the public
// /terms and /privacy pages and are stamped onto every booking at acceptance.
export default async function PlatformLegalSettingsPage() {
  const legal = await getLegalDocuments();

  return (
    <section>
      <h2 className="font-display text-base font-bold text-brand-ink">
        Legal documents
      </h2>
      <p className="mb-3 mt-1 text-sm text-brand-mute">
        Platform-wide booking terms &amp; privacy. These apply to every host and
        booking — hosts cannot change them, and they show on the public{" "}
        <code className="rounded bg-brand-light px-1 py-0.5 text-[12px]">
          /terms
        </code>{" "}
        and{" "}
        <code className="rounded bg-brand-light px-1 py-0.5 text-[12px]">
          /privacy
        </code>{" "}
        pages.
      </p>
      <LegalDocsForm
        bookingTermsHtml={legal.booking_terms.html}
        bookingTermsVersion={legal.booking_terms.version}
        privacyHtml={legal.privacy.html}
        privacyVersion={legal.privacy.version}
      />
    </section>
  );
}
