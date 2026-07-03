import type { WebsiteSection } from "@/lib/website/sections.schema";

// Bare element (Elementor reframe): renders bare (no self <section>/band/width-
// clamp); the SECTION owns padding + width and the heading is a separate Heading
// element above. `props.heading` stays legacy for pre-reframe pages.
import { SectionHeading, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "highlights" }>["props"];
type Item = Props["items"][number];

// Per-element style hooks (Elementor accordion) — each reads `--el-<key>-*`.
const iconStyle = {
  color: "var(--el-icon-fg, var(--site-icon-color))",
} as const;
const hlTitleStyle = {
  fontFamily: "var(--site-font-heading)",
  color: "var(--el-title-fg, var(--site-ink))",
  fontSize: "var(--el-title-size, 1.125rem)",
  fontWeight: "var(--el-title-weight, 600)",
} as const;
const hlBodyStyle = {
  color: "var(--el-body-fg, var(--site-mute))",
  fontSize: "var(--el-body-size, 0.875rem)",
} as const;

function ItemBody({ item }: { item: Item }) {
  return (
    <>
      {item.icon ? (
        <div style={iconStyle} className="mb-3 text-2xl" aria-hidden>
          {item.icon}
        </div>
      ) : null}
      <h3 style={hlTitleStyle}>{item.title}</h3>
      {item.body ? (
        <p style={hlBodyStyle} className="mt-1.5 leading-relaxed">
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
                  style={iconStyle}
                  className="shrink-0 text-2xl"
                  aria-hidden
                >
                  {item.icon}
                </div>
              ) : null}
              <div>
                <h3 style={hlTitleStyle}>{item.title}</h3>
                {item.body ? (
                  <p style={hlBodyStyle} className="mt-1 leading-relaxed">
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
            <Card
              key={i}
              className="p-6"
              style={{
                background: "var(--el-card-bg, var(--site-surface))",
                border: "var(--el-card-bd, var(--site-card-border))",
                borderRadius: "var(--el-card-radius, var(--site-card-radius))",
                boxShadow: "var(--el-card-shadow, var(--site-card-shadow))",
              }}
            >
              <ItemBody item={item} />
            </Card>
          ),
        )}
      </div>
    </>
  );
}
