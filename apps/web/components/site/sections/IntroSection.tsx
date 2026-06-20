import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SectionHeading } from "./_shared";

type Props = Extract<WebsiteSection, { type: "intro" }>["props"];

export function IntroSection({ props }: { props: Props }) {
  const variant = props.variant ?? "centered";

  // SPLIT — heading on the left, body on the right (stacks on mobile).
  if (variant === "split") {
    return (
      <SectionShell>
        <div className="grid gap-6 md:grid-cols-2 md:gap-12">
          {props.heading ? (
            <SectionHeading centered={false} className="md:text-3xl">
              {props.heading}
            </SectionHeading>
          ) : (
            <div />
          )}
          <p
            style={{ color: "var(--site-mute)" }}
            className="whitespace-pre-line text-lg leading-relaxed"
          >
            {props.body}
          </p>
        </div>
      </SectionShell>
    );
  }

  // LEAD — large, light statement paragraph.
  if (variant === "lead") {
    return (
      <SectionShell width="narrow">
        {props.heading ? (
          <SectionHeading className="mb-5">{props.heading}</SectionHeading>
        ) : null}
        <p
          style={{ color: "var(--site-ink)" }}
          className="whitespace-pre-line text-center text-2xl font-light leading-snug md:text-3xl"
        >
          {props.body}
        </p>
      </SectionShell>
    );
  }

  // CENTERED (default).
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
