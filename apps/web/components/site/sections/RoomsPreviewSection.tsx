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
      className="flex flex-col"
      // Per-element styling (Elementor): the "card" element controls read
      // `--el-card-*`, falling back to the theme's own card tokens when unset.
      style={{
        background: "var(--el-card-bg, var(--site-surface))",
        border: "var(--el-card-bd, var(--site-card-border))",
        borderRadius: "var(--el-card-radius, var(--site-card-radius))",
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
    // Bare element (Elementor reframe): no self-wrapping <section>. The block's
    // BAND — background, tone, vertical padding — is now owned by the section node
    // it sits in (styleable via the section gear), so the host controls it. Only a
    // content max-width + horizontal gutter stay here for readability. The heading
    // is optional/legacy — hosts can clear it and add a Heading element instead.
    <div className="mx-auto w-full max-w-5xl px-5 py-16 md:py-20">
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}

      {rooms.length === 0 ? (
        <Muted className="text-center text-sm">
          Rooms from your property appear here.
        </Muted>
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
    </div>
  );
}
