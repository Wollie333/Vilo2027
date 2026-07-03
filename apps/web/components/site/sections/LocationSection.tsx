import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { LocationData } from "@/lib/site/types";

// Bare element (Elementor reframe): renders bare (no self <section>/band/width-
// clamp, incl. the old `surface` band); the SECTION owns padding + width +
// background (the surface band is re-seeded as the section `bg`) and the heading is
// a separate Heading element above. `props.heading` stays legacy.
import { SectionHeading, Muted, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "location" }>["props"];

// Per-element style hook (Elementor accordion) — reads `--el-card-*`.
const locCardStyle = {
  background: "var(--el-card-bg, var(--site-surface))",
  border: "var(--el-card-bd, var(--site-card-border))",
  borderRadius: "var(--el-card-radius, var(--site-card-radius))",
  boxShadow: "var(--el-card-shadow, var(--site-card-shadow))",
} as const;
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
            style={{
              color: "var(--el-poi-fg, var(--site-ink))",
              fontSize: "var(--el-poi-size, 0.875rem)",
            }}
            className="font-medium"
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
    <>
      {props.heading ? (
        <SectionHeading className="mb-3">{props.heading}</SectionHeading>
      ) : null}
      {data?.address ? (
        <Muted
          className="mb-8 text-center text-base"
          style={{ color: "var(--el-address-fg, var(--site-mute))" }}
        >
          {data.address}
        </Muted>
      ) : null}

      {variant === "stacked" ? (
        <div className="space-y-6">
          {showMap ? (
            <Card style={locCardStyle}>
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
            <Card style={locCardStyle}>
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
    </>
  );
}
