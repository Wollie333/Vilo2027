import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { RateRow, RateTableData } from "@/lib/site/types";

import { SectionHeading, Muted, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "rate_table" }>["props"];

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

/**
 * Live nightly-rate table (Phase 6B). Rates are read server-side from the live
 * rooms — DISPLAY ONLY: the Book link deep-links into the engine, which always
 * re-prices the real stay (dates/guests/seasonal/occupancy). Never trusts a
 * client-supplied price.
 */
export function RateTableSection({
  props,
  data,
}: {
  props: Props;
  data?: RateTableData;
}) {
  const rows = data?.rows ?? [];
  const cta = props.ctaLabel ?? "Book";

  return (
    // Bare element (Elementor reframe): just the rate table. No self-wrapping
    // <section>, no band padding, no width clamp, no heading — ALL owned by the
    // SECTION the block sits in (padding/width/background via the section node +
    // gear) and by a separate Heading element the host places above it. The `note`
    // stays part of the block. `props.heading` is legacy: rendered only if a page
    // still carries it, so pre-reframe pages keep their title.
    <>
      {props.heading ? (
        <SectionHeading className="mb-8">{props.heading}</SectionHeading>
      ) : null}

      {rows.length === 0 ? (
        <Muted className="text-center text-sm">
          Your room rates appear here.
        </Muted>
      ) : (
        <Card
          style={{
            background: "var(--el-card-bg, var(--site-surface))",
            border: "var(--el-card-bd, var(--site-card-border))",
            borderRadius: "var(--el-card-radius, var(--site-card-radius))",
            boxShadow: "var(--el-card-shadow, var(--site-card-shadow))",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--site-line)" }}>
                  <Th>Room</Th>
                  <Th className="text-right">From / night</Th>
                  <Th className="hidden text-right sm:table-cell">Weekend</Th>
                  <Th className="hidden text-right sm:table-cell">
                    Min nights
                  </Th>
                  <Th className="text-right" srOnly>
                    {cta}
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <RateTableRow key={row.roomId} row={row} cta={cta} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {props.note ? (
        <Muted className="mt-4 text-center text-xs">{props.note}</Muted>
      ) : null}
    </>
  );
}

function Th({
  children,
  className = "",
  srOnly = false,
}: {
  children: React.ReactNode;
  className?: string;
  srOnly?: boolean;
}) {
  return (
    <th
      style={{ color: "var(--site-mute)" }}
      className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wide ${className}`}
    >
      <span className={srOnly ? "sr-only" : undefined}>{children}</span>
    </th>
  );
}

function RateTableRow({ row, cta }: { row: RateRow; cta: string }) {
  const from = money(row.nightlyFrom, row.currency);
  const weekend = money(row.weekendPrice, row.currency);
  return (
    <tr style={{ borderBottom: "1px solid var(--site-line)" }}>
      <td className="px-4 py-4">
        <span
          style={{
            color: "var(--el-label-fg, var(--site-ink))",
            fontSize: "var(--el-label-size, 0.875rem)",
          }}
          className="font-semibold"
        >
          {row.name}
        </span>
        {row.maxGuests ? (
          <span
            style={{ color: "var(--site-mute)" }}
            className="ml-2 text-[12px]"
          >
            · Sleeps {row.maxGuests}
          </span>
        ) : null}
      </td>
      <td
        style={{
          color: "var(--el-price-fg, var(--site-ink))",
          fontSize: "var(--el-price-size, 0.875rem)",
          fontWeight: "var(--el-price-weight, 600)",
        }}
        className="px-4 py-4 text-right"
      >
        {from ?? "—"}
      </td>
      <td
        style={{ color: "var(--site-mute)" }}
        className="hidden px-4 py-4 text-right sm:table-cell"
      >
        {weekend ?? "—"}
      </td>
      <td
        style={{ color: "var(--site-mute)" }}
        className="hidden px-4 py-4 text-right sm:table-cell"
      >
        {row.minNights ?? "—"}
      </td>
      <td className="px-4 py-4 text-right">
        <a
          href={row.bookHref}
          data-wielo-book
          style={{
            background: "var(--el-button-bg, var(--site-btn-primary-bg))",
            color: "var(--el-button-fg, var(--site-btn-primary-color))",
            border: "var(--el-button-bd, var(--site-btn-primary-border))",
            borderRadius:
              "var(--el-button-radius, var(--site-btn-primary-radius))",
          }}
          className="inline-flex px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
        >
          {cta}
        </a>
      </td>
    </tr>
  );
}
