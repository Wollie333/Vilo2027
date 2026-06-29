"use client";

import { ArrowRight, CheckCircle2, Globe } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function StepDone({
  websiteId,
  subdomain,
}: {
  websiteId: string;
  subdomain: string;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "wielo.site";

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
