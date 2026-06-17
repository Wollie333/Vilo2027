import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SectionHeading } from "./_shared";

type Props = Extract<WebsiteSection, { type: "values" }>["props"];

export function ValuesSection({ props }: { props: Props }) {
  if (props.items.length === 0) return null;
  return (
    <SectionShell>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      <div className="mx-auto grid max-w-3xl gap-8 sm:grid-cols-2">
        {props.items.map((item, i) => (
          <div
            key={i}
            className="border-l-2 pl-4"
            style={{ borderColor: "var(--site-accent)" }}
          >
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
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
