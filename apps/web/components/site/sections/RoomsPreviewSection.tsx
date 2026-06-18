import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { RoomsPreviewData } from "@/lib/site/types";

import { SectionShell, SectionHeading, Muted, Card } from "./_shared";

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

export function RoomsPreviewSection({
  props,
  data,
}: {
  props: Props;
  data?: RoomsPreviewData;
}) {
  const rooms = (data?.rooms ?? []).slice(0, props.max);
  const cta = props.ctaLabel ?? "View & book";

  return (
    <SectionShell>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      {rooms.length === 0 ? (
        <Muted className="text-center text-sm">
          Rooms from your property appear here.
        </Muted>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => {
            const price = priceLabel(room.price, room.currency);
            return (
              <Card key={room.id} className="flex flex-col">
                {room.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={room.imageUrl}
                    alt={room.name}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : null}
                <div className="flex flex-1 flex-col p-5">
                  <h3
                    style={{
                      fontFamily: "var(--site-font-heading)",
                      color: "var(--site-ink)",
                    }}
                    className="text-lg font-semibold"
                  >
                    {room.name}
                  </h3>
                  {room.description ? (
                    <p
                      style={{ color: "var(--site-mute)" }}
                      className="mt-1.5 line-clamp-3 text-sm leading-relaxed"
                    >
                      {room.description}
                    </p>
                  ) : null}
                  <div className="mt-4 flex items-center justify-between gap-3 pt-2">
                    {price ? (
                      <span
                        style={{ color: "var(--site-ink)" }}
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
                      href={room.bookHref}
                      data-vilo-book
                      style={{
                        background: "var(--site-accent)",
                        color: "var(--site-accent-ink)",
                        borderRadius: "var(--site-radius)",
                      }}
                      className="shrink-0 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                    >
                      {cta}
                    </a>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}
