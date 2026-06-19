import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SectionHeading, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "highlights" }>["props"];

export function HighlightsSection({ props }: { props: Props }) {
  if (props.items.length === 0) return null;
  return (
    <SectionShell>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {props.items.map((item, i) => (
          <Card key={i} className="p-6">
            {item.icon ? (
              <div
                style={{ color: "var(--site-icon-color)" }}
                className="mb-3 text-2xl"
                aria-hidden
              >
                {item.icon}
              </div>
            ) : null}
            <h3
              style={{
                fontFamily: "var(--site-font-heading)",
                color: "var(--site-ink)",
              }}
              className="text-lg font-semibold"
            >
              {item.title}
            </h3>
            {item.body ? (
              <p
                style={{ color: "var(--site-mute)" }}
                className="mt-1.5 text-sm leading-relaxed"
              >
                {item.body}
              </p>
            ) : null}
          </Card>
        ))}
      </div>
    </SectionShell>
  );
}
