import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SectionHeading } from "./_shared";

type Props = Extract<WebsiteSection, { type: "faq" }>["props"];

// Native <details> accordion — no client JS, works in a server component.
export function FaqSection({ props }: { props: Props }) {
  if (props.items.length === 0) return null;
  return (
    <SectionShell width="narrow">
      {props.heading ? (
        <SectionHeading className="mb-8">{props.heading}</SectionHeading>
      ) : null}
      <div className="space-y-3">
        {props.items.map((item, i) => (
          <details
            key={i}
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
        ))}
      </div>
    </SectionShell>
  );
}
