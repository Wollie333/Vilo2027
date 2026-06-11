import { ArrowRight, Sun, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function DealsBanner() {
  const t = await getTranslations("home");
  return (
    <section className="border-b border-brand-line">
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
          <div className="relative min-h-[280px] overflow-hidden rounded-card border border-brand-line lg:col-span-7">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=1200&q=80&auto=format&fit=crop"
              alt="Summer at the coast"
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
            <div className="relative max-w-lg p-8 text-white lg:p-10">
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                <Sun className="h-3 w-3" /> {t("dealsBadge")}
              </span>
              <h3 className="mt-4 font-display text-2xl font-bold leading-tight md:text-3xl">
                {t("dealsTitle")}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-white/85">
                {t("dealsBody")}
              </p>
              <a
                href="/explore"
                className="mt-5 inline-flex items-center gap-1.5 rounded bg-white px-4 py-2.5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent"
              >
                {t("dealsCta")} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="brand-gradient relative overflow-hidden rounded-card p-8 text-white lg:col-span-5 lg:p-10">
            <div
              aria-hidden
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.25) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white ring-1 ring-white/20 backdrop-blur">
                <Users className="h-3 w-3" /> {t("groupBadge")}
              </span>
              <h3 className="mt-4 font-display text-2xl font-bold leading-tight md:text-3xl">
                {t("groupTitle")}
              </h3>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/90">
                {t("groupBody")}
              </p>
              <a
                href="/explore?guests=8"
                className="mt-5 inline-flex items-center gap-1.5 rounded bg-white px-4 py-2.5 text-sm font-medium text-brand-secondary transition-colors hover:bg-brand-accent"
              >
                {t("groupCta")} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
