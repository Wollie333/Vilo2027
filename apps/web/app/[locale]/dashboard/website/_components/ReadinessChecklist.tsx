"use client";

import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { ReadinessItem, ReadinessKey } from "@/lib/website/readiness";

const LABEL_KEY: Record<ReadinessKey, string> = {
  name: "readinessName",
  room: "readinessRoom",
  payment: "readinessPayment",
  subdomain: "readinessSubdomain",
  policy: "readinessPolicy",
};

/**
 * The go-live readiness checklist — the shared surface for the founder-locked
 * hard-required set. Reused by the editor Publish button and the setup wizard's
 * final step so "what's left to go live" reads identically everywhere. `missing`
 * comes straight from `checkWebsiteReadiness`; an empty list renders the ready
 * state.
 */
export function ReadinessChecklist({
  missing,
  onFixNavigate,
}: {
  missing: ReadinessItem[];
  /** Called before following a fix link (e.g. to close a wizard modal). */
  onFixNavigate?: () => void;
}) {
  const t = useTranslations("website");

  if (missing.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-[10px] bg-brand-primary/10 px-3.5 py-3 text-brand-primary">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="text-[13px] font-semibold">{t("readinessReady")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-2 text-brand-ink">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div>
          <p className="text-[13px] font-semibold leading-tight">
            {t("readinessTitle")}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-brand-mute">
            {t("readinessSubtitle")}
          </p>
        </div>
      </div>
      <ul className="space-y-1.5">
        {missing.map((m) => (
          <li key={m.key}>
            <Link
              href={m.fixHref}
              onClick={onFixNavigate}
              className="group flex items-center justify-between gap-3 rounded-[9px] border border-brand-line bg-white px-3 py-2 text-[13px] font-medium text-brand-ink transition-colors hover:border-brand-primary/40 hover:bg-brand-light"
            >
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                {t(LABEL_KEY[m.key])}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-brand-primary">
                {t("readinessFix")}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
