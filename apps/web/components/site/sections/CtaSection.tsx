import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SiteButton, Muted } from "./_shared";

type Props = Extract<WebsiteSection, { type: "cta" }>["props"];

export function CtaSection({ props }: { props: Props }) {
  return (
    <SectionShell width="narrow">
      <div
        style={{
          background: "var(--site-surface)",
          borderColor: "var(--site-line)",
          borderRadius: "var(--site-radius)",
        }}
        className="border p-10 text-center"
      >
        <h2
          style={{
            fontFamily: "var(--site-font-heading)",
            color: "var(--site-ink)",
          }}
          className="text-2xl font-semibold tracking-tight md:text-3xl"
        >
          {props.heading}
        </h2>
        {props.body ? (
          <Muted className="mx-auto mt-3 max-w-md text-base">
            {props.body}
          </Muted>
        ) : null}
        <div className="mt-7 flex justify-center">
          <SiteButton href={props.button_href}>{props.button_label}</SiteButton>
        </div>
      </div>
    </SectionShell>
  );
}
