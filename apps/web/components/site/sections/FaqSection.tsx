import type { WebsiteSection } from "@/lib/website/sections.schema";

// Bare element (Elementor reframe): all variants render bare; the SECTION owns
// padding + width and the heading is a separate Heading element above.
import { SectionHeading } from "./_shared";

type Props = Extract<WebsiteSection, { type: "faq" }>["props"];
type FaqItem = Props["items"][number];

// Native <details> accordion — no client JS, works in a server component.
function FaqAccordion({ item }: { item: FaqItem }) {
  return (
    <details
      style={{
        background: "var(--site-surface)",
        borderColor: "var(--site-line)",
        borderRadius: "var(--site-radius)",
      }}
      className="group border p-4"
    >
      <summary
        style={{ color: "var(--site-ink)" }}
        className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold"
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
        style={{ color: "var(--site-mute)" }}
        className="mt-3 whitespace-pre-line text-sm leading-relaxed"
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
                  color: "var(--site-ink)",
                  fontFamily: "var(--site-font-heading)",
                }}
                className="text-base font-semibold"
              >
                {item.q}
              </h3>
              <p
                style={{ color: "var(--site-mute)" }}
                className="mt-1.5 whitespace-pre-line text-sm leading-relaxed"
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
