"use client";

import { Search } from "lucide-react";
import { useState } from "react";

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

import { SectionThumb } from "./SectionThumb";

// Curated grouping for the library (visual thumbnail grid).
const GROUPS: Array<{ key: string; types: SectionType[] }> = [
  { key: "catHero", types: ["hero", "intro"] },
  {
    key: "catShowcase",
    types: [
      "gallery",
      "rooms_preview",
      "specials_preview",
      "pricing",
      "video",
      "logos",
      "blog_preview",
    ],
  },
  {
    key: "catTrust",
    types: [
      "highlights",
      "stats",
      "reviews",
      "values",
      "amenities",
      "host_bio",
    ],
  },
  { key: "catLocation", types: ["location", "map"] },
  { key: "catConvert", types: ["cta", "contact_form"] },
  { key: "catMore", types: ["rich_text", "faq"] },
];

/**
 * Section library — the visual "add a section" picker. A searchable modal grid of
 * thumbnail cards grouped by purpose, each a mini schematic of the section's
 * layout + name/description and a Live badge for auto-populate types. Picking one
 * adds it with its starter content.
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
  const [query, setQuery] = useState("");

  function pick(type: SectionType) {
    onPick(type);
    onOpenChange(false);
    setQuery("");
  }

  const q = query.trim().toLowerCase();
  const matches = (type: SectionType) =>
    !q ||
    t(`sectionType_${type}`).toLowerCase().includes(q) ||
    t(`sectionDesc_${type}`).toLowerCase().includes(q);

  const groups = GROUPS.map((g) => ({
    ...g,
    types: g.types.filter(matches),
  })).filter((g) => g.types.length > 0);

  return (
    <FormModal
      open={open}
      onOpenChange={(o) => {
        if (!o) setQuery("");
        onOpenChange(o);
      }}
      title={t("libraryTitle")}
      description={t("librarySub")}
      size="lg"
    >
      <div className="space-y-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("librarySearchPlaceholder")}
            className="w-full rounded-[10px] border border-brand-line bg-white py-2 pl-9 pr-3 text-sm text-brand-ink outline-none focus:border-brand-primary"
          />
        </div>

        {groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-brand-mute">
            {t("libraryNoResults")}
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.key}>
                <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
                  {t(group.key)}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.types.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => pick(type)}
                      className="group flex flex-col rounded-card border border-brand-line bg-white p-2 text-left transition hover:border-brand-primary hover:shadow-card"
                    >
                      <SectionThumb type={type} />
                      <span className="mt-2 flex items-center gap-1.5 px-0.5">
                        <span className="text-sm font-semibold text-brand-ink">
                          {t(`sectionType_${type}`)}
                        </span>
                        {isAutoPopulate(type) ? (
                          <span className="rounded-pill bg-brand-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase text-brand-secondary">
                            {t("liveBadge")}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 line-clamp-2 px-0.5 text-[12px] leading-snug text-brand-mute">
                        {t(`sectionDesc_${type}`)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <FormModalFooter>
        <FormModalCancel>{t("cancel")}</FormModalCancel>
      </FormModalFooter>
    </FormModal>
  );
}
