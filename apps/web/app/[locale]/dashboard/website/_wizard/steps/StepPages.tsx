"use client";

import { useTranslations } from "next-intl";

import type { WizardPage, WizardState } from "../wizardState";

// Pages step (P1 scaffold): lists the six canonical pages with include toggles.
// Drag-to-reorder, the live nav preview and the auto Rooms submenu land in a
// later phase; the ordered/included set already persists into wizard state.
export function StepPages({
  state,
  update,
  onNext,
  onBack,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("website");

  const toggle = (kind: WizardPage["kind"]) => {
    // Home is the site root — always included.
    if (kind === "home") return;
    const next = state.pages.map((p) =>
      p.kind === kind ? { ...p, include: !p.include } : p,
    );
    update({ pages: next });
  };

  let order = 0;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-bold text-brand-ink">
          {t("wizardPagesTitle")}
        </h3>
        <p className="mt-0.5 text-[13px] text-brand-mute">
          {t("wizardPagesBody")}
        </p>
      </div>

      <ul className="divide-y divide-brand-line overflow-hidden rounded-card border border-brand-line">
        {state.pages.map((p) => {
          const on = p.include;
          if (on) order += 1;
          const locked = p.kind === "home";
          return (
            <li
              key={p.kind}
              className={`flex items-center gap-3 px-3.5 py-3 ${
                on ? "" : "opacity-50"
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-light text-[12px] font-semibold text-brand-ink">
                {on ? order : "—"}
              </span>
              <span
                className={`flex-1 text-[14px] font-semibold text-brand-ink ${
                  on ? "" : "line-through"
                }`}
              >
                {t(`wizardPage_${p.kind}`)}
              </span>
              <button
                type="button"
                onClick={() => toggle(p.kind)}
                disabled={locked}
                aria-pressed={on}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  on ? "bg-brand-primary" : "bg-brand-line"
                } ${locked ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                    on ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="rounded-[10px] border border-brand-line px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-light"
        >
          {t("wizardBack")}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
        >
          {t("wizardNext")}
        </button>
      </div>
    </div>
  );
}
