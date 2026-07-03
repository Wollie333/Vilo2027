import type { WebsiteSection } from "@/lib/website/sections.schema";

// Bare element (Elementor reframe): renders bare (incl. the old conditional
// `surface` band); the SECTION owns padding + width + background (re-seed the band
// as the section `bg`) and the heading is a separate Heading element above.
import { SectionHeading, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "stats" }>["props"];

// Per-element style hooks (Elementor accordion) — each reads `--el-<key>-*`.
const statValueStyle = {
  fontFamily: "var(--site-font-heading)",
  color: "var(--el-value-fg, var(--site-accent))",
  fontSize: "var(--el-value-size, 3rem)",
  fontWeight: "var(--el-value-weight, 700)",
} as const;
const statLabelStyle = {
  color: "var(--el-label-fg, var(--site-mute))",
  fontSize: "var(--el-label-size, 0.875rem)",
} as const;

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <>
      <div style={statValueStyle} className="tracking-tight">
        {value}
      </div>
      <div style={statLabelStyle} className="mt-2 font-medium">
        {label}
      </div>
    </>
  );
}

/** Free-form "by the numbers" band — big value + label per item. */
export function StatsSection({ props }: { props: Props }) {
  if (props.items.length === 0) return null;
  const variant = props.variant ?? "band";
  const cols = props.items.length >= 4 ? "sm:grid-cols-4" : "sm:grid-cols-3";

  return (
    <>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      <div className={`grid grid-cols-2 gap-8 ${cols}`}>
        {props.items.map((item, i) =>
          variant === "cards" ? (
            <Card
              key={i}
              className="p-6 text-center"
              style={{
                background: "var(--el-card-bg, var(--site-surface))",
                border: "var(--el-card-bd, var(--site-card-border))",
                borderRadius: "var(--el-card-radius, var(--site-card-radius))",
              }}
            >
              <StatBlock value={item.value} label={item.label} />
            </Card>
          ) : (
            <div key={i} className="text-center">
              <StatBlock value={item.value} label={item.label} />
            </div>
          ),
        )}
      </div>
    </>
  );
}
