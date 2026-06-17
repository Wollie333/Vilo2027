import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { ReviewsData } from "@/lib/site/types";

import { SectionShell, SectionHeading, Muted, Card, Stars } from "./_shared";

type Props = Extract<WebsiteSection, { type: "reviews" }>["props"];

export function ReviewsSection({
  props,
  data,
}: {
  props: Props;
  data?: ReviewsData;
}) {
  const items = (data?.items ?? []).slice(0, props.max);

  return (
    <SectionShell>
      {props.heading ? (
        <SectionHeading className="mb-3">{props.heading}</SectionHeading>
      ) : null}
      {data?.average != null && data?.count ? (
        <div className="mb-10 text-center">
          <Stars rating={data.average} />
          <Muted className="mt-1 text-sm">
            {data.average.toFixed(1)} · {data.count} review
            {data.count === 1 ? "" : "s"}
          </Muted>
        </div>
      ) : null}

      {items.length === 0 ? (
        <Muted className="text-center text-sm">
          Guest reviews from your property appear here.
        </Muted>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {items.map((r, i) => (
            <Card key={i} className="p-6">
              <Stars rating={r.rating} />
              <p
                style={{ color: "var(--site-ink)" }}
                className="mt-3 text-sm leading-relaxed"
              >
                “{r.body}”
              </p>
              <p
                style={{ color: "var(--site-mute)" }}
                className="mt-3 text-sm font-medium"
              >
                {r.author}
                {r.date ? (
                  <span className="font-normal"> · {r.date}</span>
                ) : null}
              </p>
            </Card>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
