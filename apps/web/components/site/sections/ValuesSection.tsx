import type { WebsiteSection } from "@/lib/website/sections.schema";

// Bare element (Elementor reframe): renders bare; the SECTION owns padding + width
// and the heading is a separate Heading element above. `props.heading` stays legacy.
import { SectionHeading, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "values" }>["props"];
type Item = Props["items"][number];

function ValueText({ item }: { item: Item }) {
  return (
    <>
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
    </>
  );
}

export function ValuesSection({ props }: { props: Props }) {
  if (props.items.length === 0) return null;
  const variant = props.variant ?? "border";

  return (
    <>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      <div className="mx-auto grid max-w-3xl gap-8 sm:grid-cols-2">
        {props.items.map((item, i) =>
          variant === "cards" ? (
            <Card key={i} className="p-6">
              <ValueText item={item} />
            </Card>
          ) : variant === "numbered" ? (
            <div key={i} className="flex gap-4">
              <div
                style={{
                  color: "var(--site-accent)",
                  fontFamily: "var(--site-font-heading)",
                }}
                className="text-2xl font-bold leading-none"
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <div>
                <ValueText item={item} />
              </div>
            </div>
          ) : (
            <div
              key={i}
              className="border-l-2 pl-4"
              style={{ borderColor: "var(--site-accent)" }}
            >
              <ValueText item={item} />
            </div>
          ),
        )}
      </div>
    </>
  );
}
