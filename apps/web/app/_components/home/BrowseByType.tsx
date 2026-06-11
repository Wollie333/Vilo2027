import { MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import type { HomeTypeCard } from "./home-data";

export async function BrowseByType({ types }: { types: HomeTypeCard[] }) {
  if (types.length === 0) return null;
  const t = await getTranslations("home");

  return (
    <section id="types" className="border-b border-brand-line bg-white">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div className="max-w-xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              {t("typesEyebrow")}
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-brand-ink md:text-3xl lg:text-4xl">
              {t("typesTitle")}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:gap-5">
          {types.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group relative aspect-[16/10] overflow-hidden rounded-card border border-brand-line bg-brand-accent"
            >
              {card.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.image}
                  alt={card.title}
                  loading="lazy"
                  className="card-img absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-brand-mute">
                  <MapPin className="h-10 w-10" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <div className="font-display text-xl font-bold">
                  {card.title}
                </div>
                <div className="num mt-0.5 text-xs text-white/80">
                  {card.meta}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
