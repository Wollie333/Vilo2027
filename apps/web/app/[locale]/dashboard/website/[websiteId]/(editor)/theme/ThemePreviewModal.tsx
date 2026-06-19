"use client";

import { Loader2, X, ArrowLeft } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { applyThemeAction } from "@/app/[locale]/dashboard/website/actions";
import type { ThemeOption } from "@/lib/site/themes.server";

type Props = {
  theme: ThemeOption;
  websiteId: string;
  subdomain: string;
  isActive: boolean;
  onClose: () => void;
};

export function ThemePreviewModal({
  theme,
  websiteId,
  subdomain,
  isActive,
  onClose,
}: Props) {
  const t = useTranslations("website");
  const router = useRouter();
  const [iframeLoading, setIframeLoading] = useState(true);
  const [applying, startApply] = useTransition();

  const previewUrl = `/site?site=${subdomain}&preview=1&theme=${theme.slug}`;

  function handleActivate() {
    startApply(async () => {
      const res = await applyThemeAction({ websiteId, themeId: theme.id });
      if (!res.ok) {
        toast.error(t("themeApplyError"));
        return;
      }
      toast.success(t("themeApplied"));
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-brand-line bg-white px-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 text-sm font-medium text-brand-mute transition hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("themeBackToGallery")}
        </button>

        <div className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-brand-ink">
          {t("themePreviewTitle", { name: theme.name })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Iframe container */}
      <div className="relative flex-1 overflow-hidden bg-brand-light">
        {iframeLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-brand-light">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-brand-mute" />
              <span className="text-sm text-brand-mute">
                {t("themePreviewLoading")}
              </span>
            </div>
          </div>
        )}
        <iframe
          src={previewUrl}
          title={`Preview: ${theme.name}`}
          className="h-full w-full border-0"
          onLoad={() => setIframeLoading(false)}
        />
      </div>

      {/* Footer */}
      <div className="flex h-16 shrink-0 items-center justify-between border-t border-brand-line bg-white px-4">
        <div className="text-sm text-brand-mute">
          {theme.isPremium ? t("themePremium") : t("themeFree")}
          {theme.description && (
            <span className="ml-2 hidden sm:inline">— {theme.description}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border border-brand-line bg-white px-4 py-2 text-sm font-medium text-brand-ink transition hover:bg-brand-light"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleActivate}
            disabled={applying || isActive}
            className="inline-flex items-center gap-2 rounded-[10px] bg-brand-primary px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {applying && <Loader2 className="h-4 w-4 animate-spin" />}
            {isActive ? t("themeActive") : t("themeActivate")}
          </button>
        </div>
      </div>
    </div>
  );
}
