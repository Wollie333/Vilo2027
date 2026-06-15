"use client";

import { ChevronRight, Compass } from "lucide-react";
import { useTranslations } from "next-intl";

import { startTour } from "./tourBus";

/**
 * Launches the guided dashboard tour. Two shapes:
 *  - "row"  — a list row matching the onboarding "A hand to get going" panel.
 *  - "pill" — a standalone pill button (Help page, hero, etc.).
 */
export function TourButton({ variant = "pill" }: { variant?: "row" | "pill" }) {
  const t = useTranslations("tour");

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={startTour}
        className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition hover:bg-brand-light"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-light text-brand-secondary">
          <Compass className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-brand-ink">
            {t("launchTitle")}
          </span>
          <span className="block text-[11.5px] text-brand-mute">
            {t("launchSub")}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 text-brand-mute" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={startTour}
      className="inline-flex h-11 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-4 text-[14px] font-medium text-brand-ink transition hover:bg-brand-light"
    >
      <Compass className="h-4 w-4 text-brand-primary" /> {t("launchCta")}
    </button>
  );
}
