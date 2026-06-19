"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { applyThemeAction } from "@/app/[locale]/dashboard/website/actions";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import type { ThemeOption } from "@/lib/site/themes.server";

export function ThemeGallery({
  websiteId,
  themes,
  activeSlug,
}: {
  websiteId: string;
  themes: ThemeOption[];
  activeSlug: string;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [pending, setPending] = useState<ThemeOption | null>(null);
  const [applying, startApply] = useTransition();

  function confirmApply() {
    if (!pending) return;
    const theme = pending;
    startApply(async () => {
      const res = await applyThemeAction({ websiteId, themeId: theme.id });
      if (!res.ok) {
        toast.error(t("themeApplyError"));
        return;
      }
      toast.success(t("themeApplied"));
      setPending(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((theme) => {
          const active = theme.slug === activeSlug;
          const p = theme.base.palette;
          return (
            <div
              key={theme.id}
              className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                {theme.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={theme.previewUrl}
                    alt={theme.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // Palette mini-mock when no preview image is set.
                  <div
                    className="flex h-full w-full flex-col"
                    style={{ background: p?.bg }}
                  >
                    <div className="flex items-center gap-2 px-4 pt-4">
                      <span
                        className="h-6 w-6 rounded-full"
                        style={{ background: p?.accent }}
                      />
                      <span
                        className="h-2 w-20 rounded"
                        style={{ background: p?.ink, opacity: 0.85 }}
                      />
                    </div>
                    <div className="mt-auto flex gap-2 p-4">
                      {[p?.surface, p?.accent, p?.ink].map((c, i) => (
                        <span
                          key={i}
                          className="h-8 flex-1 rounded"
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {active ? (
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-pill bg-brand-primary px-2.5 py-1 text-[11px] font-bold text-white">
                    <Check className="h-3 w-3" />
                    {t("themeActive")}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2 p-4">
                <div className="min-w-0">
                  <div className="truncate font-display text-[15px] font-bold text-brand-ink">
                    {theme.name}
                  </div>
                  <div className="text-[12px] text-brand-mute">
                    {theme.isPremium ? t("themePremium") : t("themeFree")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPending(theme)}
                  disabled={active}
                  className="ml-auto shrink-0 rounded-[10px] bg-brand-primary px-3.5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                >
                  {active ? t("themeActive") : t("themeUse")}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <FormModal
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={t("themeApplyTitle")}
        description={t("themeApplyWarning", { name: pending?.name ?? "" })}
      >
        <FormModalFooter>
          <FormModalCancel>{t("cancel")}</FormModalCancel>
          <button
            type="button"
            onClick={confirmApply}
            disabled={applying}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("themeApplyConfirm")}
          </button>
        </FormModalFooter>
      </FormModal>
    </>
  );
}
