import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SectionHeading, Muted, Card } from "./_shared";

type RoomRatesProps = Extract<WebsiteSection, { type: "room_rates" }>["props"];
type SeasonalProps = Extract<
  WebsiteSection,
  { type: "seasonal_pricing" }
>["props"];

/**
 * Editable "Room rate" block — a manual list of room types + their price. The
 * host types the price as free text (e.g. "From R1,200 / night"), so this is
 * display-only: no live pricing, no currency formatting. For the real, live
 * nightly rates use the `rate_table` section instead.
 */
export function RoomRatesSection({ props }: { props: RoomRatesProps }) {
  const items = props.items ?? [];
  return (
    <SectionShell>
      {props.heading ? (
        <SectionHeading className="mb-8">{props.heading}</SectionHeading>
      ) : null}

      {items.length === 0 ? (
        <Muted className="text-center text-sm">
          Add your room types and their rates.
        </Muted>
      ) : (
        <Card>
          <ul>
            {items.map((item, i) => (
              <li
                key={i}
                style={{
                  borderTop: i === 0 ? undefined : "1px solid var(--site-line)",
                }}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4"
              >
                <div className="min-w-0">
                  <span
                    style={{ color: "var(--site-ink)" }}
                    className="font-semibold"
                  >
                    {item.room}
                  </span>
                  {item.detail ? (
                    <span
                      style={{ color: "var(--site-mute)" }}
                      className="mt-0.5 block text-[13px]"
                    >
                      {item.detail}
                    </span>
                  ) : null}
                </div>
                <span
                  style={{ color: "var(--site-ink)" }}
                  className="shrink-0 font-semibold"
                >
                  {item.price}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {props.note ? (
        <Muted className="mt-4 text-center text-xs">{props.note}</Muted>
      ) : null}
    </SectionShell>
  );
}

/**
 * Editable "Seasonal pricing" block — a manual list of seasons (name + date
 * range) and their price/modifier, rendered as responsive cards. Display-only,
 * same as the room rates block.
 */
export function SeasonalPricingSection({ props }: { props: SeasonalProps }) {
  const items = props.items ?? [];
  return (
    <SectionShell>
      {props.heading ? (
        <SectionHeading className="mb-8">{props.heading}</SectionHeading>
      ) : null}

      {items.length === 0 ? (
        <Muted className="text-center text-sm">
          Add your seasons and their rates.
        </Muted>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <Card key={i}>
              <div className="flex h-full flex-col gap-1 px-5 py-5">
                <span
                  style={{ color: "var(--site-ink)" }}
                  className="text-lg font-semibold"
                >
                  {item.season}
                </span>
                {item.dates ? (
                  <span
                    style={{ color: "var(--site-mute)" }}
                    className="text-[13px]"
                  >
                    {item.dates}
                  </span>
                ) : null}
                <span
                  style={{ color: "var(--site-accent)" }}
                  className="mt-2 text-xl font-semibold"
                >
                  {item.price}
                </span>
                {item.detail ? (
                  <span
                    style={{ color: "var(--site-mute)" }}
                    className="mt-1 text-[13px]"
                  >
                    {item.detail}
                  </span>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      {props.note ? (
        <Muted className="mt-4 text-center text-xs">{props.note}</Muted>
      ) : null}
    </SectionShell>
  );
}
