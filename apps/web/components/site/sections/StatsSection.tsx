import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SectionHeading } from "./_shared";

type Props = Extract<WebsiteSection, { type: "stats" }>["props"];

/** Free-form "by the numbers" band — big value + label per item. */
export function StatsSection({ props }: { props: Props }) {
  if (props.items.length === 0) return null;
  const cols = props.items.length >= 4 ? "sm:grid-cols-4" : "sm:grid-cols-3";
  return (
    <SectionShell surface>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      <div className={`grid grid-cols-2 gap-8 ${cols}`}>
        {props.items.map((item, i) => (
          <div key={i} className="text-center">
            <div
              style={{
                fontFamily: "var(--site-font-heading)",
                color: "var(--site-accent)",
              }}
              className="text-4xl font-bold tracking-tight md:text-5xl"
            >
              {item.value}
            </div>
            <div
              style={{ color: "var(--site-mute)" }}
              className="mt-2 text-sm font-medium"
            >
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
