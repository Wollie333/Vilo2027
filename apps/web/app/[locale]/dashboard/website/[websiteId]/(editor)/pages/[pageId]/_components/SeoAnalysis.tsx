"use client";

import { useMemo } from "react";

import { useTranslations } from "next-intl";

import {
  analyzeSeo,
  type SeoScore,
  type SeoStatus,
} from "@/lib/website/seoAnalyzer";

import { TextField } from "./fields";

const DOT: Record<SeoStatus, string> = {
  good: "bg-emerald-500",
  ok: "bg-amber-500",
  bad: "bg-red-500",
};
const SCORE_BG: Record<SeoScore, string> = {
  green: "bg-emerald-500",
  orange: "bg-amber-500",
  red: "bg-red-500",
};

/**
 * Reusable SEO coach — focus keyword + red/orange/green score + a checklist of
 * fixes (SEO and lite readability). Pure analysis lives in lib/website/seoAnalyzer;
 * this just renders it live. Shared by page SEO and (later) blog post SEO.
 */
export function SeoAnalysis({
  title,
  description,
  focusKeyword,
  onFocusKeyword,
  bodyText,
  slug,
}: {
  title: string;
  description: string;
  focusKeyword: string;
  onFocusKeyword: (v: string) => void;
  bodyText?: string;
  slug?: string;
}) {
  const t = useTranslations("website");
  const report = useMemo(
    () => analyzeSeo({ title, description, focusKeyword, bodyText, slug }),
    [title, description, focusKeyword, bodyText, slug],
  );
  const all = [...report.checks, ...report.readability];

  return (
    <div className="space-y-4">
      <TextField
        label={t("seoFocusKeyword")}
        value={focusKeyword}
        onChange={onFocusKeyword}
        maxLength={60}
        hint={t("seoFocusKeywordHint")}
      />

      <div className="flex items-center gap-3 rounded-[10px] border border-brand-line bg-brand-light/40 p-3">
        <span
          aria-hidden
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ${SCORE_BG[report.score]}`}
        >
          {report.percent}
        </span>
        <div className="text-sm font-semibold text-brand-ink">
          {t(`seoScore_${report.score}`)}
        </div>
      </div>

      <ul className="space-y-1.5">
        {all.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-[13px]">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[c.status]}`}
            />
            <span className="text-brand-mute">{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
