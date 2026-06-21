import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { GalleryData } from "@/lib/site/types";

import { GalleryLightbox } from "../GalleryLightbox";
import { SectionShell, SectionHeading, Muted } from "./_shared";

type Props = Extract<WebsiteSection, { type: "gallery" }>["props"];

export function GallerySection({
  props,
  data,
}: {
  props: Props;
  data?: GalleryData;
}) {
  const images = (data?.images ?? []).slice(0, props.max);

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
        <GalleryLightbox images={images} layout={props.layout} />
      )}
    </SectionShell>
  );
}
