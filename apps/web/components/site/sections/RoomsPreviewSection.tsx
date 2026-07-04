import type { CSSProperties } from "react";

import type { WebsiteSection } from "@/lib/website/sections.schema";
import type {
  RoomCard as RoomCardData,
  RoomsPreviewData,
} from "@/lib/site/types";

import { SiteImg } from "../SiteImg";
import { SectionHeading, Muted, Card, siteImageStyle } from "./_shared";

type Props = Extract<WebsiteSection, { type: "rooms_preview" }>["props"];

function priceLabel(price?: number | null, currency?: string | null) {
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

function RoomCardView({ room, cta }: { room: RoomCardData; cta: string }) {
  const price = priceLabel(room.price, room.currency);
  return (
    <Card
      // `site-room-card` is the STABLE hook the per-theme skins target for the
      // card lift/hover — depth-independent, so wrapping the section in the
      // responsive content band never breaks it.
      className="site-room-card flex flex-col"
      // Per-element styling (Elementor): the "card" element controls read
      // `--el-card-*`, falling back to the theme's own card tokens when unset.
      style={{
        background: "var(--el-card-bg, var(--site-surface))",
        border: "var(--el-card-bd, var(--site-card-border))",
        borderRadius: "var(--el-card-radius, var(--site-card-radius))",
        boxShadow: "var(--el-card-shadow, var(--site-card-shadow))",
        ...(room.featured ? { boxShadow: "0 0 0 2px var(--site-accent)" } : {}),
      }}
    >
      <div className="relative">
        {room.imageUrl ? (
          <SiteImg
            src={room.imageUrl}
            alt={room.name}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            widths={[320, 480, 640, 768]}
            style={{
              aspectRatio: "var(--site-card-ratio)",
              borderRadius: "var(--el-image-radius, 0px)",
            }}
            className="w-full object-cover"
          />
        ) : null}
        {room.badge || room.featured ? (
          <span
            style={{
              background: "var(--el-badge-bg, var(--site-accent))",
              color: "var(--el-badge-fg, var(--site-accent-ink))",
              borderRadius: "var(--el-badge-radius, 9999px)",
            }}
            className="absolute left-3 top-3 rounded-pill px-2.5 py-1 text-[11px] font-semibold shadow-sm"
          >
            {room.badge?.trim() || "Featured"}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3
          style={{
            fontFamily: "var(--site-font-heading)",
            color: "var(--el-title-fg, var(--site-ink))",
            fontSize: "var(--el-title-size, 1.125rem)",
            fontWeight: "var(--el-title-weight, 600)",
            lineHeight: "var(--el-title-lh, 1.3)",
            letterSpacing: "var(--el-title-ls, normal)",
            textTransform:
              "var(--el-title-tt, none)" as CSSProperties["textTransform"],
          }}
          className="text-lg font-semibold"
        >
          {room.detailHref ? (
            <a
              href={room.detailHref}
              className="transition-opacity hover:opacity-80"
            >
              {room.name}
            </a>
          ) : (
            room.name
          )}
        </h3>
        {room.facts && room.facts.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {room.facts.map((f, i) => (
              <span
                key={i}
                style={{
                  background: "var(--site-bg)",
                  color: "var(--site-mute)",
                  borderColor: "var(--site-line)",
                }}
                className="rounded-pill border px-2 py-0.5 text-[11px] font-medium"
              >
                {f}
              </span>
            ))}
          </div>
        ) : null}
        {room.description ? (
          <p
            style={{
              color: "var(--el-desc-fg, var(--site-mute))",
              fontSize: "var(--el-desc-size, 0.875rem)",
              lineHeight: "var(--el-desc-lh, 1.625)",
              letterSpacing: "var(--el-desc-ls, normal)",
            }}
            className="mt-2 line-clamp-3 text-sm leading-relaxed"
          >
            {room.description}
          </p>
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-3 pt-2">
          {price ? (
            <span
              style={{
                color: "var(--el-price-fg, var(--site-ink))",
                fontSize: "var(--el-price-size, 0.875rem)",
                fontWeight: "var(--el-price-weight, 600)",
                letterSpacing: "var(--el-price-ls, normal)",
              }}
              className="text-sm font-semibold"
            >
              {price}
              <span
                style={{ color: "var(--site-mute)" }}
                className="font-normal"
              >
                {" "}
                / night
              </span>
            </span>
          ) : (
            <span />
          )}
          <a
            href={room.detailHref ?? room.bookHref}
            // Room card now opens the room's detail page (where booking happens),
            // so it's not a booking_click — only flag the book deep-link fallback.
            {...(room.detailHref ? {} : { "data-wielo-book": "" })}
            style={{
              background: "var(--el-button-bg, var(--site-btn-primary-bg))",
              color: "var(--el-button-fg, var(--site-btn-primary-color))",
              border: "var(--el-button-bd, var(--site-btn-primary-border))",
              borderRadius:
                "var(--el-button-radius, var(--site-btn-primary-radius))",
            }}
            className="shrink-0 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            {cta}
          </a>
        </div>
      </div>
    </Card>
  );
}

// SHOWCASE — full-width alternating image/content splits (the designed Rooms
// page): a framed photo with a floating price badge beside a tag, big name,
// description, a two-column facts list, and View + Book actions. Reusable by any
// theme via `display:"showcase"`; all data is the same live RoomCard.
function RoomShowcase({ rooms, cta }: { rooms: RoomCardData[]; cta: string }) {
  return (
    <div className="site-room-showcase flex flex-col gap-16 md:gap-24">
      {rooms.map((room, i) => {
        const price = priceLabel(room.price, room.currency);
        const reverse = i % 2 === 1;
        const bookLabel = price ? `Book · ${price}` : cta;
        return (
          <div
            key={room.id}
            className="site-room-row grid items-center gap-8 md:grid-cols-2 md:gap-14"
          >
            <div className={`relative ${reverse ? "md:order-last" : ""}`}>
              {room.imageUrl ? (
                <SiteImg
                  src={room.imageUrl}
                  alt={room.name}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  widths={[640, 768, 1024, 1280]}
                  style={{ borderRadius: "var(--site-img-radius)" }}
                  className="site-room-frame aspect-[4/3] w-full object-cover"
                />
              ) : null}
              {price ? (
                <div
                  className="site-room-badge absolute -bottom-5 right-4 px-5 py-3 text-center"
                  style={{
                    background: "var(--site-surface)",
                    borderRadius: "var(--site-radius)",
                    boxShadow: "var(--site-card-shadow)",
                  }}
                >
                  <div
                    className="leading-none"
                    style={{
                      color: "var(--el-price-fg, var(--site-secondary))",
                      fontSize: "var(--el-price-size, 1.5rem)",
                      fontWeight: "var(--el-price-weight, 700)",
                      fontFamily: "var(--site-font-heading)",
                    }}
                  >
                    {price}
                  </div>
                  <div
                    className="mt-1 text-[11px] font-medium uppercase tracking-wide"
                    style={{ color: "var(--site-mute)" }}
                  >
                    Per night
                  </div>
                </div>
              ) : null}
            </div>
            <div>
              {room.facts && room.facts.length > 0 ? (
                <div
                  className="site-room-tag text-xs font-bold uppercase tracking-[0.14em]"
                  style={{ color: "var(--el-tag-fg, var(--site-secondary))" }}
                >
                  {room.facts.slice(0, 2).join(" · ")}
                </div>
              ) : null}
              <h3
                className="site-room-name mt-3"
                style={{
                  fontFamily: "var(--site-font-heading)",
                  fontWeight:
                    "var(--el-title-weight, var(--site-weight-heading))" as unknown as number,
                  fontSize: "var(--el-title-size, clamp(1.9rem, 4vw, 3rem))",
                  lineHeight: "var(--el-title-lh, 1.02)" as unknown as number,
                  letterSpacing:
                    "var(--el-title-ls, var(--site-tracking-heading))",
                  color: "var(--el-title-fg, var(--site-ink))",
                }}
              >
                {room.detailHref ? (
                  <a
                    href={room.detailHref}
                    className="transition-opacity hover:opacity-80"
                  >
                    {room.name}
                  </a>
                ) : (
                  room.name
                )}
              </h3>
              {room.description ? (
                <p
                  className="mt-4 max-w-[52ch] leading-relaxed"
                  style={{
                    color: "var(--el-desc-fg, var(--site-mute))",
                    fontSize: "var(--el-desc-size, 1rem)",
                  }}
                >
                  {room.description}
                </p>
              ) : null}
              {room.facts && room.facts.length > 0 ? (
                <div className="site-room-amen mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {room.facts.map((f, j) => (
                    <div
                      key={j}
                      className="flex items-center gap-2.5 text-sm font-medium"
                      style={{ color: "var(--site-ink)" }}
                    >
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: "var(--site-accent)" }}
                      />
                      {f}
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-8 flex flex-wrap gap-3.5">
                {room.detailHref ? (
                  <a
                    href={room.detailHref}
                    className="inline-flex items-center justify-center px-7 py-3.5 text-sm font-semibold transition-colors"
                    style={{
                      background: "transparent",
                      color: "var(--site-ink)",
                      border: "1px solid var(--site-line)",
                      borderRadius: "var(--site-btn-primary-radius)",
                    }}
                  >
                    View room
                  </a>
                ) : null}
                <a
                  href={room.bookHref}
                  data-wielo-book=""
                  className="inline-flex items-center justify-center px-7 py-3.5 text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{
                    background:
                      "var(--el-button-bg, var(--site-btn-primary-bg))",
                    color: "var(--el-button-fg, var(--site-btn-primary-color))",
                    border:
                      "var(--el-button-bd, var(--site-btn-primary-border))",
                    borderRadius:
                      "var(--el-button-radius, var(--site-btn-primary-radius))",
                  }}
                >
                  {bookLabel}
                </a>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoomGrid({
  rooms,
  cta,
  layout,
}: {
  rooms: RoomCardData[];
  cta: string;
  layout?: "grid" | "list" | "carousel";
}) {
  const cols =
    layout === "list"
      ? "grid-cols-1"
      : layout === "carousel"
        ? "grid-flow-col auto-cols-[85%] overflow-x-auto sm:auto-cols-[45%] lg:auto-cols-[31%]"
        : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`grid gap-5 ${cols}`}>
      {rooms.map((room) => (
        <RoomCardView key={room.id} room={room} cta={cta} />
      ))}
    </div>
  );
}

export function RoomsPreviewSection({
  props,
  data,
}: {
  props: Props;
  data?: RoomsPreviewData;
}) {
  const rooms = (data?.rooms ?? []).slice(0, props.max);
  const groups = data?.groups;
  const cta = props.ctaLabel ?? "View & book";
  const showcase = props.display === "showcase";

  // Segment rooms into contiguous runs by property (rooms are saved grouped per
  // property) so each property with an override can show its own header.
  const runs: Array<{ propertyId?: string; rooms: RoomCardData[] }> = [];
  if (groups) {
    for (const r of rooms) {
      const last = runs[runs.length - 1];
      if (last && last.propertyId === r.propertyId) last.rooms.push(r);
      else runs.push({ propertyId: r.propertyId, rooms: [r] });
    }
  }

  return (
    // Bare element (Elementor reframe): just the grid. No self-wrapping <section>,
    // no band padding, no content-width clamp, no heading — ALL of that is owned by
    // the SECTION the block sits in (padding/width via the section node, background
    // via the section gear) and by a separate Heading element the host places above
    // it. `props.heading` is legacy: rendered only if a page still carries it, so
    // pre-reframe pages don't silently lose their title before they're re-seeded.
    <>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}

      {rooms.length === 0 ? (
        <Muted className="text-center text-sm">
          Rooms from your property appear here.
        </Muted>
      ) : showcase ? (
        <RoomShowcase rooms={rooms} cta={cta} />
      ) : groups ? (
        <div className="space-y-12">
          {runs.map((run, i) => {
            const g = run.propertyId ? groups[run.propertyId] : undefined;
            return (
              <div key={run.propertyId ?? i}>
                {g ? (
                  <div className="mb-6">
                    {g.heroUrl ? (
                      <SiteImg
                        src={g.heroUrl}
                        alt={g.heading ?? ""}
                        sizes="100vw"
                        widths={[768, 1024, 1280, 1600]}
                        style={siteImageStyle}
                        className="mb-5 aspect-[16/6] w-full object-cover"
                      />
                    ) : null}
                    {g.heading ? (
                      <h3
                        style={{
                          fontFamily: "var(--site-font-heading)",
                          color: "var(--site-ink)",
                        }}
                        className="text-2xl font-semibold"
                      >
                        {g.heading}
                      </h3>
                    ) : null}
                    {g.intro ? (
                      <Muted className="mt-1.5 max-w-2xl text-[15px]">
                        {g.intro}
                      </Muted>
                    ) : null}
                  </div>
                ) : null}
                <RoomGrid rooms={run.rooms} cta={cta} layout={props.layout} />
              </div>
            );
          })}
        </div>
      ) : (
        <RoomGrid rooms={rooms} cta={cta} layout={props.layout} />
      )}
    </>
  );
}
