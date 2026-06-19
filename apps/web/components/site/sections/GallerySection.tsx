import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { GalleryData } from "@/lib/site/types";

import { SectionShell, SectionHeading, Muted, siteImageStyle } from "./_shared";

type Props = Extract<WebsiteSection, { type: "gallery" }>["props"];

export function GallerySection({
  props,
  data,
}: {
  props: Props;
  data?: GalleryData;
}) {
  const images = (data?.images ?? []).slice(0, props.max);
  const cols =
    props.layout === "list"
      ? "grid-cols-1"
      : props.layout === "carousel"
        ? "grid-flow-col auto-cols-[80%] sm:auto-cols-[45%] overflow-x-auto"
        : "grid-cols-2 md:grid-cols-3";

  return (
    <SectionShell>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      {images.length === 0 ? (
        <Muted className="text-center text-sm">
          Photos from your property appear here.
        </Muted>
      ) : (
        <div className={`grid gap-3 ${cols}`}>
          {images.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={img.url}
              alt={img.caption ?? ""}
              loading="lazy"
              style={siteImageStyle}
              className="aspect-[4/3] w-full object-cover"
            />
          ))}
        </div>
      )}
    </SectionShell>
  );
}
