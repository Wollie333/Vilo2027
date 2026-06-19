"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { saveBrandStudioAction } from "@/app/[locale]/dashboard/website/actions";
import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import type { SiteNavItem } from "@/lib/site/types";

import {
  ButtonsSection,
  ColoursSection,
  IdentitySection,
  LogosSection,
  TypographySection,
} from "./_sections";
import {
  studioBrand,
  studioThemeConfig,
  studioToSaveInput,
  type StudioState,
} from "./studio";

/**
 * The Brand Studio shell — the single client island that owns the working
 * `StudioState` for the merged Brand + Theme tab. The left column stacks the
 * five sub-sections (each a pure `state`/`merge` editor); the right column is a
 * live preview rendered through the SAME `components/site/*` chrome the public
 * site uses (preview === public). Identity + design persist together on Save via
 * `saveBrandStudioAction`; logo/favicon paths persist on upload inside LogosSection.
 */
export function BrandStudio({
  websiteId,
  initial,
  nav,
  fallbackName,
}: {
  websiteId: string;
  initial: StudioState;
  nav: SiteNavItem[];
  fallbackName: string;
}) {
  const t = useTranslations("website");
  const [state, setState] = useState<StudioState>(initial);
  const [saving, startSave] = useTransition();

  const merge = (patch: Partial<StudioState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const sectionProps = { websiteId, state, merge, fallbackName };

  function onSave() {
    startSave(async () => {
      const res = await saveBrandStudioAction(
        studioToSaveInput(websiteId, state),
      );
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("brandSaved"));
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,460px)_1fr] lg:items-start">
      <div className="space-y-6">
        <IdentitySection {...sectionProps} />
        <LogosSection {...sectionProps} />
        <ColoursSection {...sectionProps} />
        <TypographySection {...sectionProps} />
        <ButtonsSection {...sectionProps} />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("saveChanges")}
          </button>
        </div>
      </div>

      {/* Live preview — same chrome + theme vars as the public site. */}
      <div className="lg:sticky lg:top-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
          {t("brandPreviewTitle")}
        </div>
        <div className="overflow-hidden rounded-card border border-brand-line shadow-card">
          <SiteThemeRoot theme={studioThemeConfig(state)}>
            <SiteChrome
              brand={studioBrand(state, fallbackName)}
              nav={nav}
              bookHref="#"
            >
              <div className="space-y-4 px-6 py-10">
                <h2
                  className="text-balance"
                  style={{
                    fontFamily: "var(--site-font-heading)",
                    fontWeight:
                      "var(--site-weight-heading)" as unknown as number,
                    fontSize: "var(--site-h2)",
                    lineHeight:
                      "var(--site-leading-heading)" as unknown as number,
                    letterSpacing: "var(--site-tracking-heading)",
                    color: "var(--site-ink)",
                  }}
                >
                  {t("brandPreviewHeading")}
                </h2>
                <p
                  className="max-w-prose text-sm"
                  style={{ color: "var(--site-mute)" }}
                >
                  {t("brandPreviewBody")}
                </p>
              </div>
            </SiteChrome>
          </SiteThemeRoot>
        </div>
      </div>
    </div>
  );
}
