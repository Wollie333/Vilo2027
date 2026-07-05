import type { WebsiteSection } from "@/lib/website/sections.schema";
import { toEmbed } from "@/lib/website/videoEmbed";

import { SectionHeading, Muted, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "video" }>["props"];

// Bare-element sizing (Builder V3 Group 2.3): the wrapping section owns the band
// padding + gutter, so the video element carries none of its own — only a size
// clamp (max-width), centred within the section.
const VIDEO_MAX = { narrow: "32rem", medium: "48rem", full: "100%" } as const;

/** Free-form embedded video (responsive 16:9). Renders as a standalone ELEMENT
 *  (no section band) sized by `props.width`; the section supplies the padding. */
export function VideoSection({ props }: { props: Props }) {
  const src = toEmbed(props.url);
  const maxWidth = VIDEO_MAX[props.width ?? "full"];
  return (
    <div className="mx-auto w-full" style={{ maxWidth }}>
      {props.heading ? (
        <SectionHeading className="mb-6">{props.heading}</SectionHeading>
      ) : null}
      {src ? (
        <Card>
          <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
            <iframe
              src={src}
              title={props.heading || "Video"}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        </Card>
      ) : (
        <Muted className="text-center text-sm">
          Paste a YouTube or Vimeo link to embed your video.
        </Muted>
      )}
      {props.caption ? (
        <Muted className="mt-3 text-center text-base">{props.caption}</Muted>
      ) : null}
    </div>
  );
}
