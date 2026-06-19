"use client";

import { ArrowLeft, Loader2, Monitor, Smartphone, Tablet } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { saveBrandStudioAction } from "@/app/[locale]/dashboard/website/actions";
import { Link } from "@/i18n/navigation";
import { SectionRenderer } from "@/components/site/SectionRenderer";
import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import {
  SAMPLE_DATA,
  SAMPLE_NAV,
  SAMPLE_SECTIONS,
} from "@/lib/site/sampleSite";
import { siteSurfaceIsDark } from "@/lib/site/themes";

import {
  ButtonsSection,
  ColoursSection,
  IdentitySection,
  ImagesSection,
  LogosSection,
  TypographySection,
} from "./_sections";
import {
  studioBrand,
  studioThemeConfig,
  studioToSaveInput,
  type StudioState,
} from "./studio";

type Device = "desktop" | "tablet" | "phone";

const DEVICES: Array<{ key: Device; icon: typeof Monitor; labelKey: string }> =
  [
    { key: "desktop", icon: Monitor, labelKey: "deviceDesktop" },
    { key: "tablet", icon: Tablet, labelKey: "deviceTablet" },
    { key: "phone", icon: Smartphone, labelKey: "devicePhone" },
  ];

const DEVICE_W: Record<Device, string> = {
  desktop: "max-w-full",
  tablet: "max-w-[834px]",
  phone: "max-w-[400px]",
};

/**
 * The Brand Studio — a full-screen focus editor that takes over the viewport
 * (covering the dashboard sidebar + website-editor tabs). LEFT: the six
 * `state`/`merge` control sections. RIGHT: a live, responsive preview of a
 * realistic sample site rendered through the SAME `components/site/*` renderer
 * the public site uses (preview === public), so every brand/theme/image change
 * shows instantly. Identity + design persist together via `saveBrandStudioAction`;
 * logos persist on upload inside LogosSection.
 */
export function BrandStudio({
  websiteId,
  initial,
  fallbackName,
}: {
  websiteId: string;
  initial: StudioState;
  fallbackName: string;
}) {
  const t = useTranslations("website");
  const [state, setState] = useState<StudioState>(initial);
  const [device, setDevice] = useState<Device>("desktop");
  const [saving, startSave] = useTransition();

  // Lock the page behind the overlay while the studio is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const merge = (patch: Partial<StudioState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const sectionProps = { websiteId, state, merge, fallbackName };
  const themeCfg = studioThemeConfig(state);

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
    <div className="fixed inset-0 z-[60] flex flex-col bg-brand-light">
      {/* ── Top bar ─────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-3 border-b border-brand-line bg-white px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/dashboard/website/${websiteId}`}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t("brandStudioBack")}</span>
          </Link>
          <span className="hidden h-5 w-px bg-brand-line sm:block" />
          <h1 className="truncate font-display text-sm font-bold text-brand-ink">
            {t("brandStudioTitle")}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Responsive device toggle (preview pane width) */}
          <div className="hidden items-center gap-0.5 rounded-[10px] border border-brand-line bg-brand-light p-0.5 md:inline-flex">
            {DEVICES.map(({ key, icon: Icon, labelKey }) => (
              <button
                key={key}
                type="button"
                onClick={() => setDevice(key)}
                title={t(labelKey)}
                aria-label={t(labelKey)}
                className={`rounded-[8px] p-1.5 transition ${
                  device === key
                    ? "bg-white text-brand-ink shadow-sm"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("saveChanges")}
          </button>
        </div>
      </header>

      {/* ── Body: controls + live preview ───────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:overflow-hidden">
        {/* Controls */}
        <div className="space-y-5 border-b border-brand-line bg-white px-4 py-5 lg:h-full lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <IdentitySection {...sectionProps} />
          <LogosSection {...sectionProps} />
          <ColoursSection {...sectionProps} />
          <TypographySection {...sectionProps} />
          <ButtonsSection {...sectionProps} />
          <ImagesSection {...sectionProps} />
        </div>

        {/* Live preview */}
        <div className="bg-brand-light p-4 lg:h-full lg:overflow-y-auto lg:p-6">
          <div
            className={`mx-auto overflow-hidden rounded-card border border-brand-line bg-white shadow-card transition-[max-width] duration-300 ${DEVICE_W[device]}`}
          >
            <SiteThemeRoot theme={themeCfg}>
              <SiteChrome
                brand={studioBrand(state, fallbackName)}
                nav={SAMPLE_NAV}
                bookHref="#"
                darkChrome={siteSurfaceIsDark(themeCfg)}
              >
                <SectionRenderer
                  sections={SAMPLE_SECTIONS}
                  data={SAMPLE_DATA}
                />
              </SiteChrome>
            </SiteThemeRoot>
          </div>
        </div>
      </div>
    </div>
  );
}
