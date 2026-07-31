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
      <div
        role="note"
        className="mb-4 mt-1 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        <strong className="font-semibold">
          Deprecated — do not edit here.
        </strong>{" "}
        Terms &amp; Privacy are now managed under{" "}
        <a
          href="/admin/platform/settings/legal-docs"
          className="font-semibold underline"
        >
          Legal documents
        </a>{" "}
        (the single source of truth). Publish there into the{" "}
        <code className="rounded bg-white px-1 py-0.5 text-[12px]">terms</code>{" "}
        and{" "}
        <code className="rounded bg-white px-1 py-0.5 text-[12px]">
          privacy
        </code>{" "}
        slots — those now drive the public{" "}
        <code className="rounded bg-white px-1 py-0.5 text-[12px]">/terms</code>{" "}
        and{" "}
        <code className="rounded bg-white px-1 py-0.5 text-[12px]">
          /privacy
        </code>{" "}
        pages and the version stamped on every booking. Anything saved on this
        legacy form is no longer read by the site.
      </div>
      <LegalDocsForm
        bookingTermsHtml={legal.booking_terms.html}
        bookingTermsVersion={legal.booking_terms.version}
        privacyHtml={legal.privacy.html}
        privacyVersion={legal.privacy.version}
      />
    </section>
  );
}
