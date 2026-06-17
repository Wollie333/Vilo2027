import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { SiteAssetResolver } from "@/lib/site/types";

import { SectionShell, SectionHeading } from "./_shared";

type Props = Extract<WebsiteSection, { type: "host_bio" }>["props"];

export function HostBioSection({
  props,
  asset,
}: {
  props: Props;
  asset?: SiteAssetResolver;
}) {
  const photo = asset?.(props.photo_path) ?? props.photo_path ?? undefined;

  return (
    <SectionShell>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 md:flex-row md:items-start">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={props.name ?? "Host"}
            style={{ borderRadius: "var(--site-radius)" }}
            className="h-40 w-40 shrink-0 object-cover"
          />
        ) : null}
        <div className="text-center md:text-left">
          {props.name ? (
            <h3
              style={{
                fontFamily: "var(--site-font-heading)",
                color: "var(--site-ink)",
              }}
              className="text-xl font-semibold"
            >
              {props.name}
            </h3>
          ) : null}
          <p
            style={{ color: "var(--site-mute)" }}
            className="mt-2 whitespace-pre-line text-base leading-relaxed"
          >
            {props.body}
          </p>
        </div>
      </div>
    </SectionShell>
  );
}
