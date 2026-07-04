import type { WebsiteSection } from "@/lib/website/sections.schema";
import type {
  SpecialCard as SpecialCardData,
  SpecialsPreviewData,
} from "@/lib/site/types";

import { SiteImg } from "../SiteImg";
import { SectionHeading, Muted, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "specials_preview" }>["props"];

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

function SpecialCardView({
  special: s,
  cta,
}: {
  special: SpecialCardData;
  cta: string;
}) {
  const price = priceLabel(s.price, s.currency);
  const was = priceLabel(s.wasPrice, s.currency);
  const perLabel = s.priceMode === "flat" ? "package" : "/ night";
  // The auto savings badge (top-right) is redundant when the host's own badge
  // (top-left) already spells out the same discount (e.g. both say "20% off") —
  // show it only when it adds information.
  const showSavings =
    !!s.savingsPct &&
    !(s.badge && s.badge.replace(/\s/g, "").includes(`${s.savingsPct}%`));

  return (
    <Card
      className="flex flex-col"
      style={{
        background: "var(--el-card-bg, var(--site-surface))",
        border: "var(--el-card-bd, var(--site-card-border))",
        borderRadius: "var(--el-card-radius, var(--site-card-radius))",
        boxShadow: "var(--el-card-shadow, var(--site-card-shadow))",
      }}
    >
      <div className="relative">
        {s.imageUrl ? (
          <SiteImg
            src={s.imageUrl}
            alt={s.title}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            widths={[320, 480, 640, 768]}
            style={{ borderRadius: "var(--el-image-radius, 0px)" }}
            className="aspect-[4/3] w-full object-cover"
          />
        ) : null}
        {s.badge ? (
          <span
            style={{
              background: "var(--el-badge-bg, var(--site-accent))",
              color: "var(--el-badge-fg, var(--site-accent-ink))",
              borderRadius: "var(--el-badge-radius, 9999px)",
            }}
            className="absolute left-3 top-3 px-2.5 py-1 text-[11px] font-semibold shadow-sm"
          >
            {s.badge}
          </span>
        ) : null}
        {showSavings ? (
          <span
            style={{
              background: "var(--el-savings-bg, var(--site-secondary))",
              color: "var(--el-savings-fg, var(--site-secondary-ink))",
              borderRadius: "var(--el-savings-radius, 9999px)",
            }}
            className="absolute right-3 top-3 px-2.5 py-1 text-[11px] font-semibold shadow-sm"
          >
            {s.savingsPct}% off
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
          {s.title}
        </h3>
        {s.description ? (
          <p
            style={{
              color: "var(--el-desc-fg, var(--site-mute))",
              fontSize: "var(--el-desc-size, 0.875rem)",
            }}
            className="mt-1.5 line-clamp-3 leading-relaxed"
          >
            {s.description}
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
            <span style={{ color: "var(--site-mute)" }} className="text-xs">
              {perLabel}
            </span>
            {was && s.savingsAmount ? (
              <span
                style={{ color: "var(--site-mute)" }}
                className="text-xs line-through"
              >
                {was}
              </span>
            ) : null}
          </div>
        ) : null}
        {s.remaining != null && s.remaining <= 5 ? (
          <div className="mt-1 text-[11px] font-medium text-amber-600">
            Only {s.remaining} left
          </div>
        ) : null}
        <div className="mt-4 flex items-center justify-end pt-2">
          <a
            href={s.bookHref}
            data-wielo-book
            style={{
              background: "var(--el-button-bg, var(--site-btn-primary-bg))",
              color: "var(--el-button-fg, var(--site-btn-primary-color))",
              border: "var(--el-button-bd, var(--site-btn-primary-border))",
              borderRadius:
                "var(--el-button-radius, var(--site-btn-primary-radius))",
            }}
            className="shrink-0 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
          >
            {cta}
          </a>
        </div>
      </div>
    </Card>
  );
}

export function SpecialsPreviewSection({
  props,
  data,
}: {
  props: Props;
  data?: SpecialsPreviewData;
}) {
  const specials = (data?.specials ?? []).slice(0, props.max);
  const cta = props.ctaLabel ?? "View deal";

  return (
    // Bare element (Elementor reframe): just the specials. No self-wrapping <section>,
    // no band padding, no content-width clamp, no heading — ALL of that is owned by
    // the SECTION the block sits in (padding/width/background via the section node +
    // gear; the old `surface` band is re-seeded as the section's `bg`) and by a
    // separate Heading element the host places above it. `props.heading` is legacy:
    // rendered only if a page still carries it, so pre-reframe pages keep their title.
    <>
      {props.heading ? (
        <SectionHeading className="mb-10">{props.heading}</SectionHeading>
      ) : null}
      {specials.length === 0 ? (
        <Muted className="text-center text-sm">
          Your current specials appear here.
        </Muted>
      ) : (
        <div
          className={`grid gap-5 ${
            props.layout === "list"
              ? "grid-cols-1"
              : props.layout === "carousel"
                ? "auto-cols-[85%] grid-flow-col overflow-x-auto sm:auto-cols-[45%] lg:auto-cols-[31%]"
                : "sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {specials.map((s) => (
            <SpecialCardView key={s.id} special={s} cta={cta} />
          ))}
        </div>
      )}
    </>
  );
}
