import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SectionHeading, Muted, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "map" }>["props"];

/** Free-form map of any address (keyless Google Maps embed). Distinct from the
 *  auto-populate `location` section, which derives from the property + its POIs. */
export function MapSection({ props }: { props: Props }) {
  const address = props.address?.trim();
  if (!address) return null;
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(
    address,
  )}&z=${props.zoom}&output=embed`;
  return (
    <SectionShell>
      {props.heading ? (
        <SectionHeading className="mb-3">{props.heading}</SectionHeading>
      ) : null}
      {props.caption ? (
        <Muted className="mb-8 text-center text-base">{props.caption}</Muted>
      ) : null}
      <Card>
        <iframe
          src={src}
          title={props.heading || address}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-80 w-full border-0 md:h-96"
        />
      </Card>
    </SectionShell>
  );
}
