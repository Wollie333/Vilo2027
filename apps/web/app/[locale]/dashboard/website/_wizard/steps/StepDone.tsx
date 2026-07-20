"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Globe, Loader2, Rocket } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { ReadinessChecklist } from "../../_components/ReadinessChecklist";
import {
  checkWebsiteReadinessAction,
  publishWebsiteAction,
} from "../../actions";
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

  // Live-updatable go-live state: the wizard finished with `published`/`missing`,
  // but the host can fix the remaining items (the checklist deep-links each one)
  // and then publish RIGHT HERE — so mirror both into state and let the
  // "Re-check & publish" button flip the site live without leaving the wizard.
  const [isPublished, setIsPublished] = useState(published);
  const [remaining, setRemaining] = useState<ReadinessItem[]>(missing);
  const [publishing, setPublishing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function recheckAndPublish() {
    setPublishing(true);
    setNote(null);
    // Publishing enforces the same readiness gate server-side, so a single call
    // both re-checks and goes live when everything's in place.
    const res = await publishWebsiteAction(websiteId);
    if (res.ok) {
      setIsPublished(true);
      setPublishing(false);
      return;
    }
    // Not ready yet — refresh the checklist so the host sees exactly what's still
    // outstanding (an item they've since fixed drops off).
    if (res.error === "not_ready") {
      const report = await checkWebsiteReadinessAction(websiteId);
      if (report.ok) setRemaining(report.missing);
      setNote(t("wizardPublishStillMissing"));
    } else {
      setNote(t("wizardPublishError"));
    }
    setPublishing(false);
  }

  // Draft outcome — the go-live readiness gate held the new site back. Show the
  // host exactly what's left, deep-link each fix, and let them publish from here.
  if (!isPublished) {
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
          <ReadinessChecklist missing={remaining} onFixNavigate={onClose} />
        </div>

        {note ? (
          <p className="mx-auto max-w-sm rounded-[10px] border border-brand-line bg-brand-light px-3.5 py-2.5 text-center text-[12px] leading-snug text-brand-mute">
            {note}
          </p>
        ) : null}

        <div className="mx-auto flex w-full max-w-sm flex-col gap-2.5">
          <button
            type="button"
            onClick={recheckAndPublish}
            disabled={publishing}
            className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:opacity-60"
          >
            {publishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("wizardPublishing")}
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4" />
                {t("wizardPublishNow")}
              </>
            )}
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
