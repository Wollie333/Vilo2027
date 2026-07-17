import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { RateTableData, SeasonalPricingData } from "@/lib/site/types";

import { SectionHeading, Muted, Card } from "./_shared";

type RoomRatesProps = Extract<WebsiteSection, { type: "room_rates" }>["props"];
type SeasonalProps = Extract<
  WebsiteSection,
  { type: "seasonal_pricing" }
>["props"];

// Per-element style hook (Elementor accordion) — reads `--el-card-*`.
const rateCardStyle = {
  background: "var(--el-card-bg, var(--site-surface))",
  border: "var(--el-card-bd, var(--site-card-border))",
  borderRadius: "var(--el-card-radius, var(--site-card-radius))",
  boxShadow: "var(--el-card-shadow, var(--site-card-shadow))",
} as const;

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
  interactive = false,
}: {
  props: RoomRatesProps;
  data?: RateTableData;
  /** Builder canvas: keep the empty-state placeholder so the block is visible +
   *  selectable. On the LIVE site an empty auto block renders nothing (below). */
  interactive?: boolean;
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

  // On the LIVE site (`interactive`) an empty rates block renders NOTHING, never a
  // guest-facing "your rates appear here" placeholder. The builder / preview
  // (`!interactive`) keeps the placeholder so the block stays visible + selectable.
  if (rows.length === 0 && interactive) return null;

  return (
    // Bare element (Elementor reframe): just the rate list. The SECTION owns the
    // band (padding/width/background via the section node + gear); the heading is a
    // separate element the host places above it; the `note` stays part of the block.
    // `props.heading` is legacy — kept so pre-reframe pages don't lose their title.
    <>
      {props.heading ? (
        <SectionHeading className="mb-8">{props.heading}</SectionHeading>
      ) : null}

      {rows.length === 0 ? (
        <Muted className="text-center text-sm">
          Your room rates appear here.
        </Muted>
      ) : (
        <Card style={rateCardStyle}>
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
                    style={{
                      color: "var(--el-label-fg, var(--site-ink))",
                      fontSize: "var(--el-label-size, 1rem)",
                    }}
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
                  style={{
                    color: "var(--el-price-fg, var(--site-ink))",
                    fontSize: "var(--el-price-size, 1rem)",
                    fontWeight: "var(--el-price-weight, 600)",
                  }}
                  className="shrink-0"
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
    </>
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
  interactive = false,
}: {
  props: SeasonalProps;
  data?: SeasonalPricingData;
  /** Builder canvas: keep the empty-state placeholder so the block is visible +
   *  selectable. On the LIVE site an empty auto block renders nothing (below). */
  interactive?: boolean;
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

  // On the LIVE site (`interactive`) render ONLY when the host has seasonal pricing
  // set — never a guest-facing "your seasonal pricing appears here" placeholder.
  // The builder / preview (`!interactive`) keeps the placeholder.
  if (cards.length === 0 && interactive) return null;

  return (
    // Bare element (Elementor reframe): just the season cards. The SECTION owns the
    // band (padding/width/background via the section node + gear); the heading is a
    // separate element the host places above it; the `note` stays part of the block.
    // `props.heading` is legacy — kept so pre-reframe pages don't lose their title.
    <>
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
            <Card key={i} style={rateCardStyle}>
              <div className="flex h-full flex-col gap-1 px-5 py-5">
                <span
                  style={{
                    color: "var(--el-label-fg, var(--site-ink))",
                    fontSize: "var(--el-label-size, 1.125rem)",
                  }}
                  className="font-semibold"
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
                    style={{
                      color: "var(--el-price-fg, var(--site-accent))",
                      fontSize: "var(--el-price-size, 1.25rem)",
                      fontWeight: "var(--el-price-weight, 600)",
                    }}
                    className="mt-2"
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
    </>
  );
}
