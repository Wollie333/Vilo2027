"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function StepBuilding({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  const t = useTranslations("website");
  const messages = [
    t("wizardBuild1"),
    t("wizardBuild2"),
    t("wizardBuild3"),
    t("wizardBuild4"),
  ];
  const [i, setI] = useState(0);

  useEffect(() => {
    if (error) return;
    const id = setInterval(
      () => setI((n) => (n + 1 < messages.length ? n + 1 : n)),
      1100,
    );
    return () => clearInterval(id);
  }, [error, messages.length]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-status-cancelled/10 text-status-cancelled">
          <AlertCircle className="h-6 w-6" />
        </span>
        <p className="max-w-sm text-sm font-medium text-brand-ink">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
        >
          {t("wizardTryAgain")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      <p className="text-base font-semibold text-brand-ink">{messages[i]}</p>
      <div className="flex gap-1.5">
        {messages.map((_, n) => (
          <span
            key={n}
            className={`h-1.5 w-1.5 rounded-full ${
              n <= i ? "bg-brand-primary" : "bg-brand-line"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
