"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import type { ReadinessItem } from "@/lib/website/readiness";

import { createWebsiteWithWizardAction } from "../actions";
import { StepBasics } from "./steps/StepBasics";
import { StepBuilding } from "./steps/StepBuilding";
import { StepColors } from "./steps/StepColors";
import { StepDone } from "./steps/StepDone";
import { StepPages } from "./steps/StepPages";
import { StepPayments } from "./steps/StepPayments";
import { StepReview } from "./steps/StepReview";
import { StepTheme } from "./steps/StepTheme";
import { WizardSidebar } from "./WizardSidebar";
import {
  initialWizardState,
  type WizardProps,
  type WizardState,
} from "./wizardState";

type Step =
  | "basics"
  | "theme"
  | "colors"
  | "payments"
  | "pages"
  | "review"
  | "building"
  | "done";
/** The user-facing steps shown as progress dots (build/done are the go-live tail). */
const NAV_STEPS: Step[] = [
  "basics",
  "theme",
  "colors",
  "payments",
  "pages",
  "review",
];

const ERROR_KEY: Record<string, string> = {
  too_short: "errTooShort",
  too_long: "errTooLong",
  invalid_chars: "errInvalidChars",
  reserved: "errReserved",
  subdomain_taken: "errSubdomainTaken",
  already_exists: "errAlreadyExists",
  business_not_found: "errBusinessNotFound",
};

export function WebsiteWizard(props: WizardProps) {
  const t = useTranslations("website");
  const router = useRouter();
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

  // Leaving the wizard returns to the website landing (the create surface).
  const close = () => router.push("/dashboard/website");

  const update = (patch: Partial<WizardState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  async function build() {
    setError(null);
    setStep("building");
    // A policy TYPE is hidden only when the host has configured policies of that
    // type AND turned them all off (opt-out — never hides property-column
    // policies the host has no library entry for). The site's "things to know"
    // block drops those types.
    const byType = new Map<string, { any: boolean; shown: boolean }>();
    for (const p of props.policies) {
      if (!p.configured) continue;
      const e = byType.get(p.type) ?? { any: false, shown: false };
      e.any = true;
      if (state.policyVisibility[p.key]) e.shown = true;
      byType.set(p.type, e);
    }
    const hiddenPolicyTypes = [...byType.entries()]
      .filter(([, e]) => e.any && !e.shown)
      .map(([type]) => type);
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
      paymentsVisibility: {
        paystack: state.paymentVisibility.paystack ?? false,
        paypal: state.paymentVisibility.paypal ?? false,
        eft: state.paymentVisibility.eft ?? false,
      },
      hiddenPolicyTypes,
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

  // Highlight dots up to the current nav step; during the build/done tail every
  // nav step reads as complete.
  const navIndex = NAV_STEPS.includes(step)
    ? NAV_STEPS.indexOf(step)
    : NAV_STEPS.length;
  const dismissable = step !== "building" && step !== "done";

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex w-full flex-col overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        {/* header */}
        <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
          <div className="flex items-center gap-2">
            {NAV_STEPS.map((s, i) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  i === navIndex
                    ? "w-6 bg-brand-primary"
                    : i < navIndex
                      ? "w-1.5 bg-brand-primary"
                      : "w-1.5 bg-brand-line"
                }`}
              />
            ))}
          </div>
          {dismissable ? (
            <button
              type="button"
              onClick={close}
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
        <div className="px-5 py-5 sm:px-7 sm:py-6">
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
              onNext={() => setStep("payments")}
              onBack={() => setStep("theme")}
            />
          ) : null}
          {step === "payments" ? (
            <StepPayments
              paymentMethods={props.paymentMethods}
              policies={props.policies}
              state={state}
              update={update}
              onNext={() => setStep("pages")}
              onBack={() => setStep("colors")}
            />
          ) : null}
          {step === "pages" ? (
            <StepPages
              state={state}
              update={update}
              onNext={() => setStep("review")}
              onBack={() => setStep("payments")}
            />
          ) : null}
          {step === "review" ? (
            <StepReview
              themes={props.themes}
              paymentMethods={props.paymentMethods}
              policies={props.policies}
              state={state}
              onBuild={build}
              onBack={() => setStep("pages")}
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
              onClose={close}
            />
          ) : null}
        </div>
      </div>

      {dismissable ? (
        <WizardSidebar
          themes={props.themes}
          paymentMethods={props.paymentMethods}
          policies={props.policies}
          state={state}
        />
      ) : null}
    </div>
  );
}
