import type { WebsiteSection } from "@/lib/website/sections.schema";

// Bare element (Elementor reframe): all variants render bare; the SECTION owns
// padding + width and the heading is a separate Heading element above.
import { SectionHeading } from "./_shared";

type Props = Extract<WebsiteSection, { type: "faq" }>["props"];
type FaqItem = Props["items"][number];

// Per-element style hooks (Elementor accordion) — each reads `--el-<key>-*`.
const faqQuestionStyle = {
  color: "var(--el-question-fg, var(--site-ink))",
  fontSize: "var(--el-question-size, 1rem)",
} as const;
const faqAnswerStyle = {
  color: "var(--el-answer-fg, var(--site-mute))",
  fontSize: "var(--el-answer-size, 0.875rem)",
} as const;

// Native <details> accordion — no client JS, works in a server component.
function FaqAccordion({ item }: { item: FaqItem }) {
  return (
    <details
      style={{
        background: "var(--el-card-bg, var(--site-surface))",
        border: "var(--el-card-bd, 1px solid var(--site-line))",
        borderRadius: "var(--el-card-radius, var(--site-radius))",
        boxShadow: "var(--el-card-shadow, none)",
      }}
      className="group p-4"
    >
      <summary
        style={faqQuestionStyle}
        className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold"
      >
        {item.q}
        <span
          style={{ color: "var(--site-accent)" }}
          className="shrink-0 transition-transform group-open:rotate-45"
          aria-hidden
        >
          +
        </span>
      </summary>
      <p
        style={faqAnswerStyle}
        className="mt-3 whitespace-pre-line leading-relaxed"
      >
        {item.a}
      </p>
    </details>
  );
}

export function FaqSection({ props }: { props: Props }) {
  if (props.items.length === 0) return null;
  const variant = props.variant ?? "accordion";

  // PLAIN — always-open Q/A list, no toggle.
  if (variant === "plain") {
    return (
      <>
        {props.heading ? (
          <SectionHeading className="mb-8">{props.heading}</SectionHeading>
        ) : null}
        <div className="space-y-6">
          {props.items.map((item, i) => (
            <div key={i}>
              <h3
                style={{
                  ...faqQuestionStyle,
                  fontFamily: "var(--site-font-heading)",
                }}
                className="font-semibold"
              >
                {item.q}
              </h3>
              <p
                style={faqAnswerStyle}
                className="mt-1.5 whitespace-pre-line leading-relaxed"
              >
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </>
    );
  }

  // ACCORDION (default, single column) or COLUMNS (two-column accordion).
  return (
    <>
      {props.heading ? (
        <SectionHeading className="mb-8">{props.heading}</SectionHeading>
      ) : null}
      <div
        className={
          variant === "columns" ? "grid gap-3 md:grid-cols-2" : "space-y-3"
        }
      >
        {props.items.map((item, i) => (
          <FaqAccordion key={i} item={item} />
        ))}
      </div>
    </>
  );
}
