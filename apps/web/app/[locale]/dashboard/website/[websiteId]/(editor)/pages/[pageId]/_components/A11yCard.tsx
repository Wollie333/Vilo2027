"use client";

import { Accessibility, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { useTranslations } from "next-intl";

import {
  analyzeA11y,
  type A11yScore,
  type A11yStatus,
} from "@/lib/website/a11yAnalyzer";
import type { WebsiteSection } from "@/lib/website/sections.schema";

const DOT: Record<A11yStatus, string> = {
  good: "bg-emerald-500",
  ok: "bg-amber-500",
  bad: "bg-red-500",
};
const SCORE_BG: Record<A11yScore, string> = {
  green: "bg-emerald-500",
  orange: "bg-amber-500",
  red: "bg-red-500",
};

/**
 * Collapsible accessibility checker for the current page — a sibling to the SEO
 * coach. Scores the saved sections (analysis in lib/website/a11yAnalyzer) and
 * shows the score chip in the header so issues are visible without expanding.
 */
export function A11yCard({ sections }: { sections: WebsiteSection[] }) {
  const t = useTranslations("website");
  const [open, setOpen] = useState(false);
  const report = useMemo(() => analyzeA11y(sections), [sections]);

  return (
    <div className="rounded-card border border-brand-line bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
      >
        <Accessibility className="h-4 w-4 text-brand-mute" />
        <span className="flex-1 text-sm font-semibold text-brand-ink">
          {t("a11yTitle")}
        </span>
        <span
          aria-hidden
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${SCORE_BG[report.score]}`}
        >
          {report.percent}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-brand-mute transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <ul className="space-y-1.5 border-t border-brand-line px-4 py-4">
          {report.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-[13px]">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[c.status]}`}
              />
              <span className="text-brand-mute">{c.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
