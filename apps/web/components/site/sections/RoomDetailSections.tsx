import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { GalleryImage, RoomDetail } from "@/lib/site/types";

import { GalleryLightbox } from "../GalleryLightbox";
import {
  Card,
  Muted,
  SectionHeading,
  SectionShell,
  SiteButton,
} from "./_shared";

function priceLabel(price?: number | null, currency?: string | null) {
  if (price == null) return null;
  const ccy = currency ?? "ZAR";
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: ccy,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${ccy} ${price}`;
  }
}

/** Shown in the builder preview / on a non-room page where no room is in scope. */
function RoomPlaceholder({ label }: { label: string }) {
  return (
    <SectionShell>
      <div
        style={{ borderColor: "var(--site-line)", color: "var(--site-mute)" }}
        className="rounded-[var(--site-radius)] border border-dashed p-10 text-center text-sm"
      >
        {label}
      </div>
    </SectionShell>
  );
}

// ── Room gallery ──────────────────────────────────────────────
type GalleryProps = Extract<WebsiteSection, { type: "room_gallery" }>["props"];

export function RoomGallerySection({
  props,
  data,
}: {
  props: GalleryProps;
  data?: RoomDetail;
}) {
  const images = (data?.images ?? []).slice(0, props.max);
  if (images.length === 0)
    return <RoomPlaceholder label="This room's photos appear here." />;

  // Every photo is clickable → opens the swipeable fullscreen lightbox so guests
  // can browse the room's images. The alt rides through as the caption.
  const lightboxImages: GalleryImage[] = images.map((img) => ({
    url: img.url,
    caption: img.alt ?? data?.name ?? null,
  }));
  // "stacked" isn't a lightbox layout — fall back to a grid for it.
  const layout = props.variant === "stacked" ? "grid" : props.variant;

  return (
    <SectionShell>
      <GalleryLightbox images={lightboxImages} layout={layout} />
    </SectionShell>
  );
}

// ── Room overview (name + facts + description + price) ─────────
type OverviewProps = Extract<
  WebsiteSection,
  { type: "room_overview" }
>["props"];

function FactPills({ facts }: { facts: string[] }) {
  if (facts.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {facts.map((f, i) => (
        <span
          key={i}
          style={{
            background: "var(--site-bg)",
            color: "var(--site-mute)",
            borderColor: "var(--site-line)",
          }}
          className="rounded-pill border px-2.5 py-1 text-xs font-medium"
        >
          {f}
        </span>
      ))}
    </div>
  );
}

export function RoomOverviewSection({
  props,
  data,
}: {
  props: OverviewProps;
  data?: RoomDetail;
}) {
  if (!data)
    return <RoomPlaceholder label="The room's name and details appear here." />;

  const title = props.heading?.trim() || data.name;
  const price = props.show_price ? priceLabel(data.price, data.currency) : null;
  const split = props.variant === "split";

  const body = (
    <div>
      <h1
        style={{
          fontFamily: "var(--site-font-heading)",
          color: "var(--site-ink)",
          fontSize: "var(--site-h2)",
          lineHeight: "var(--site-leading-heading)" as unknown as number,
        }}
        className="font-semibold"
      >
        {title}
      </h1>
      {props.show_facts ? <FactPills facts={data.facts} /> : null}
      {data.description ? (
        <p
          style={{ color: "var(--site-mute)" }}
          className="mt-4 whitespace-pre-line text-[15px] leading-relaxed"
        >
          {data.description}
        </p>
      ) : null}
    </div>
  );

  const aside =
    price != null ? (
      <Card className="p-5">
        <span style={{ color: "var(--site-mute)" }} className="text-sm">
          From
        </span>
        <div
          style={{ color: "var(--site-ink)" }}
          className="text-2xl font-bold"
        >
          {price}
          <span
            style={{ color: "var(--site-mute)" }}
            className="text-sm font-normal"
          >
            {" "}
            / night
          </span>
        </div>
        <div className="mt-4">
          <SiteButton href={data.bookHref} track>
            Book this room
          </SiteButton>
        </div>
      </Card>
    ) : null;

  return (
    <SectionShell>
      {split && aside ? (
        <div className="grid gap-8 md:grid-cols-[1fr_18rem]">
          {body}
          <div>{aside}</div>
        </div>
      ) : (
        <div className="space-y-6">
          {body}
          {aside}
        </div>
      )}
    </SectionShell>
  );
}

// ── Room amenities ────────────────────────────────────────────
type AmenitiesProps = Extract<
  WebsiteSection,
  { type: "room_amenities" }
>["props"];

export function RoomAmenitiesSection({
  props,
  data,
}: {
  props: AmenitiesProps;
  data?: RoomDetail;
}) {
  const amenities = data?.amenities ?? [];
  if (amenities.length === 0)
    return <RoomPlaceholder label="This room's amenities appear here." />;

  return (
    <SectionShell>
      {props.heading ? (
        <SectionHeading centered={false} className="mb-6">
          {props.heading}
        </SectionHeading>
      ) : null}
      <ul
        className={
          props.variant === "list"
            ? "space-y-2"
            : "grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3"
        }
      >
        {amenities.map((a, i) => (
          <li
            key={i}
            style={{ color: "var(--site-ink)" }}
            className="flex items-center gap-2 text-sm"
          >
            <span aria-hidden style={{ color: "var(--site-accent)" }}>
              ✓
            </span>
            {a.label}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

// ── Room rate + book CTA ──────────────────────────────────────
type RateProps = Extract<WebsiteSection, { type: "room_rate" }>["props"];

export function RoomRateSection({
  props,
  data,
}: {
  props: RateProps;
  data?: RoomDetail;
}) {
  if (!data)
    return (
      <RoomPlaceholder label="The room's rate and booking button appear here." />
    );

  const price = priceLabel(data.price, data.currency);
  const cta = props.cta_label?.trim() || "Book this room";

  const inner = (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {props.heading ? (
          <h3
            style={{
              fontFamily: "var(--site-font-heading)",
              color: "var(--site-ink)",
            }}
            className="text-lg font-semibold"
          >
            {props.heading}
          </h3>
        ) : null}
        {price ? (
          <div
            style={{ color: "var(--site-ink)" }}
            className="text-2xl font-bold"
          >
            {price}
            <span
              style={{ color: "var(--site-mute)" }}
              className="text-sm font-normal"
            >
              {" "}
              / night
            </span>
          </div>
        ) : null}
        {props.note ? (
          <Muted className="mt-1 text-sm">{props.note}</Muted>
        ) : null}
      </div>
      <SiteButton href={data.bookHref} size="lg" track>
        {cta}
      </SiteButton>
    </div>
  );

  return (
    <SectionShell>
      {props.variant === "banner" ? (
        <div
          style={{ background: "var(--site-surface)" }}
          className="rounded-[var(--site-radius)] p-6"
        >
          {inner}
        </div>
      ) : (
        <Card className="p-6">{inner}</Card>
      )}
    </SectionShell>
  );
}
