import type { WebsiteSection } from "@/lib/website/sections.schema";

// Bare element (Elementor reframe): renders bare (no self <section>/band/width-
// clamp); the SECTION owns padding + width and the heading is a separate Heading
// element above. `props.heading` stays legacy for pre-reframe pages.
import { SectionHeading, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "highlights" }>["props"];
type Item = Props["items"][number];

function ItemBody({ item }: { item: Item }) {
  return (
    <>
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
    </>
  );
}

export function HighlightsSection({ props }: { props: Props }) {
  if (props.items.length === 0) return null;
  const variant = props.variant ?? "grid";

  // LIST — stacked rows with the icon to the left of the text.
  if (variant === "list") {
    return (
      <>
        {props.heading ? (
          <SectionHeading className="mb-8">{props.heading}</SectionHeading>
        ) : null}
        <div className="mx-auto max-w-3xl">
          {props.items.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-4 border-t py-5 first:border-t-0"
              style={{ borderColor: "var(--site-line)" }}
            >
              {item.icon ? (
                <div
                  style={{ color: "var(--site-icon-color)" }}
                  className="shrink-0 text-2xl"
                  aria-hidden
                >
                  {item.icon}
                </div>
              ) : null}
              <div>
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
                    className="mt-1 text-sm leading-relaxed"
                  >
                    {item.body}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  // GRID (cards, default) or PLAIN (no card chrome).
  return (
    <>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {props.items.map((item, i) =>
          variant === "plain" ? (
            <div key={i} className="px-1">
              <ItemBody item={item} />
            </div>
          ) : (
            <Card key={i} className="p-6">
              <ItemBody item={item} />
            </Card>
          ),
        )}
      </div>
    </>
  );
}
