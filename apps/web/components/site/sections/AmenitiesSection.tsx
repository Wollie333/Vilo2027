import type { CSSProperties } from "react";

import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { AmenitiesData } from "@/lib/site/types";
import { AmenitiesCategorized } from "@/components/listing/AmenitiesCategorized";

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
  const categories = data?.categories ?? [];

  // INLINE — a centred row of text pills, no heading (the designed "what's
  // included" bar). Icons are intentionally omitted: live amenities carry lucide
  // icon *names* (not emoji), which would render as literal text here. Reusable
  // by any theme via `variant:"inline"`.
  if (props.variant === "inline") {
    if (items.length === 0) return null;
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

  // CATEGORIZED (default) — the Booking.com-style grouped layout: each admin
  // category shows an accent icon + title with dot-bulleted amenities, flowing
  // into a masonry. Live tenant sites always have grouped `data.categories`; the
  // colours follow the host's own theme (site accent + ink/mute). Falls through to
  // the flat grid below only when there's no grouped data (canvas / manual items).
  if (categories.length > 0) {
    return (
      <>
        {props.heading ? (
          <SectionHeading className="mb-10">{props.heading}</SectionHeading>
        ) : null}
        <div
          className="site-amen-cats mx-auto max-w-4xl"
          style={
            {
              "--am-accent": "var(--site-accent)",
              "--am-title": "var(--site-ink)",
              "--am-text": "var(--site-mute)",
            } as CSSProperties
          }
        >
          <AmenitiesCategorized categories={categories} />
        </div>
      </>
    );
  }

  if (items.length === 0) return null;
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
