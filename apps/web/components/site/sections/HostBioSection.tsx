import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { SiteAssetResolver } from "@/lib/site/types";

import { SectionShell, SectionHeading, Card, siteImageStyle } from "./_shared";

type Props = Extract<WebsiteSection, { type: "host_bio" }>["props"];

function HostText({
  name,
  body,
  className = "",
}: {
  name?: string | null;
  body: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {name ? (
        <h3
          style={{
            fontFamily: "var(--site-font-heading)",
            color: "var(--site-ink)",
          }}
          className="text-xl font-semibold"
        >
          {name}
        </h3>
      ) : null}
      <p
        style={{ color: "var(--site-mute)" }}
        className="mt-2 whitespace-pre-line text-base leading-relaxed"
      >
        {body}
      </p>
    </div>
  );
}

function HostPhoto({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} style={siteImageStyle} className={className} />
  );
}

export function HostBioSection({
  props,
  asset,
}: {
  props: Props;
  asset?: SiteAssetResolver;
}) {
  const photo = asset?.(props.photo_path) ?? props.photo_path ?? undefined;
  const variant = props.variant ?? "side";
  const alt = props.name ?? "Host";

  // CENTERED — photo on top, everything centred.
  if (variant === "centered") {
    return (
      <SectionShell width="narrow">
        {props.heading ? (
          <SectionHeading className="mb-8">{props.heading}</SectionHeading>
        ) : null}
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          {photo ? (
            <HostPhoto
              src={photo}
              alt={alt}
              className="h-32 w-32 shrink-0 object-cover"
            />
          ) : null}
          <HostText name={props.name} body={props.body} />
        </div>
      </SectionShell>
    );
  }

  // CARD — photo + text inside a surface card.
  if (variant === "card") {
    return (
      <SectionShell width="narrow">
        {props.heading ? (
          <SectionHeading className="mb-8">{props.heading}</SectionHeading>
        ) : null}
        <Card className="flex flex-col items-center gap-8 p-8 text-center md:flex-row md:items-start md:text-left">
          {photo ? (
            <HostPhoto
              src={photo}
              alt={alt}
              className="h-40 w-40 shrink-0 object-cover"
            />
          ) : null}
          <HostText name={props.name} body={props.body} />
        </Card>
      </SectionShell>
    );
  }

  // SIDE (default) — photo beside the text.
  return (
    <SectionShell>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 md:flex-row md:items-start">
        {photo ? (
          <HostPhoto
            src={photo}
            alt={alt}
            className="h-40 w-40 shrink-0 object-cover"
          />
        ) : null}
        <HostText
          name={props.name}
          body={props.body}
          className="text-center md:text-left"
        />
      </div>
    </SectionShell>
  );
}
