import type { WebsiteSection } from "@/lib/website/sections.schema";
import type {
  AddonCard as AddonCardData,
  AddonsPreviewData,
} from "@/lib/site/types";

import { SiteImg } from "../SiteImg";
import { SectionHeading, Muted, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "addons_preview" }>["props"];

const PRICING_LABEL: Record<string, string> = {
  per_stay: "per stay",
  per_night: "/ night",
  per_guest: "per guest",
  per_guest_per_night: "per guest / night",
  per_couple: "per couple",
};

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

function AddonCardView({ addon: a }: { addon: AddonCardData }) {
  const price = priceLabel(a.price, a.currency);
  const per = PRICING_LABEL[a.pricingModel] ?? "";

  return (
    <Card
      className="flex flex-col"
      style={{
        background: "var(--el-card-bg, var(--site-surface))",
        border: "var(--el-card-bd, var(--site-card-border))",
        borderRadius: "var(--el-card-radius, var(--site-card-radius))",
      }}
    >
      <div className="relative">
        {a.imageUrl ? (
          <SiteImg
            src={a.imageUrl}
            alt={a.name}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            widths={[320, 480, 640, 768]}
            style={{ borderRadius: "var(--el-image-radius, 0px)" }}
            className="aspect-[4/3] w-full object-cover"
          />
        ) : null}
        {a.required ? (
          <span
            style={{
              background: "var(--el-badge-bg, var(--site-accent))",
              color: "var(--el-badge-fg, var(--site-accent-ink))",
              borderRadius: "var(--el-badge-radius, 9999px)",
            }}
            className="absolute left-3 top-3 px-2.5 py-1 text-[11px] font-semibold shadow-sm"
          >
            Included
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3
          style={{
            fontFamily: "var(--site-font-heading)",
            color: "var(--el-title-fg, var(--site-ink))",
            fontSize: "var(--el-title-size, 1.125rem)",
            fontWeight: "var(--el-title-weight, 600)",
          }}
        >
          {a.name}
        </h3>
        {a.description ? (
          <p
            style={{
              color: "var(--el-desc-fg, var(--site-mute))",
              fontSize: "var(--el-desc-size, 0.875rem)",
            }}
            className="mt-1.5 line-clamp-3 leading-relaxed"
          >
            {a.description}
          </p>
        ) : null}
        {price ? (
          <div className="mt-3 flex items-baseline gap-2">
            <span
              style={{
                color: "var(--el-price-fg, var(--site-ink))",
                fontSize: "var(--el-price-size, 1rem)",
                fontWeight: "var(--el-price-weight, 600)",
              }}
            >
              {price}
            </span>
            {per ? (
              <span style={{ color: "var(--site-mute)" }} className="text-xs">
                {per}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function AddonsPreviewSection({
  props,
  data,
}: {
  props: Props;
  data?: AddonsPreviewData;
}) {
  const addons = (data?.addons ?? []).slice(0, props.max);
  const cta = props.ctaLabel;

  return (
    // Bare element (Elementor reframe): just the add-ons. No self-wrapping <section>,
    // no band padding, no content-width clamp, no heading — ALL of that is owned by
    // the SECTION the block sits in (padding/width/background via the section node +
    // gear; the old `surface` band is re-seeded as the section's `bg`) and by a
    // separate Heading element the host places above it. `props.heading` is legacy:
    // rendered only if a page still carries it, so pre-reframe pages keep their title.
    <>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      {addons.length === 0 ? (
        <Muted className="text-center text-sm">
          The extras you offer appear here.
        </Muted>
      ) : (
        <>
          <div
            className={`grid gap-5 ${
              props.layout === "list"
                ? "grid-cols-1"
                : props.layout === "carousel"
                  ? "auto-cols-[85%] grid-flow-col overflow-x-auto sm:auto-cols-[45%] lg:auto-cols-[31%]"
                  : "sm:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {addons.map((a) => (
              <AddonCardView key={a.id} addon={a} />
            ))}
          </div>
          {cta ? (
            <div className="mt-8 text-center">
              <a
                href="/rooms"
                data-wielo-book
                style={{
                  background: "var(--site-btn-primary-bg)",
                  color: "var(--site-btn-primary-color)",
                  border: "var(--site-btn-primary-border)",
                  borderRadius: "var(--site-btn-primary-radius)",
                }}
                className="inline-block px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
              >
                {cta}
              </a>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
