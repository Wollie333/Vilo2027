import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SectionHeading } from "./_shared";

type Props = Extract<WebsiteSection, { type: "amenities" }>["props"];

/** Free-form facilities grid — icon (emoji/char) + label per amenity. */
export function AmenitiesSection({ props }: { props: Props }) {
  if (props.items.length === 0) return null;
  return (
    <SectionShell>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {props.items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 rounded-card border p-3"
            style={{ borderColor: "var(--site-line)" }}
          >
            {item.icon ? (
              <span
                style={{ color: "var(--site-icon-color)" }}
                className="text-xl"
                aria-hidden
              >
                {item.icon}
              </span>
            ) : null}
            <span
              style={{ color: "var(--site-ink)" }}
              className="text-sm font-medium"
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
