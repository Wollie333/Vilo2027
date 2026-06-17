import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { LocationData } from "@/lib/site/types";

import { SectionShell, SectionHeading, Muted, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "location" }>["props"];

export function LocationSection({
  props,
  data,
}: {
  props: Props;
  data?: LocationData;
}) {
  const pois = data?.pois ?? [];
  return (
    <SectionShell surface>
      {props.heading ? (
        <SectionHeading className="mb-3">{props.heading}</SectionHeading>
      ) : null}
      {data?.address ? (
        <Muted className="mb-8 text-center text-base">{data.address}</Muted>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {props.show_map && data?.mapEmbedUrl ? (
          <Card>
            <iframe
              src={data.mapEmbedUrl}
              title="Map"
              loading="lazy"
              className="h-64 w-full border-0 md:h-full"
            />
          </Card>
        ) : null}

        {pois.length > 0 ? (
          <ul className="space-y-2.5">
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
                  <span
                    style={{ color: "var(--site-mute)" }}
                    className="text-sm"
                  >
                    {poi.distance}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </SectionShell>
  );
}
