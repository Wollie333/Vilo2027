import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { GalleryImage, RoomDetail, RoomPolicies } from "@/lib/site/types";

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
    <>
      <div
        style={{ borderColor: "var(--site-line)", color: "var(--site-mute)" }}
        className="rounded-[var(--site-radius)] border border-dashed p-10 text-center text-sm"
      >
        {label}
      </div>
    </>
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
    <>
      <GalleryLightbox images={lightboxImages} layout={layout} />
    </>
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
    <>
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
    </>
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
    <>
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
    </>
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
    <>
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
    </>
  );
}

// ── Room "things to know" (auto policies) ─────────────────────
type PoliciesProps = Extract<
  WebsiteSection,
  { type: "room_policies" }
>["props"];

/** Lines to render from a room's auto-populated policies (check-in/out,
 *  cancellation, allowances) — only those with a value. */
function policyItems(
  p: NonNullable<RoomDetail["policies"]>,
): { label: string; value: string }[] {
  const items: { label: string; value: string }[] = [];
  if (p.checkIn) items.push({ label: "Check-in", value: `From ${p.checkIn}` });
  if (p.checkOut)
    items.push({ label: "Check-out", value: `Until ${p.checkOut}` });
  if (p.cancellation)
    items.push({ label: "Cancellation", value: p.cancellation });
  if (p.children != null)
    items.push({
      label: "Children",
      value: p.children ? "Welcome" : "Not suitable for children",
    });
  if (p.pets != null)
    items.push({ label: "Pets", value: p.pets ? "Allowed" : "Not allowed" });
  return items;
}

/** The shared "things to know" view — the policy grid + house-rules block.
 *  Reused by the ROOM-scoped `room_policies` band and the PROPERTY-level
 *  `policies` band (both render the same RoomPolicies shape). */
export function PolicyView({
  heading,
  variant,
  policies,
  bare = false,
}: {
  heading?: string;
  variant: "grid" | "list";
  policies: RoomPolicies;
  /** Elementor reframe: render bare (no self <section>/band, heading optional) so
   *  the SECTION owns the band + a Heading element sits above. The room-scoped
   *  room_policies keeps the banded default until the system blocks are reframed. */
  bare?: boolean;
}) {
  const items = policyItems(policies);
  const inner = (
    <>
      {bare ? (
        heading ? (
          <SectionHeading centered={false} className="mb-6">
            {heading}
          </SectionHeading>
        ) : null
      ) : (
        <SectionHeading centered={false} className="mb-6">
          {heading || "Things to know"}
        </SectionHeading>
      )}
      <div
        className={
          variant === "list"
            ? "space-y-5"
            : "grid gap-x-8 gap-y-5 sm:grid-cols-2"
        }
      >
        {items.map((it, i) => (
          <div key={i}>
            <div
              style={{ color: "var(--site-mute)" }}
              className="text-[11px] font-semibold uppercase tracking-wide"
            >
              {it.label}
            </div>
            <div style={{ color: "var(--site-ink)" }} className="mt-1 text-sm">
              {it.value}
            </div>
          </div>
        ))}
      </div>
      {policies.houseRules ? (
        <div className="mt-6">
          <div
            style={{ color: "var(--site-mute)" }}
            className="text-[11px] font-semibold uppercase tracking-wide"
          >
            House rules
          </div>
          <p
            style={{ color: "var(--site-ink)" }}
            className="mt-1 whitespace-pre-line text-sm"
          >
            {policies.houseRules}
          </p>
        </div>
      ) : null}
    </>
  );
  return bare ? inner : <SectionShell>{inner}</SectionShell>;
}

export function RoomPoliciesSection({
  props,
  data,
}: {
  props: PoliciesProps;
  data?: RoomDetail;
}) {
  const p = data?.policies;
  if (!p)
    return (
      <RoomPlaceholder label="This room's cancellation policy and house rules appear here." />
    );
  // Bare (Elementor reframe): the room-detail SECTION owns the band; the block keeps
  // its own "Things to know" heading (data-coupled, not split into an el_heading like
  // the marketing composites). All room_* system blocks are reframed together so the
  // room-detail page stays uniform.
  return (
    <PolicyView
      heading={props.heading || "Things to know"}
      variant={props.variant}
      policies={p}
      bare
    />
  );
}

// ── Property "things to know" (auto policies — site's primary property) ──
type PropertyPoliciesProps = Extract<
  WebsiteSection,
  { type: "policies" }
>["props"];

/** PROPERTY-level "things to know". Unlike room_policies this isn't room-scoped:
 *  its data is the site's primary property, resolved by section type. Renders
 *  nothing on a page with no policy data (no builder placeholder). */
export function PoliciesSection({
  props,
  data,
}: {
  props: PropertyPoliciesProps;
  data?: RoomPolicies;
}) {
  if (!data) return null;
  // Bare element (Elementor reframe): the SECTION owns the band; the heading is a
  // separate Heading element the host places above. `props.heading` stays legacy —
  // rendered only if a page still carries it, so pre-reframe pages keep their title.
  return (
    <PolicyView
      heading={props.heading}
      variant={props.variant}
      policies={data}
      bare
    />
  );
}
