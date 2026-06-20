import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { ReviewsData } from "@/lib/site/types";

import { SectionShell, SectionHeading, Muted, Card, Stars } from "./_shared";

type Props = Extract<WebsiteSection, { type: "trust" }>["props"];

/**
 * Trust signals — free-form badges (awards / certifications / payment + secure
 * badges) plus an OPTIONAL live review score. The badges come from `props`
 * (host-entered); the score is the live reviews aggregate (average + count)
 * passed in via `data`, so it's never stale. Renders nothing when there's no
 * badge and no score to show.
 */
export function TrustSection({
  props,
  data,
}: {
  props: Props;
  data?: ReviewsData;
}) {
  const showScore =
    props.show_review_score && data?.average != null && !!data?.count;
  const items = props.items ?? [];
  if (!showScore && items.length === 0) return null;

  const variant = props.variant ?? "badges";

  return (
    <SectionShell>
      {props.heading ? (
        <SectionHeading className="mb-3">{props.heading}</SectionHeading>
      ) : null}
      {props.body ? (
        <Muted className="mx-auto mb-8 max-w-2xl text-center text-sm">
          {props.body}
        </Muted>
      ) : null}

      {showScore ? (
        <div className="mb-10 text-center">
          <div className="flex justify-center">
            <Stars rating={data!.average as number} />
          </div>
          <Muted className="mt-1 text-sm">
            {(data!.average as number).toFixed(1)} · {data!.count} review
            {data!.count === 1 ? "" : "s"}
          </Muted>
        </div>
      ) : null}

      {items.length === 0 ? null : variant === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <Card key={i} className="flex items-center gap-3 p-4">
              {item.icon ? (
                <span
                  style={{ color: "var(--site-icon-color)" }}
                  className="text-2xl leading-none"
                  aria-hidden
                >
                  {item.icon}
                </span>
              ) : null}
              <span>
                <span
                  style={{ color: "var(--site-ink)" }}
                  className="block text-sm font-semibold"
                >
                  {item.label}
                </span>
                {item.caption ? (
                  <Muted className="mt-0.5 block text-[12.5px]">
                    {item.caption}
                  </Muted>
                ) : null}
              </span>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {items.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-2 rounded-pill border px-4 py-2"
              style={{
                borderColor: "var(--site-line)",
                background: "var(--site-surface)",
              }}
            >
              {item.icon ? (
                <span
                  style={{ color: "var(--site-icon-color)" }}
                  className="text-lg leading-none"
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
                {item.caption ? (
                  <span style={{ color: "var(--site-mute)" }}>
                    {" "}
                    · {item.caption}
                  </span>
                ) : null}
              </span>
            </span>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
