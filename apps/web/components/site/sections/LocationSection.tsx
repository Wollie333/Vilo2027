import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { LocationData } from "@/lib/site/types";

import { SectionShell, SectionHeading, Muted, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "location" }>["props"];
type Poi = NonNullable<LocationData["pois"]>[number];

function PoiList({
  pois,
  className = "space-y-2.5",
}: {
  pois: Poi[];
  className?: string;
}) {
  return (
    <ul className={className}>
      {pois.map((poi, i) => (
        <li
          key={i}
          style={{ borderColor: "var(--site-line)" }}
          className="flex items-center justify-between border-b pb-2.5"
        >
          <span
            style={{ color: "var(--site-ink)" }}
            className="text-sm font-medium"
          >
            {poi.name}
            {poi.category ? (
              <span
                style={{ color: "var(--site-mute)" }}
                className="font-normal"
              >
                {" "}
                · {poi.category}
              </span>
            ) : null}
          </span>
          {poi.distance ? (
            <span style={{ color: "var(--site-mute)" }} className="text-sm">
              {poi.distance}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function LocationSection({
  props,
  data,
}: {
  props: Props;
  data?: LocationData;
}) {
  const pois = data?.pois ?? [];
  const variant = props.variant ?? "split";
  const showMap =
    props.show_map && variant !== "list" && Boolean(data?.mapEmbedUrl);
  const mapUrl = data?.mapEmbedUrl ?? "";

  return (
    <SectionShell surface>
      {props.heading ? (
        <SectionHeading className="mb-3">{props.heading}</SectionHeading>
      ) : null}
      {data?.address ? (
        <Muted className="mb-8 text-center text-base">{data.address}</Muted>
      ) : null}

      {variant === "stacked" ? (
        <div className="space-y-6">
          {showMap ? (
            <Card>
              <iframe
                src={mapUrl}
                title="Map"
                loading="lazy"
                className="h-72 w-full border-0"
              />
            </Card>
          ) : null}
          {pois.length > 0 ? (
            <PoiList
              pois={pois}
              className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2"
            />
          ) : null}
        </div>
      ) : variant === "list" ? (
        pois.length > 0 ? (
          <div className="mx-auto max-w-2xl">
            <PoiList pois={pois} />
          </div>
        ) : null
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {showMap ? (
            <Card>
              <iframe
                src={mapUrl}
                title="Map"
                loading="lazy"
                className="h-64 w-full border-0 md:h-full"
              />
            </Card>
          ) : null}
          {pois.length > 0 ? <PoiList pois={pois} /> : null}
        </div>
      )}
    </SectionShell>
  );
}
