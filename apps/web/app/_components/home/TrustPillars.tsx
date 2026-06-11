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
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            {t("pillarsEyebrow", { brand: brandName })}
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-brand-ink md:text-3xl lg:text-4xl">
            {t("pillarsTitle")}
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {PILLARS.map(({ icon: Icon, titleKey, bodyKey }) => (
            <div
              key={titleKey}
              className="rounded-card border border-brand-line bg-white p-6"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded bg-brand-accent text-brand-secondary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="font-display text-lg font-semibold text-brand-ink">
                {t(titleKey)}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-brand-mute">
                {t(bodyKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
