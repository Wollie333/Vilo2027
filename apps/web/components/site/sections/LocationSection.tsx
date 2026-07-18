import type { WebsiteSection } from "@/lib/website/sections.schema";
import type { LocationData } from "@/lib/site/types";

// Bare element (Elementor reframe): renders bare (no self <section>/band/width-
// clamp, incl. the old `surface` band); the SECTION owns padding + width +
// background (the surface band is re-seeded as the section `bg`) and the heading is
// a separate Heading element above. `props.heading` stays legacy.
import { SectionHeading, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "location" }>["props"];

// Per-element style hook (Elementor accordion) — reads `--el-card-*`.
const locCardStyle = {
  background: "var(--el-card-bg, var(--site-surface))",
  border: "var(--el-card-bd, var(--site-card-border))",
  borderRadius: "var(--el-card-radius, var(--site-card-radius))",
  boxShadow: "var(--el-card-shadow, var(--site-card-shadow))",
} as const;
type Poi = NonNullable<LocationData["pois"]>[number];

function PoiList({
  pois,
  className = "space-y-2.5",
}: {
  pois: Poi[];
  className?: string;
}) {
  return (
    <ul className={className}>
      {pois.map((poi, i) => (
        <li
          key={i}
          style={{ borderColor: "var(--site-line)" }}
          className="flex items-center justify-between border-b pb-2.5"
        >
          <span
            style={{
              color: "var(--el-poi-fg, var(--site-ink))",
              fontSize: "var(--el-poi-size, 0.875rem)",
            }}
            className="font-medium"
          >
            {poi.name}
            {poi.category ? (
              <span
                style={{ color: "var(--site-mute)" }}
                className="font-normal"
              >
                {" "}
                · {poi.category}
              </span>
            ) : null}
          </span>
          {poi.distance ? (
            <span style={{ color: "var(--site-mute)" }} className="text-sm">
              {poi.distance}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** A contact/detail row — icon + title + optional subtitle, theme-styled. */
function DetailRow({
  icon,
  title,
  sub,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <div className="flex items-start gap-3.5">
      <span
        aria-hidden
        style={{
          color: "var(--site-accent)",
          background: "color-mix(in srgb, var(--site-accent) 12%, transparent)",
        }}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div
          style={{ color: "var(--site-ink)" }}
          className="break-words text-[15px] font-semibold"
        >
          {title}
        </div>
        {sub ? (
          <div
            style={{ color: "var(--site-mute)" }}
            className="mt-0.5 text-[13px]"
          >
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
  return href ? (
    <a href={href} className="block transition-opacity hover:opacity-80">
      {inner}
    </a>
  ) : (
    inner
  );
}

const PinIcon = (
  <svg
    width="19"
    height="19"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const PhoneIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
  </svg>
);
const MailIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-10 6L2 7" />
  </svg>
);

export function LocationSection({
  props,
  data,
}: {
  props: Props;
  data?: LocationData;
}) {
  const pois = data?.pois ?? [];
  const variant = props.variant ?? "split";
  const showMap =
    props.show_map !== false &&
    variant !== "list" &&
    Boolean(data?.mapEmbedUrl);
  const mapUrl = data?.mapEmbedUrl ?? "";
  const hasContact = Boolean(data?.phone || data?.email || data?.address);

  // Nothing to show — render nothing rather than a bare padded strip.
  if (!hasContact && !showMap && pois.length === 0) return null;

  // A polished details card: establishment name + address, phone and email
  // (each a real tel:/mailto: link), with any points of interest below it.
  const details =
    hasContact || pois.length > 0 ? (
      <Card style={locCardStyle}>
        <div className="p-6 sm:p-7">
          {data?.name ? (
            <div
              style={{
                fontFamily: "var(--site-font-heading)",
                color: "var(--site-ink)",
              }}
              className="mb-5 text-xl font-bold"
            >
              {data.name}
            </div>
          ) : null}
          <div className="space-y-4">
            {data?.address ? (
              <DetailRow
                icon={PinIcon}
                title={data.address}
                sub="Find us here"
              />
            ) : null}
            {data?.phone ? (
              <DetailRow
                icon={PhoneIcon}
                title={data.phone}
                sub="Call us"
                href={`tel:${data.phone.replace(/\s+/g, "")}`}
              />
            ) : null}
            {data?.email ? (
              <DetailRow
                icon={MailIcon}
                title={data.email}
                sub="Email us"
                href={`mailto:${data.email}`}
              />
            ) : null}
          </div>
          {pois.length > 0 ? (
            <div
              style={{ borderColor: "var(--site-line)" }}
              className="mt-5 border-t pt-5"
            >
              <PoiList pois={pois} />
            </div>
          ) : null}
        </div>
      </Card>
    ) : null;

  const mapCard = showMap ? (
    <Card style={locCardStyle}>
      <iframe
        src={mapUrl}
        title="Map"
        loading="lazy"
        className="h-64 w-full border-0 md:h-full md:min-h-[380px]"
      />
    </Card>
  ) : null;

  return (
    <>
      {props.heading ? (
        <SectionHeading className="mb-8">{props.heading}</SectionHeading>
      ) : null}

      {variant === "list" ? (
        details ? (
          <div className="mx-auto max-w-2xl">{details}</div>
        ) : null
      ) : variant === "stacked" ? (
        <div className="space-y-6">
          {mapCard}
          {details}
        </div>
      ) : (
        // split (default): the map beside the details card.
        <div className="grid items-stretch gap-6 md:grid-cols-[1.4fr_1fr]">
          {mapCard}
          {details}
        </div>
      )}
    </>
  );
}
