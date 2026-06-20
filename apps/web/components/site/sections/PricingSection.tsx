import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SectionHeading, Muted } from "./_shared";

type Props = Extract<WebsiteSection, { type: "pricing" }>["props"];

/** Free-form, display-only rates table. Booking always re-prices server-side —
 *  these figures are marketing copy, never trusted for a transaction. */
export function PricingSection({ props }: { props: Props }) {
  if (props.items.length === 0) return null;
  return (
    <SectionShell width="narrow">
      {props.heading ? (
        <SectionHeading className="mb-8">{props.heading}</SectionHeading>
      ) : null}
      <div
        className="overflow-hidden rounded-card border"
        style={{ borderColor: "var(--site-line)" }}
      >
        {props.items.map((item, i) => (
          <div
            key={i}
            className="flex items-baseline justify-between gap-4 border-b px-5 py-4 last:border-b-0"
            style={{ borderColor: "var(--site-line)" }}
          >
            <div>
              <div
                style={{ color: "var(--site-ink)" }}
                className="text-sm font-semibold"
              >
                {item.label}
              </div>
              {item.note ? (
                <div style={{ color: "var(--site-mute)" }} className="text-xs">
                  {item.note}
                </div>
              ) : null}
            </div>
            <div
              style={{
                color: "var(--site-accent)",
                fontFamily: "var(--site-font-heading)",
              }}
              className="shrink-0 text-lg font-bold"
            >
              {item.price}
            </div>
          </div>
        ))}
      </div>
      {props.footnote ? (
        <Muted className="mt-3 text-center text-xs">{props.footnote}</Muted>
      ) : null}
    </SectionShell>
  );
}
