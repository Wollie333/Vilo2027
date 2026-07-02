"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { ReadinessItem } from "@/lib/website/readiness";

import { createWebsiteWithWizardAction } from "../actions";
import { StepBasics } from "./steps/StepBasics";
import { StepBuilding } from "./steps/StepBuilding";
import { StepColors } from "./steps/StepColors";
import { StepDone } from "./steps/StepDone";
import { StepTheme } from "./steps/StepTheme";
import {
  initialWizardState,
  type WizardProps,
  type WizardState,
} from "./wizardState";

type Step = "basics" | "theme" | "colors" | "building" | "done";
const ORDER: Step[] = ["basics", "theme", "colors", "building", "done"];

const ERROR_KEY: Record<string, string> = {
  too_short: "errTooShort",
  too_long: "errTooLong",
  invalid_chars: "errInvalidChars",
  reserved: "errReserved",
  subdomain_taken: "errSubdomainTaken",
  already_exists: "errAlreadyExists",
  business_not_found: "errBusinessNotFound",
};

export function WebsiteWizard({
  open,
  onClose,
  ...props
}: WizardProps & { open: boolean; onClose: () => void }) {
  const t = useTranslations("website");
  const [step, setStep] = useState<Step>("basics");
  const [state, setState] = useState<WizardState>(() =>
    initialWizardState(props),
  );
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  // Whether the auto-publish went live, + what's left if it didn't (the go-live
  // readiness gate holds a brand-new site as a draft until it's bookable).
  const [published, setPublished] = useState(true);
  const [missing, setMissing] = useState<ReadinessItem[]>([]);

  if (!open) return null;

  const update = (patch: Partial<WizardState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  async function build() {
    setError(null);
    setStep("building");
    const res = await createWebsiteWithWizardAction({
      businessId: props.businessId,
      subdomain: state.subdomain,
      siteName: state.siteName,
      themeId: state.themeId,
      paletteIndex: state.paletteIndex,
      customAccent:
        state.useCustom && state.customAccent ? state.customAccent : undefined,
      logoPath: state.logoPath ?? undefined,
      contactEmail: state.contactEmail || undefined,
      contactPhone: state.contactPhone || undefined,
    });
    if (res.ok) {
      setCreatedId(res.id);
      setPublished(res.published ?? true);
      setMissing(res.missing ?? []);
      setStep("done");
    } else {
      setError(t(ERROR_KEY[res.error] ?? "errGeneric"));
    }
  }

  const stepIndex = ORDER.indexOf(step);
  const dismissable = step !== "building" && step !== "done";

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/50 p-0 sm:items-center sm:p-6">
      <div className="flex w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
          <div className="flex items-center gap-2">
            {ORDER.slice(0, 5).map((s, i) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIndex
                    ? "w-6 bg-brand-primary"
                    : i < stepIndex
                      ? "w-1.5 bg-brand-primary"
                      : "w-1.5 bg-brand-line"
                }`}
              />
            ))}
          </div>
          {dismissable ? (
            <button
              type="button"
              onClick={onClose}
              aria-label={t("cancel")}
              className="rounded-full p-1 text-brand-mute transition-colors hover:bg-brand-light hover:text-brand-ink"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <span className="h-6 w-6" />
          )}
        </div>

        {/* body */}
        <div className="thin overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {step === "basics" ? (
            <StepBasics
              state={state}
              update={update}
              onNext={() => setStep("theme")}
            />
          ) : null}
          {step === "theme" ? (
            <StepTheme
              themes={props.themes}
              state={state}
              update={update}
              onNext={() => setStep("colors")}
              onBack={() => setStep("basics")}
            />
          ) : null}
          {step === "colors" ? (
            <StepColors
              themes={props.themes}
              state={state}
              update={update}
              onCreate={build}
              onBack={() => setStep("theme")}
            />
          ) : null}
          {step === "building" ? (
            <StepBuilding error={error} onRetry={build} />
          ) : null}
          {step === "done" && createdId ? (
            <StepDone
              websiteId={createdId}
              subdomain={state.subdomain}
              published={published}
              missing={missing}
              onClose={onClose}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
