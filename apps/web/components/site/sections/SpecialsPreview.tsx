import type { WebsiteSection } from "@/lib/website/sections.schema";
import type {
  SpecialCard as SpecialCardData,
  SpecialsPreviewData,
} from "@/lib/site/types";

import { SiteImg } from "../SiteImg";
import { SectionShell, SectionHeading, Muted, Card } from "./_shared";

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

  return (
    <Card className="flex flex-col">
      <div className="relative">
        {s.imageUrl ? (
          <SiteImg
            src={s.imageUrl}
            alt={s.title}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            widths={[320, 480, 640, 768]}
            className="aspect-[4/3] w-full object-cover"
          />
        ) : null}
        {s.badge ? (
          <span
            style={{
              background: "var(--site-accent)",
              color: "var(--site-accent-ink)",
            }}
            className="absolute left-3 top-3 rounded-pill px-2.5 py-1 text-[11px] font-semibold shadow-sm"
          >
            {s.badge}
          </span>
        ) : null}
        {s.savingsPct ? (
          <span className="absolute right-3 top-3 rounded-pill bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
            {s.savingsPct}% off
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3
          style={{
            fontFamily: "var(--site-font-heading)",
            color: "var(--site-ink)",
          }}
          className="text-lg font-semibold"
        >
          {s.title}
        </h3>
        {s.description ? (
          <p
            style={{ color: "var(--site-mute)" }}
            className="mt-1.5 line-clamp-3 text-sm leading-relaxed"
          >
            {s.description}
          </p>
        ) : null}
        {price ? (
          <div className="mt-3 flex items-baseline gap-2">
            <span
              style={{ color: "var(--site-ink)" }}
              className="text-base font-semibold"
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
            data-vilo-book
            style={{
              background: "var(--site-btn-primary-bg)",
              color: "var(--site-btn-primary-color)",
              border: "var(--site-btn-primary-border)",
              borderRadius: "var(--site-btn-primary-radius)",
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
    <SectionShell surface>
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
    </SectionShell>
  );
}
