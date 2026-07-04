import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { AmenitiesData } from "@/lib/site/types";

// Bare element (Elementor reframe): renders bare; the SECTION owns padding + width
// and the heading is a separate Heading element above. `props.heading` stays legacy.
import { SectionHeading, SiteIcon } from "./_shared";

type Props = Extract<WebsiteSection, { type: "amenities" }>["props"];

/**
 * Facilities grid — icon (emoji/char) + label per amenity. A Wielo block: when the
 * host's property has amenities (`data.items`) they render LIVE (theme = style,
 * system = data); the host manages them via the "Edit amenities" modal. The props
 * `items` are the fallback (demo canvas / manual override before any live data).
 */
export function AmenitiesSection({
  props,
  data,
}: {
  props: Props;
  data?: AmenitiesData;
}) {
  const items = data?.items?.length ? data.items : props.items;
  if (items.length === 0) return null;

  // INLINE — a centred row of text pills, no heading (the designed "what's
  // included" bar). Icons are intentionally omitted: live amenities carry lucide
  // icon *names* (not emoji), which would render as literal text here. Reusable
  // by any theme via `variant:"inline"`.
  if (props.variant === "inline") {
    return (
      <div className="site-amen-inline flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        {items.map((item, i) => (
          <span
            key={i}
            className="site-amen-pill inline-flex items-center gap-2 text-sm font-semibold"
            style={{
              color: "var(--el-label-fg, var(--site-ink))",
              borderRadius: "var(--site-radius)",
            }}
          >
            {item.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 border p-3"
            style={{
              borderColor: "var(--site-line)",
              background: "var(--el-card-bg, transparent)",
              borderRadius: "var(--el-card-radius, var(--site-card-radius))",
            }}
          >
            {item.icon ? (
              <SiteIcon
                value={item.icon}
                size={22}
                style={{ color: "var(--el-icon-fg, var(--site-icon-color))" }}
                className="text-xl"
              />
            ) : null}
            <span
              style={{
                color: "var(--el-label-fg, var(--site-ink))",
                fontSize: "var(--el-label-size, 0.875rem)",
              }}
              className="font-medium"
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
