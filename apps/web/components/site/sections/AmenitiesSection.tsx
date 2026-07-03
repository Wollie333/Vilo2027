import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { AmenitiesData } from "@/lib/site/types";

import { SectionShell, SectionHeading } from "./_shared";

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
  return (
    <SectionShell>
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
              <span
                style={{ color: "var(--el-icon-fg, var(--site-icon-color))" }}
                className="text-xl"
                aria-hidden
              >
                {item.icon}
              </span>
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
    </SectionShell>
  );
}
