import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SectionHeading } from "./_shared";

type Props = Extract<WebsiteSection, { type: "intro" }>["props"];

export function IntroSection({ props }: { props: Props }) {
  return (
    <SectionShell width="narrow">
      {props.heading ? (
        <SectionHeading className="mb-5">{props.heading}</SectionHeading>
      ) : null}
      <p
        style={{ color: "var(--site-mute)" }}
        className="whitespace-pre-line text-center text-lg leading-relaxed"
      >
        {props.body}
      </p>
    </SectionShell>
  );
}
