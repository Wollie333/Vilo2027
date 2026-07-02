"use client";

import { ArrowRight, CheckCircle2, Globe, Rocket } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { ReadinessChecklist } from "../../_components/ReadinessChecklist";
import type { ReadinessItem } from "@/lib/website/readiness";

export function StepDone({
  websiteId,
  subdomain,
  published,
  missing,
  onClose,
}: {
  websiteId: string;
  subdomain: string;
  published: boolean;
  missing: ReadinessItem[];
  onClose: () => void;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "wielo.site";

  // Draft outcome — the go-live readiness gate held the new site back. Show the
  // host exactly what's left and route them straight to fixing it.
  if (!published) {
    return (
      <div className="flex flex-col gap-5 py-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Rocket className="h-7 w-7" />
          </span>
          <div>
            <h3 className="font-display text-xl font-bold text-brand-ink">
              {t("wizardDoneDraftTitle")}
            </h3>
            <p className="mt-1 text-[13px] leading-snug text-brand-mute">
              {t("wizardDoneDraftSubtitle")}
            </p>
            <p className="mt-1 font-mono text-[12px] text-brand-mute">
              {subdomain}.{root}
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <ReadinessChecklist missing={missing} onFixNavigate={onClose} />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-col gap-2.5">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/website/${websiteId}`)}
            className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
          >
            {t("wizardContinueEditor")}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
        <CheckCircle2 className="h-7 w-7" />
      </span>
      <div>
        <h3 className="font-display text-xl font-bold text-brand-ink">
          {t("wizardDoneTitle")}
        </h3>
        <p className="mt-1 font-mono text-[13px] text-brand-mute">
          {subdomain}.{root}
        </p>
      </div>

      <div className="mt-2 flex w-full max-w-sm flex-col gap-2.5">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/website/${websiteId}/domain`)}
          className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
        >
          <Globe className="h-4 w-4" />
          {t("wizardConnectDomain")}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/dashboard/website/${websiteId}`)}
          className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-brand-line px-5 py-3 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-light"
        >
          {t("wizardContinueEditor")}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
