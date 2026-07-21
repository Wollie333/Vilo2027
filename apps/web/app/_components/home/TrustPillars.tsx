import {
  BadgeCheck,
  MessageSquare,
  Receipt,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { getBrandName } from "@/lib/brand";

type Pillar = { icon: LucideIcon; titleKey: string; bodyKey: string };

const PILLARS: Pillar[] = [
  { icon: Receipt, titleKey: "pillarNoFeesTitle", bodyKey: "pillarNoFeesBody" },
  {
    icon: BadgeCheck,
    titleKey: "pillarVerifiedTitle",
    bodyKey: "pillarVerifiedBody",
  },
  {
    icon: MessageSquare,
    titleKey: "pillarTalkTitle",
    bodyKey: "pillarTalkBody",
  },
  {
    icon: RotateCcw,
    titleKey: "pillarCancelTitle",
    bodyKey: "pillarCancelBody",
  },
];

export async function TrustPillars() {
  const [brandName, t] = await Promise.all([
    getBrandName(),
    getTranslations("home"),
  ]);
  return (
    <section className="border-b border-brand-line">
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="mx-auto mb-6 max-w-2xl text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            {t("pillarsEyebrow", { brand: brandName })}
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-brand-ink md:text-3xl">
            {t("pillarsTitle")}
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {PILLARS.map(({ icon: Icon, titleKey, bodyKey }) => (
            <div
              key={titleKey}
              className="rounded-card border border-brand-line bg-white p-4 lg:p-5"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-brand-accent text-brand-secondary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="font-display text-base font-semibold text-brand-ink">
                  {t(titleKey)}
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-brand-mute">
                {t(bodyKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
