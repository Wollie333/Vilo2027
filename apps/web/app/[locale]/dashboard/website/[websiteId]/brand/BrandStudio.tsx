"use client";

import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Lock,
  Monitor,
  Palette,
  RotateCw,
  Smartphone,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useLocale, useTranslations } from "next-intl";

import { saveBrandStudioAction } from "@/app/[locale]/dashboard/website/actions";
import { Link } from "@/i18n/navigation";

import {
  ButtonsSection,
  CardsSection,
  ColourSection,
  HomepageSection,
  IconsSection,
  IdentitySection,
  ImagesSection,
  SocialSection,
  TypographySection,
} from "./_sections";
import {
  studioBrand,
  studioThemeConfig,
  studioToSaveInput,
  type StudioState,
} from "./studio";

type Device = "desktop" | "mobile";
type PageTab = { key: string; label: string; path: string };

const ROOT_DOMAIN = "vilo.site";

export function BrandStudio({
  websiteId,
  initial,
  fallbackName,
  subdomain,
  liveHref,
}: {
  websiteId: string;
  initial: StudioState;
  fallbackName: string;
  subdomain: string;
  liveHref: string;
}) {
  const t = useTranslations("website");
  const locale = useLocale();
  const [state, setState] = useState<StudioState>(initial);
  const [device, setDevice] = useState<Device>("desktop");
  const [page, setPage] = useState("home");
  const [tabs, setTabs] = useState<PageTab[]>([]);
  const [saving, startSave] = useTransition();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const merge = (patch: Partial<StudioState>) =>
    setState((prev) => ({ ...prev, ...patch }));
  const sectionProps = { websiteId, state, merge, fallbackName };

  // Push the live draft theme/brand + selected page into the preview iframe.
  const post = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: "vilo-brand-studio",
        theme: studioThemeConfig(state),
        brand: studioBrand(state, fallbackName),
        page,
      },
      window.location.origin,
    );
  }, [state, fallbackName, page]);

  // Re-push on every change.
  useEffect(() => {
    post();
  }, [post]);

  // When the iframe reports ready, capture its page list and push current state.
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const d = e.data as {
        source?: string;
        type?: string;
        pages?: PageTab[];
      };
      if (d?.source === "vilo-brand-preview" && d.type === "ready") {
        if (d.pages?.length) setTabs(d.pages);
        post();
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [post]);

  // Lock the page behind the overlay.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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

  const activePath = tabs.find((tab) => tab.key === page)?.path ?? "";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      {/* ── Top bar ─────────────────────────────────────── */}
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-brand-line bg-white px-4 lg:px-5">
        <Link
          href={`/dashboard/website/${websiteId}`}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line px-2.5 py-1.5 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{t("brandStudioBack")}</span>
        </Link>
        <span className="font-display text-[15px] font-extrabold tracking-tight text-brand-ink">
          {t("brandStudioTitle")}
        </span>
        <div className="flex-1" />
        <Link
          href={liveHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 py-2 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
        >
          <ExternalLink className="h-4 w-4 text-brand-mute" />
          <span className="hidden sm:inline">{t("brandViewLive")}</span>
        </Link>
      </header>

      {/* ── Body ────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* Control rail */}
        <div className="flex w-full max-w-[404px] shrink-0 flex-col border-r border-brand-line bg-white max-lg:max-w-[340px] max-md:hidden">
          <div className="flex shrink-0 items-center gap-3 border-b border-brand-line px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-brand-secondary text-white">
              <Palette className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-[18px] font-extrabold leading-none text-brand-ink">
                {t("brandStudioTitle")}
              </h1>
              <div className="mt-1 truncate text-[12px] text-brand-mute">
                {fallbackName}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <IdentitySection {...sectionProps} />
            <ColourSection {...sectionProps} />
            <TypographySection {...sectionProps} />
            <ButtonsSection {...sectionProps} />
            <IconsSection {...sectionProps} />
            <ImagesSection {...sectionProps} />
            <CardsSection {...sectionProps} />
            <HomepageSection {...sectionProps} />
            <SocialSection {...sectionProps} />
            <div className="h-2" />
          </div>

          <div className="flex shrink-0 items-center gap-3 border-t border-brand-line bg-white px-5 py-3.5">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand-mute">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              {t("brandStudioDraftHint")}
            </span>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="ml-auto inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("saveChanges")}
            </button>
          </div>
        </div>

        {/* Preview stage */}
        <div
          className="flex min-w-0 flex-1 flex-col bg-[#0A1510]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px,rgba(255,255,255,.045) 1px,transparent 0)",
            backgroundSize: "22px 22px",
          }}
        >
          {/* Browser chrome */}
          <div className="flex h-[52px] shrink-0 items-center gap-3.5 border-b border-white/10 bg-[#0F1B16] px-4">
            <div className="hidden gap-1.5 sm:flex">
              <span className="h-[11px] w-[11px] rounded-full bg-[#FF5F57]" />
              <span className="h-[11px] w-[11px] rounded-full bg-[#FEBC2E]" />
              <span className="h-[11px] w-[11px] rounded-full bg-[#28C840]" />
            </div>
            <div className="hidden min-w-0 items-center gap-2 rounded-pill bg-white/[0.06] px-3.5 py-1.5 text-[12.5px] text-white/60 md:flex">
              <Lock className="h-3.5 w-3.5 text-emerald-400" />
              <span className="truncate font-mono text-[12px]">
                {subdomain}.{ROOT_DOMAIN}
                <span className="text-white/40">{activePath}</span>
              </span>
            </div>

            {/* Page tabs */}
            {tabs.length > 0 ? (
              <div className="flex gap-1 rounded-[10px] bg-white/[0.06] p-[3px]">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setPage(tab.key)}
                    className={`whitespace-nowrap rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold transition ${
                      page === tab.key
                        ? "bg-white/[0.14] text-white"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="ml-auto flex items-center gap-2.5">
              <div className="flex gap-[3px] rounded-[10px] bg-white/[0.06] p-[3px]">
                {(
                  [
                    { key: "desktop", icon: Monitor },
                    { key: "mobile", icon: Smartphone },
                  ] as const
                ).map(({ key, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDevice(key)}
                    title={
                      key === "desktop" ? t("deviceDesktop") : t("devicePhone")
                    }
                    className={`flex h-[30px] w-[34px] items-center justify-center rounded-[7px] transition ${
                      device === key
                        ? "bg-white/[0.14] text-white"
                        : "text-white/55 hover:text-white"
                    }`}
                  >
                    <Icon className="h-[17px] w-[17px]" />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => post()}
                title={t("brandReloadPreview")}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] text-white/55 transition hover:bg-white/10 hover:text-white"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Device frame */}
          <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto">
            <div
              className={
                device === "mobile"
                  ? "relative my-6 h-[calc(100%-48px)] w-[414px] shrink-0 overflow-hidden rounded-[30px] border-[9px] border-[#060d0a] bg-white shadow-[0_40px_90px_-30px_rgba(0,0,0,.7)]"
                  : "h-full w-full bg-white"
              }
            >
              <iframe
                ref={iframeRef}
                src={`/${locale}/brand-preview/${websiteId}`}
                title={t("brandPreviewTitle")}
                onLoad={post}
                className="block h-full w-full border-0 bg-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
