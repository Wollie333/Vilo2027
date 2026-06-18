"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { saveSeoAction } from "@/app/[locale]/dashboard/website/actions";

import {
  ImageField,
  TextArea,
  TextField,
  ToggleField,
} from "../pages/[pageId]/_components/fields";

type SeoState = {
  title: string;
  description: string;
  ogImagePath: string;
  gscToken: string;
  robotsIndex: boolean;
  sitemapEnabled: boolean;
};

export function SeoForm({
  websiteId,
  fallbackTitle,
  previewHost,
  initial,
}: {
  websiteId: string;
  fallbackTitle: string;
  previewHost: string;
  initial: SeoState;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [state, setState] = useState<SeoState>(initial);
  const [saving, startSave] = useTransition();

  const set = <K extends keyof SeoState>(key: K, value: SeoState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  function onSave() {
    startSave(async () => {
      const res = await saveSeoAction({ websiteId, ...state });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("seoSaved"));
      router.refresh();
    });
  }

  const previewTitle = state.title.trim() || fallbackTitle;
  const previewDesc = state.description.trim() || t("seoDescFallback");

  return (
    <div className="space-y-6">
      {/* Search appearance */}
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-6 shadow-card">
        <h3 className="text-sm font-semibold text-brand-ink">
          {t("seoSearchTitle")}
        </h3>

        {/* Google-style SERP preview */}
        <div className="rounded-[10px] border border-brand-line bg-brand-light/40 p-4">
          <p className="truncate text-[13px] text-emerald-700">{previewHost}</p>
          <p className="mt-0.5 truncate text-[18px] text-[#1a0dab]">
            {previewTitle}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[13px] text-brand-mute">
            {previewDesc}
          </p>
        </div>

        <TextField
          label={t("seoTitleLabel")}
          value={state.title}
          onChange={(v) => set("title", v)}
          placeholder={fallbackTitle}
          maxLength={70}
          hint={t("seoTitleHint")}
        />
        <TextArea
          label={t("seoDescLabel")}
          value={state.description}
          onChange={(v) => set("description", v)}
          maxLength={200}
          rows={3}
          hint={t("seoDescHint")}
        />
      </section>

      {/* Social sharing image */}
      <section className="space-y-3 rounded-card border border-brand-line bg-white p-6 shadow-card">
        <h3 className="text-sm font-semibold text-brand-ink">
          {t("seoOgTitle")}
        </h3>
        <ImageField
          label={t("seoOgImage")}
          websiteId={websiteId}
          path={state.ogImagePath || undefined}
          onChange={(p) => set("ogImagePath", p ?? "")}
          hint={t("seoOgHint")}
        />
      </section>

      {/* Indexing controls */}
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-6 shadow-card">
        <h3 className="text-sm font-semibold text-brand-ink">
          {t("seoIndexTitle")}
        </h3>
        <ToggleField
          label={t("seoRobotsIndex")}
          checked={state.robotsIndex}
          onChange={(v) => set("robotsIndex", v)}
        />
        <p className="-mt-2 text-[12px] text-brand-mute">
          {t("seoRobotsHint")}
        </p>
        <ToggleField
          label={t("seoSitemap")}
          checked={state.sitemapEnabled}
          onChange={(v) => set("sitemapEnabled", v)}
        />
        <TextField
          label={t("seoGscLabel")}
          value={state.gscToken}
          onChange={(v) => set("gscToken", v)}
          maxLength={120}
          hint={t("seoGscHint")}
        />
      </section>

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
  );
}
