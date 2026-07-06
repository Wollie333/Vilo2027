"use client";

import { CreditCard, Info } from "lucide-react";
import { useTranslations } from "next-intl";

// Placeholder for the confirm-and-activate payments & policies step. The real
// payment-method and policy panels (reusing the account editors) land in a
// later phase; the step is wired into the flow now so navigation is complete.
export function StepPayments({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("website");

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-bold text-brand-ink">
          {t("wizardPaymentsTitle")}
        </h3>
        <p className="mt-0.5 text-[13px] text-brand-mute">
          {t("wizardPaymentsBody")}
        </p>
      </div>

      {/* Scope warning — edits here apply account-wide, not just to this site. */}
      <div className="flex items-start gap-2 rounded-card border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12.5px] text-amber-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t("wizardPaymentsScope")}</span>
      </div>

      <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-brand-line px-4 py-10 text-center">
        <CreditCard className="h-6 w-6 text-brand-mute" />
        <p className="max-w-xs text-[13px] text-brand-mute">
          {t("wizardPaymentsComingSoon")}
        </p>
      </div>

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
