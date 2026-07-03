import type { WebsiteSection } from "@/lib/website/sections.schema";

// Bare element (Elementor reframe): renders bare; the SECTION owns padding + width
// and the heading is a separate Heading element above. `props.heading` stays legacy.
import { SectionHeading, Muted } from "./_shared";

type Props = Extract<WebsiteSection, { type: "pricing" }>["props"];

/** Free-form, display-only rates table. Booking always re-prices server-side —
 *  these figures are marketing copy, never trusted for a transaction. */
export function PricingSection({ props }: { props: Props }) {
  if (props.items.length === 0) return null;
  return (
    <>
      {props.heading ? (
        <SectionHeading className="mb-8">{props.heading}</SectionHeading>
      ) : null}
      <div
        className="overflow-hidden border"
        style={{
          borderColor: "var(--site-line)",
          background: "var(--el-card-bg, transparent)",
          borderRadius: "var(--el-card-radius, var(--site-card-radius))",
        }}
      >
        {props.items.map((item, i) => (
          <div
            key={i}
            className="flex items-baseline justify-between gap-4 border-b px-5 py-4 last:border-b-0"
            style={{ borderColor: "var(--site-line)" }}
          >
            <div>
              <div
                style={{
                  color: "var(--el-label-fg, var(--site-ink))",
                  fontSize: "var(--el-label-size, 0.875rem)",
                }}
                className="font-semibold"
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
                color: "var(--el-price-fg, var(--site-accent))",
                fontFamily: "var(--site-font-heading)",
                fontSize: "var(--el-price-size, 1.125rem)",
                fontWeight: "var(--el-price-weight, 700)",
              }}
              className="shrink-0"
            >
              {item.price}
            </div>
          </div>
        ))}
      </div>
      {props.footnote ? (
        <Muted className="mt-3 text-center text-xs">{props.footnote}</Muted>
      ) : null}
    </>
  );
}
