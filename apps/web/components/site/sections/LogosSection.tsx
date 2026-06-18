import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { SiteAssetResolver } from "@/lib/site/types";

import { SectionShell, SectionHeading } from "./_shared";

type Props = Extract<WebsiteSection, { type: "logos" }>["props"];

/** Free-form partner / "as seen in" logo strip. Each logo image is uploaded;
 *  paths resolve to URLs through the shared `asset` resolver. */
export function LogosSection({
  props,
  asset,
}: {
  props: Props;
  asset?: SiteAssetResolver;
}) {
  const logos = props.items.filter((l) => l.image_path);
  if (logos.length === 0) return null;
  return (
    <SectionShell>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
        {logos.map((logo, i) => {
          const url = asset?.(logo.image_path) ?? logo.image_path;
          const img = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={logo.alt ?? ""}
              className="h-10 w-auto max-w-[160px] object-contain opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0 md:h-12"
            />
          );
          return logo.href ? (
            <a
              key={i}
              href={logo.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {img}
            </a>
          ) : (
            <span key={i}>{img}</span>
          );
        })}
      </div>
    </SectionShell>
  );
}
