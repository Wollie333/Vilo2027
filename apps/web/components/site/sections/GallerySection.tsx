import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { GalleryData } from "@/lib/site/types";

import { GalleryLightbox } from "../GalleryLightbox";
import { SectionHeading, Muted } from "./_shared";

type Props = Extract<WebsiteSection, { type: "gallery" }>["props"];

export function GallerySection({
  props,
  data,
}: {
  props: Props;
  data?: GalleryData;
}) {
  // Live host photos win; otherwise the theme's stock demo photos (preview / until
  // the host uploads their own). Same swap pattern as the rest of the design.
  const live = data?.images ?? [];
  const stock = (props.images ?? []).map((i) => ({
    url: i.url,
    caption: i.caption ?? null,
  }));
  const images = (live.length ? live : stock).slice(0, props.max);

  return (
    // Bare element (Elementor reframe): just the gallery. No self-wrapping <section>,
    // no band padding, no content-width clamp, no heading — ALL of that is owned by
    // the SECTION the block sits in (padding/width via the section node, background
    // via the section gear) and by a separate Heading element the host places above
    // it. `props.heading` is legacy: rendered only if a page still carries it, so
    // pre-reframe pages don't silently lose their title before they're re-seeded.
    <>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      {images.length === 0 ? (
        <Muted className="text-center text-sm">
          Photos from your property appear here.
        </Muted>
      ) : (
        <GalleryLightbox
          images={images}
          layout={props.layout}
          gap={props.gap}
        />
      )}
    </>
  );
}
