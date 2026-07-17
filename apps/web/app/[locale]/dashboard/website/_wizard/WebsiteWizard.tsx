"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import type { ReadinessItem } from "@/lib/website/readiness";

import {
  createDraftWebsiteAction,
  createWebsiteWithWizardAction,
} from "../actions";
import { StepBasics } from "./steps/StepBasics";
import { StepBuilding } from "./steps/StepBuilding";
import { StepColors } from "./steps/StepColors";
import { StepDone } from "./steps/StepDone";
import { StepPages } from "./steps/StepPages";
import { StepPayments } from "./steps/StepPayments";
import { StepReview } from "./steps/StepReview";
import { StepStory } from "./steps/StepStory";
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
  | "story"
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
  "story",
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

/** Per-step chrome for the conversational shell: a short progress label and a
 *  warm assistant line that frames the step above the controls (the "answer
 *  card"). Kept in English (wizard is English-first); the step controls keep
 *  their own i18n labels. */
const STEP_INTRO: Partial<Record<Step, { label: string; message: string }>> = {
  basics: {
    label: "Basics",
    message:
      "Hi! Let's get your website live in a few minutes. First, the basics — your site name and how guests reach you.",
  },
  theme: {
    label: "Theme",
    message:
      "Great. Now pick a look — choose the theme that feels most like your place.",
  },
  colors: {
    label: "Colours",
    message:
      "Nice choice. Let's set your colours — pick a palette or drop in your own.",
  },
  story: {
    label: "Your story",
    message:
      "Now the fun part: tell me a little about your place and I'll write your website copy for you. You can edit everything after.",
  },
  payments: {
    label: "Payments",
    message:
      "Almost there. How should guests pay, and which policies should show on your site?",
  },
  pages: {
    label: "Pages",
    message:
      "Here are the pages I'll build for you. Keep them all, or toggle any off.",
  },
  review: {
    label: "Review",
    message:
      "That's everything — here's a quick summary. Ready to build your site?",
  },
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

  // If a site ALREADY existed for this business when the wizard opened, bounce to
  // its editor — once, on mount only. Captured in a ref so the re-render a server
  // action triggers right after THIS wizard creates a site (which repopulates
  // existingWebsiteId) can't fire it again and skip the success screen.
  const bounceId = useRef(props.existingWebsiteId ?? null);
  useEffect(() => {
    if (bounceId.current) {
      router.replace(`/dashboard/website/${bounceId.current}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving the wizard returns to the website landing (the create surface).
  const close = () => router.push("/dashboard/website");

  const update = (patch: Partial<WizardState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  // Phase B — create (or resume) the draft site when the host leaves Basics, so
  // the row exists during the wizard and finalize UPDATES it. Non-blocking: if
  // draft creation fails (e.g. a taken subdomain), we still advance — finalize
  // falls back to the one-shot insert and surfaces the same error there, so the
  // wizard behaves exactly as before when the draft can't be created.
  async function advanceFromBasics() {
    if (!state.draftWebsiteId) {
      const res = await createDraftWebsiteAction({
        businessId: props.businessId,
        siteName: state.siteName,
        subdomain: state.subdomain,
        logoPath: state.logoPath ?? undefined,
      });
      if (res.ok) {
        setState((prev) => ({ ...prev, draftWebsiteId: res.id }));
      }
    }
    setStep("theme");
  }

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
      pages: state.pages.map((p) => ({ kind: p.kind, include: p.include })),
      contentProfile: state.contentProfile ?? undefined,
      // Phase B — finalize the draft created after Basics (UPDATE instead of
      // INSERT). Undefined → legacy one-shot insert path.
      draftWebsiteId: state.draftWebsiteId ?? undefined,
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
  const intro = STEP_INTRO[step];
  const stepNumber = NAV_STEPS.includes(step)
    ? NAV_STEPS.indexOf(step) + 1
    : NAV_STEPS.length;
  const statusLine =
    step === "done"
      ? "All done"
      : step === "building"
        ? "Building your site…"
        : `Step ${stepNumber} of ${NAV_STEPS.length}${intro ? ` · ${intro.label}` : ""}`;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex w-full flex-col overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        {/* header — assistant identity + progress + close */}
        <div className="flex items-center justify-between gap-3 border-b border-brand-line px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <p className="text-[13px] font-semibold text-brand-ink">
                Website setup
              </p>
              <p className="text-[11px] text-brand-mute">{statusLine}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1 sm:flex">
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
        </div>

        {/* conversation body — assistant bubble, then the step controls as the reply */}
        <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
          {intro ? (
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-brand-line bg-brand-light px-4 py-2.5 text-[13px] leading-relaxed text-brand-ink">
                {intro.message}
              </div>
            </div>
          ) : null}

          {step === "basics" ? (
            <StepBasics
              state={state}
              update={update}
              onNext={advanceFromBasics}
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
              onNext={() => setStep("story")}
              onBack={() => setStep("theme")}
            />
          ) : null}
          {step === "story" ? (
            <StepStory
              state={state}
              update={update}
              onNext={() => setStep("payments")}
              onBack={() => setStep("colors")}
            />
          ) : null}
          {step === "payments" ? (
            <StepPayments
              paymentMethods={props.paymentMethods}
              policies={props.policies}
              state={state}
              update={update}
              onNext={() => setStep("pages")}
              onBack={() => setStep("story")}
            />
          ) : null}
          {step === "pages" ? (
            <StepPages
              state={state}
              rooms={props.rooms}
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
