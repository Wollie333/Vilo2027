import type { ReactNode } from "react";

import { SiteFooter } from "../home/SiteFooter";
import { SiteHeader } from "../home/SiteHeader";

export type LegalSectionData = {
  heading: string;
  body: ReactNode;
};

export function LegalPage({
  title,
  lastUpdated,
  sections,
}: {
  title: string;
  lastUpdated: string;
  sections: ReadonlyArray<LegalSectionData>;
}) {
  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />
      <LegalHero title={title} lastUpdated={lastUpdated} />
      <main className="mx-auto max-w-3xl px-5 pb-24 lg:px-8">
        <DraftNotice />
        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <LegalSection
              key={section.heading}
              heading={section.heading}
              body={section.body}
            />
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function LegalHero({
  title,
  lastUpdated,
}: {
  title: string;
  lastUpdated: string;
}) {
  return (
    <section className="border-b border-brand-line bg-white">
      <div className="mx-auto max-w-3xl px-5 py-14 lg:px-8 lg:py-20">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
          Legal
        </div>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-brand-ink sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 text-sm text-brand-mute">
          Last updated{" "}
          <time dateTime={lastUpdated} className="font-medium text-brand-ink">
            {lastUpdated}
          </time>
        </p>
      </div>
    </section>
  );
}

function DraftNotice() {
  return (
    <div
      role="note"
      className="mt-10 rounded-card border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900"
    >
      <strong className="font-semibold">DRAFT — pending legal review.</strong>{" "}
      This document is a structural placeholder. Final wording will be supplied
      by counsel before public launch.
    </div>
  );
}

function LegalSection({ heading, body }: { heading: string; body: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold tracking-tight text-brand-ink">
        {heading}
      </h2>
      <div className="mt-3 text-[15px] leading-relaxed text-brand-mute">
        {body}
      </div>
    </section>
  );
}
