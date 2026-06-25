import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { RateTableData, SeasonalPricingData } from "@/lib/site/types";

import { SectionShell, SectionHeading, Muted, Card } from "./_shared";

type RoomRatesProps = Extract<WebsiteSection, { type: "room_rates" }>["props"];
type SeasonalProps = Extract<
  WebsiteSection,
  { type: "seasonal_pricing" }
>["props"];

function money(price?: number | null, currency?: string | null) {
  if (price == null) return null;
  const ccy = currency ?? "ZAR";
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: ccy,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${ccy} ${price}`;
  }
}

/** A row to render — the same shape whether it came from live data or manual. */
type Row = { room: string; price: string; detail?: string };

/**
 * Editable "Room rate" block. By default (source "auto") it pulls the host's
 * live room rates — the same source as the rate_table — so the host never
 * retypes what the app already knows. In "manual" mode it renders the host-typed
 * rows (price as free text). Falls back to the manual rows if there's no live
 * data, so it never renders empty.
 */
export function RoomRatesSection({
  props,
  data,
}: {
  props: RoomRatesProps;
  data?: RateTableData;
}) {
  const live =
    props.source !== "manual"
      ? (data?.rows ?? []).map(
          (r): Row => ({
            room: r.name,
            price:
              r.nightlyFrom != null
                ? `${money(r.nightlyFrom, r.currency)} / night`
                : "—",
            detail: r.maxGuests ? `Sleeps ${r.maxGuests}` : undefined,
          }),
        )
      : [];
  const rows: Row[] = live.length ? live : (props.items ?? []);

  return (
    <SectionShell>
      {props.heading ? (
        <SectionHeading className="mb-8">{props.heading}</SectionHeading>
      ) : null}

      {rows.length === 0 ? (
        <Muted className="text-center text-sm">
          Your room rates appear here.
        </Muted>
      ) : (
        <Card>
          <ul>
            {rows.map((item, i) => (
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

/** A season card to render — uniform whether from live data or manual. */
type SeasonCard = {
  season: string;
  dates?: string;
  price: string;
  detail?: string;
};

/**
 * Editable "Seasonal pricing" block. By default (source "auto") it pulls the
 * host's configured seasonal rules (property_seasonal_pricing, grouped by label)
 * so the page stays in sync with the app. In "manual" mode it renders the
 * host-typed rows. Falls back to the manual rows if there's no live data.
 */
export function SeasonalPricingSection({
  props,
  data,
}: {
  props: SeasonalProps;
  data?: SeasonalPricingData;
}) {
  const live =
    props.source !== "manual"
      ? (data?.seasons ?? []).map(
          (s): SeasonCard => ({
            season: s.label,
            dates: s.dates,
            price:
              s.priceFrom != null
                ? `from ${money(s.priceFrom, s.currency)}`
                : "",
          }),
        )
      : [];
  const cards: SeasonCard[] = live.length ? live : (props.items ?? []);

  return (
    <SectionShell>
      {props.heading ? (
        <SectionHeading className="mb-8">{props.heading}</SectionHeading>
      ) : null}

      {cards.length === 0 ? (
        <Muted className="text-center text-sm">
          Your seasonal pricing appears here.
        </Muted>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((item, i) => (
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
                {item.price ? (
                  <span
                    style={{ color: "var(--site-accent)" }}
                    className="mt-2 text-xl font-semibold"
                  >
                    {item.price}
                  </span>
                ) : null}
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
