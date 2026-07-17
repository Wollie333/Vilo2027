import { Check } from "lucide-react";

import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { SiteAssetResolver } from "@/lib/site/types";

import { SiteImg } from "../SiteImg";
// Bare element (Elementor reframe): all variants render bare; the SECTION owns
// padding + width and the heading is a separate Heading element above.
import { SectionHeading, Card, siteImageStyle } from "./_shared";

type Props = Extract<WebsiteSection, { type: "host_bio" }>["props"];
type Point = NonNullable<Props["points"]>[number];

/** Optional check-list beneath the body (the Safari About "conservation" block).
 *  Class hooks (`site-hostbio-points`) let per-theme skins restyle the markers. */
function HostPoints({
  points,
  centered = false,
}: {
  points: Point[];
  centered?: boolean;
}) {
  if (!points.length) return null;
  return (
    <ul
      className={`site-hostbio-points mt-6 flex flex-col gap-3 ${
        centered ? "items-center text-center" : ""
      }`}
    >
      {points.map((p, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            aria-hidden
            className="site-hostbio-point-mark mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "var(--site-accent)",
              color: "var(--site-accent-ink, #ffffff)",
            }}
          >
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          <span style={{ color: "var(--el-body-fg, var(--site-ink))" }}>
            {p.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

function HostText({
  name,
  body,
  points,
  pointsCentered = false,
  className = "",
}: {
  name?: string | null;
  body: string;
  points?: Point[];
  pointsCentered?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      {name ? (
        <h3
          style={{
            fontFamily: "var(--site-font-heading)",
            color: "var(--el-name-fg, var(--site-ink))",
            fontSize: "var(--el-name-size, 1.25rem)",
            fontWeight: "var(--el-name-weight, 600)",
          }}
        >
          {name}
        </h3>
      ) : null}
      <p
        style={{
          color: "var(--el-body-fg, var(--site-mute))",
          fontSize: "var(--el-body-size, 1rem)",
        }}
        className="mt-2 whitespace-pre-line leading-relaxed"
      >
        {body}
      </p>
      {points && points.length > 0 ? (
        <HostPoints points={points} centered={pointsCentered} />
      ) : null}
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
    <SiteImg
      src={src}
      alt={alt}
      style={{
        ...siteImageStyle,
        borderRadius: "var(--el-photo-radius, var(--site-img-radius))",
      }}
      className={className}
      sizes="160px"
      widths={[160, 320, 480]}
    />
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
      <>
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
          <HostText
            name={props.name}
            body={props.body}
            points={props.points}
            pointsCentered
          />
        </div>
      </>
    );
  }

  // CARD — photo + text inside a surface card.
  if (variant === "card") {
    return (
      <>
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
          <HostText name={props.name} body={props.body} points={props.points} />
        </Card>
      </>
    );
  }

  // SIDE (default) — photo beside the text. `reverse` flips the photo to the
  // opposite side (the Safari "conservation" wide/left layout).
  return (
    <>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      <div
        className={`mx-auto flex max-w-3xl flex-col items-center gap-8 md:items-start ${
          props.reverse ? "md:flex-row-reverse" : "md:flex-row"
        }`}
      >
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
          points={props.points}
          className="text-center md:text-left"
        />
      </div>
    </>
  );
}
