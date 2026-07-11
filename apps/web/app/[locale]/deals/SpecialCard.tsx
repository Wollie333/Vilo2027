import { MapPin, Sparkles, Tag } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Money } from "@/components/currency/Money";
import { Link } from "@/i18n/navigation";
import { grossVat } from "@/lib/pricing/vat";

import type { DirectorySpecial } from "@/lib/specials/directory";

// Presentational card for the cross-host /specials directory. Links to the
// shared public detail page (/special/[slug]); the detail page owns the booking
// CTA. Shows the savings badge + scarcity, mirroring the booking-page deal card.
export async function SpecialCard({
  special: s,
}: {
  special: DirectorySpecial;
}) {
  const t = await getTranslations("specials");
  const location = [s.propertyCity, s.propertyProvince]
    .filter(Boolean)
    .join(", ");
  const amount = s.priceMode === "flat" ? s.flatTotal : s.perNightPrice;
  const perLabel =
    s.priceMode === "flat" ? t("cardPackage") : t("cardPerNight");

  return (
    <Link
      href={`/deal/${s.slug}`}
      className="group flex flex-col overflow-hidden rounded-card"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-brand-accent">
        {s.heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.heroUrl}
            alt={s.title}
            className="card-img absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-brand-mute">
            <Sparkles className="h-10 w-10" />
          </div>
        )}
        {s.badge ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill bg-brand-primary px-2 py-0.5 text-[10px] font-bold text-white">
            <Tag className="h-3 w-3" />
            {s.badge}
          </span>
        ) : null}
        {s.savingsPct ? (
          <span className="absolute right-3 top-3 inline-flex items-center rounded-pill bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
            {t("offPct", { pct: s.savingsPct })}
          </span>
        ) : null}
      </div>
      <div className="pt-3">
        <div className="truncate font-display font-semibold text-brand-ink group-hover:text-brand-secondary">
          {s.title}
        </div>
        <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-brand-mute">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {s.propertyName}
            {location ? ` · ${location}` : ""}
          </span>
        </div>
        {amount != null ? (
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="num font-display font-bold text-brand-ink">
              <Money
                amount={grossVat(amount, s.vatRate)}
                currency={s.currency}
              />
            </span>
            <span className="text-xs text-brand-mute">{perLabel}</span>
            {s.wasPrice && s.savingsAmount ? (
              <span className="text-xs text-brand-mute line-through">
                <Money
                  amount={grossVat(s.wasPrice, s.vatRate)}
                  currency={s.currency}
                  approx={false}
                />
              </span>
            ) : null}
          </div>
        ) : null}
        {s.remaining <= 5 ? (
          <div className="mt-1 text-[11px] font-medium text-amber-600">
            {t("onlyLeft", { count: s.remaining })}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
