"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { useLocale } from "next-intl";

import { applyThemeAction } from "@/app/[locale]/dashboard/website/actions";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import type { ThemeOption } from "@/lib/site/themes.server";

type Props = {
  theme: ThemeOption;
  websiteId: string;
  subdomain: string;
  isActive: boolean;
  onClose: () => void;
};

/**
 * Activate-a-theme confirmation. The PREVIEW now opens the live site in a new
 * tab (so the host sees exactly how the theme looks and functions on their own
 * rooms/reviews); this modal only confirms the (reversible) activation, which
 * rebuilds the pages from the theme's blueprint.
 */
export function ThemeActivateModal({
  theme,
  websiteId,
  subdomain,
  isActive,
  onClose,
}: Props) {
  const t = useTranslations("website");
  const locale = useLocale();
  const router = useRouter();
  const [applying, startApply] = useTransition();

  const previewUrl = `/${locale}/site?site=${subdomain}&preview=1&theme=${theme.slug}`;

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
    <FormModal
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={t("themeActivateTitle", { name: theme.name })}
      description={t("themeActivateBody")}
      size="sm"
    >
      <a
        href={previewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-[10px] border border-brand-line bg-white px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:bg-brand-light"
      >
        <ExternalLink className="h-4 w-4" />
        {t("themePreviewNewTab")}
      </a>

      <FormModalFooter>
        <FormModalCancel>{t("cancel")}</FormModalCancel>
        <button
          type="button"
          onClick={handleActivate}
          disabled={applying || isActive}
          className="inline-flex items-center gap-2 rounded-[10px] bg-brand-primary px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {applying && <Loader2 className="h-4 w-4 animate-spin" />}
          {isActive ? t("themeActive") : t("themeActivate")}
        </button>
      </FormModalFooter>
    </FormModal>
  );
}
