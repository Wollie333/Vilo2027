"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import type { AnalyticsRange } from "@/lib/website/analytics";

const RANGES: AnalyticsRange[] = ["7d", "30d", "90d"];

/** Segmented control that drives the `?range=` search param (server re-reads it). */
export function RangeTabs({ value }: { value: AnalyticsRange }) {
  const t = useTranslations("website");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(range: AnalyticsRange) {
    const next = new URLSearchParams(params.toString());
    next.set("range", range);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="inline-flex rounded-pill border border-brand-line bg-brand-light/60 p-0.5 text-[12px] font-semibold">
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => set(r)}
          className={`rounded-pill px-3 py-1.5 transition ${
            value === r
              ? "bg-white text-brand-secondary shadow-sm"
              : "text-brand-mute hover:text-brand-ink"
          }`}
        >
          {t(`range${r === "7d" ? "7d" : r === "30d" ? "30d" : "90d"}`)}
        </button>
      ))}
    </div>
  );
}
