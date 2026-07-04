import type { WebsiteSection } from "@/lib/website/sections.schema";
import { toEmbed } from "@/lib/website/videoEmbed";

import { SectionShell, SectionHeading, Muted, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "video" }>["props"];

/** Free-form embedded video (responsive 16:9). */
export function VideoSection({ props }: { props: Props }) {
  const src = toEmbed(props.url);
  return (
    <SectionShell width="narrow">
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
    </SectionShell>
  );
}
