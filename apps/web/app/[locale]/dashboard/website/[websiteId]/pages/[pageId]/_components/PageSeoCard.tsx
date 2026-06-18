"use client";

import { ChevronDown, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { savePageSeoAction } from "@/app/[locale]/dashboard/website/actions";

import { TextArea, TextField } from "./fields";

/**
 * Collapsible per-page SEO override editor (Phase 6). Surfaces
 * website_pages.seo_overrides — a page title/description that overrides the
 * site-level SEO for this one page. Empty fields inherit the site SEO.
 */
export function PageSeoCard({
  websiteId,
  pageId,
  fallbackTitle,
  initial,
}: {
  websiteId: string;
  pageId: string;
  fallbackTitle: string;
  initial: { title: string; description: string };
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [saving, startSave] = useTransition();

  function onSave() {
    startSave(async () => {
      const res = await savePageSeoAction({
        websiteId,
        pageId,
        title,
        description,
      });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("pageSeoSaved"));
      router.refresh();
    });
  }

  const previewTitle = title.trim() || fallbackTitle;

  return (
    <div className="rounded-card border border-brand-line bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
      >
        <Search className="h-4 w-4 text-brand-mute" />
        <span className="flex-1 text-sm font-semibold text-brand-ink">
          {t("pageSeoTitle")}
        </span>
        <span className="text-[12px] text-brand-mute">{t("pageSeoSub")}</span>
        <ChevronDown
          className={`h-4 w-4 text-brand-mute transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-brand-line px-4 py-4">
          <div className="rounded-[10px] border border-brand-line bg-brand-light/40 p-3">
            <p className="truncate text-[16px] text-[#1a0dab]">
              {previewTitle}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[12.5px] text-brand-mute">
              {description.trim() || t("pageSeoDescFallback")}
            </p>
          </div>
          <TextField
            label={t("pageSeoTitleLabel")}
            value={title}
            onChange={setTitle}
            placeholder={fallbackTitle}
            maxLength={70}
            hint={t("pageSeoTitleHint")}
          />
          <TextArea
            label={t("pageSeoDescLabel")}
            value={description}
            onChange={setDescription}
            maxLength={200}
            rows={2}
            hint={t("pageSeoDescHint")}
          />
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("save")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
