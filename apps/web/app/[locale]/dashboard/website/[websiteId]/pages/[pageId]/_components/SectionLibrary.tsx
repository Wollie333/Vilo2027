"use client";

import {
  AlignLeft,
  BarChart3,
  BedDouble,
  Building2,
  Heart,
  HelpCircle,
  Images,
  LayoutTemplate,
  Mail,
  Map as MapIcon,
  MapPin,
  MousePointerClick,
  Newspaper,
  Sparkles,
  Star,
  Type,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { useTranslations } from "next-intl";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import {
  isAutoPopulate,
  type SectionType,
} from "@/lib/website/sections.schema";

const ICONS: Record<SectionType, LucideIcon> = {
  hero: LayoutTemplate,
  intro: AlignLeft,
  highlights: Sparkles,
  stats: BarChart3,
  gallery: Images,
  logos: Building2,
  rooms_preview: BedDouble,
  location: MapPin,
  map: MapIcon,
  reviews: Star,
  cta: MousePointerClick,
  host_bio: UserRound,
  values: Heart,
  blog_preview: Newspaper,
  rich_text: Type,
  faq: HelpCircle,
  contact_form: Mail,
  // Plumbed in S5a; surfaced in the library (GROUPS) + rendered in S5b.
  specials_preview: Sparkles,
};

// Curated grouping for the library (thumbnail grid replaces the plain dropdown).
const GROUPS: Array<{ key: string; types: SectionType[] }> = [
  { key: "catHero", types: ["hero", "intro"] },
  {
    key: "catShowcase",
    types: ["gallery", "rooms_preview", "logos", "blog_preview"],
  },
  {
    key: "catTrust",
    types: ["highlights", "stats", "reviews", "values", "host_bio"],
  },
  { key: "catLocation", types: ["location", "map"] },
  { key: "catConvert", types: ["cta", "contact_form"] },
  { key: "catMore", types: ["rich_text", "faq"] },
];

/**
 * Section library — the richer "add a section" picker (Phase 5). A modal grid of
 * preview cards grouped by purpose, each with an icon + description and a Live
 * badge for auto-populate types. Picking one adds it with its starter content.
 */
export function SectionLibrary({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (type: SectionType) => void;
}) {
  const t = useTranslations("website");

  function pick(type: SectionType) {
    onPick(type);
    onOpenChange(false);
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={t("libraryTitle")}
      description={t("librarySub")}
      size="lg"
    >
      <div className="space-y-6">
        {GROUPS.map((group) => (
          <section key={group.key}>
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
              {t(group.key)}
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {group.types.map((type) => {
                const Icon = ICONS[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => pick(type)}
                    className="group flex items-start gap-3 rounded-card border border-brand-line bg-white p-3 text-left transition hover:border-brand-primary hover:shadow-card"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-light text-brand-secondary transition group-hover:bg-brand-accent">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-brand-ink">
                          {t(`sectionType_${type}`)}
                        </span>
                        {isAutoPopulate(type) ? (
                          <span className="rounded-pill bg-brand-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase text-brand-secondary">
                            {t("liveBadge")}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] leading-snug text-brand-mute">
                        {t(`sectionDesc_${type}`)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <FormModalFooter>
        <FormModalCancel>{t("cancel")}</FormModalCancel>
      </FormModalFooter>
    </FormModal>
  );
}
