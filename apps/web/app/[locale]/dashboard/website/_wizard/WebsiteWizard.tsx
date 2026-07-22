"use client";

import "./wizard.css";

import { Monitor, Smartphone, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { generatePalettes, isHexColor } from "@/lib/site/palettes";
import type { ReadinessItem } from "@/lib/website/readiness";

import { createWebsiteWithWizardAction } from "../actions";
import { StepBasics } from "./steps/StepBasics";
import { StepBuilding } from "./steps/StepBuilding";
import { StepColors } from "./steps/StepColors";
import { StepDone } from "./steps/StepDone";
import { StepPages } from "./steps/StepPages";
import { StepPayments } from "./steps/StepPayments";
import { StepReview } from "./steps/StepReview";
import { StepStory } from "./steps/StepStory";
import { StepTheme } from "./steps/StepTheme";
import { WizardLivePreview } from "./WizardLivePreview";
import {
  CompletionRing,
  Confetti,
  ProgressRail,
  PublishBar,
  SectionCard,
  type WizardSectionMeta,
} from "./WizardChrome";
import {
  initialWizardState,
  type WizardProps,
  type WizardState,
} from "./wizardState";

const ERROR_KEY: Record<string, string> = {
  too_short: "errTooShort",
  too_long: "errTooLong",
  invalid_chars: "errInvalidChars",
  reserved: "errReserved",
  subdomain_taken: "errSubdomainTaken",
  already_exists: "errAlreadyExists",
  business_not_found: "errBusinessNotFound",
};

// The seven setup sections — numbered cards down the page, mirrored in the
// sticky rail. `hint` is the warm one-line framing shown under each card title.
// `required` drives the build/publish gate (basics + theme are the essentials;
// everything else is prefilled/optional and can be refined after launch).
const SECTIONS: WizardSectionMeta[] = [
  {
    id: "basics",
    n: "01",
    label: "Basics",
    rail: "Basics",
    required: true,
    hint: "Your site name, address and how guests reach you.",
  },
  {
    id: "theme",
    n: "02",
    label: "Theme",
    rail: "Theme",
    required: true,
    hint: "Pick the look that feels most like your place.",
  },
  {
    id: "colors",
    n: "03",
    label: "Colours",
    rail: "Colours",
    required: false,
    hint: "Choose a palette or drop in your own accent.",
  },
  {
    id: "story",
    n: "04",
    label: "Your story",
    rail: "Story",
    required: false,
    hint: "Tell us about your place and we'll write your copy.",
  },
  {
    id: "payments",
    n: "05",
    label: "Payments",
    rail: "Payments",
    required: false,
    hint: "How guests pay, and which policies show on your site.",
  },
  {
    id: "pages",
    n: "06",
    label: "Pages",
    rail: "Pages",
    required: false,
    hint: "The pages we'll build — keep them all or toggle any off.",
  },
  {
    id: "preview",
    n: "07",
    label: "Review & publish",
    rail: "Publish",
    required: false,
    hint: "This is your site. Review it, then build when you're happy.",
  },
];

const EDITABLE = SECTIONS.filter((s) => s.id !== "preview");

type Phase = "edit" | "building" | "done";

export function WebsiteWizard(props: WizardProps) {
  const t = useTranslations("website");
  const router = useRouter();
  const [state, setState] = useState<WizardState>(() =>
    initialWizardState(props),
  );
  const [phase, setPhase] = useState<Phase>("edit");
  const [active, setActive] = useState<string>("basics");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  // Whether the auto-publish went live, + what's left if it didn't (the go-live
  // readiness gate holds a brand-new site as a draft until it's bookable).
  const [published, setPublished] = useState(true);
  const [missing, setMissing] = useState<ReadinessItem[]>([]);

  // If a site ALREADY existed for this business when the wizard opened, bounce to
  // its editor — once, on mount only (gated behind the enforce-one-site flag;
  // default OFF pre-launch so the flow can be re-run for testing).
  const bounceId = useRef(props.existingWebsiteId ?? null);
  useEffect(() => {
    if (
      process.env.NEXT_PUBLIC_WIZARD_ENFORCE_ONE_SITE === "true" &&
      bounceId.current
    ) {
      router.replace(`/dashboard/website/${bounceId.current}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => router.push("/dashboard/website");
  const update = (patch: Partial<WizardState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  // The selected theme + the accent actually in effect (same resolution the
  // colours step uses), so the finale preview reflects the host's choices.
  const theme =
    props.themes.find((x) => x.id === state.themeId) ?? props.themes[0];
  const baseAccent = theme?.base?.palette?.accent ?? "#0a7d4b";
  const effectiveAccent = useMemo(() => {
    if (state.useCustom && isHexColor(state.customAccent))
      return state.customAccent;
    const palettes = generatePalettes(baseAccent);
    return palettes[state.paletteIndex]?.accent ?? baseAccent;
  }, [state.useCustom, state.customAccent, state.paletteIndex, baseAccent]);

  // Per-section completion — drives the ring %, rail status discs and the gate.
  const completion = useMemo<Record<string, boolean>>(
    () => ({
      basics: state.siteName.trim().length > 2 && state.subdomain.length >= 3,
      theme: !!state.themeId,
      colors: true, // a palette is always selected (index 0 by default)
      story: !!state.contentProfile, // "done" once the AI copy is generated
      payments: true, // methods are prefilled from the account
      pages: state.pages.some((p) => p.include),
      preview: phase === "done",
    }),
    [state, phase],
  );

  const pct = useMemo(() => {
    const done = EDITABLE.filter((s) => completion[s.id]).length;
    return Math.round((done / EDITABLE.length) * 100);
  }, [completion]);

  const requiredMissing = useMemo(
    () => SECTIONS.filter((s) => s.required && !completion[s.id]),
    [completion],
  );
  const ready = requiredMissing.length === 0;

  const jump = (id: string) => {
    document
      .getElementById(`sec-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Scroll-spy: highlight the section the reader is in.
  useEffect(() => {
    if (phase !== "edit") return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = vis[0]?.target.getAttribute("data-section");
        if (id) setActive(id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(`sec-${s.id}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [phase]);

  async function build() {
    if (!ready) {
      jump(requiredMissing[0].id);
      return;
    }
    setError(null);
    setPhase("building");
    // A policy TYPE is hidden only when the host configured policies of that type
    // AND turned them all off (opt-out). The site's "things to know" drops those.
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
      draftWebsiteId: state.draftWebsiteId ?? undefined,
    });
    if (res.ok) {
      setCreatedId(res.id);
      setPublished(res.published ?? true);
      setMissing(res.missing ?? []);
      setPhase("done");
    } else {
      setError(t(ERROR_KEY[res.error] ?? "errGeneric"));
    }
  }

  const renderers: Record<string, React.ReactNode> = {
    basics: <StepBasics state={state} update={update} embedded />,
    theme: (
      <StepTheme themes={props.themes} state={state} update={update} embedded />
    ),
    colors: (
      <StepColors
        themes={props.themes}
        state={state}
        update={update}
        embedded
      />
    ),
    story: <StepStory state={state} update={update} embedded />,
    payments: (
      <StepPayments
        paymentMethods={props.paymentMethods}
        policies={props.policies}
        state={state}
        update={update}
        embedded
      />
    ),
    pages: (
      <StepPages state={state} rooms={props.rooms} update={update} embedded />
    ),
  };

  return (
    <div className="wz-root mx-auto max-w-6xl">
      {/* page intro + completion ring */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-pill bg-brand-accent px-2.5 py-1 text-[11px] font-semibold text-brand-secondary">
            <Sparkles className="h-3.5 w-3.5" /> Let&apos;s build your website
          </div>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            Set up {props.defaultName}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-brand-mute">
            Work through the steps below — everything you enter builds the live
            preview at the bottom. The required steps unlock the build button.
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-card border border-brand-line bg-white px-5 py-4 shadow-card">
          <CompletionRing pct={pct} />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-brand-ink">
              Setup progress
            </div>
            <div className="text-xs text-brand-mute">
              {ready
                ? "Ready to build"
                : `${requiredMissing.length} required step${
                    requiredMissing.length === 1 ? "" : "s"
                  } left`}
            </div>
          </div>
        </div>
      </div>

      {/* rail + section cards */}
      <div className="mt-7 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-3">
          <ProgressRail
            sections={SECTIONS}
            active={active}
            completion={completion}
            pct={pct}
            onJump={jump}
            ready={ready}
            onPublish={build}
          />
        </div>

        <div className="col-span-12 space-y-5 lg:col-span-9">
          {EDITABLE.map((s) => (
            <SectionCard
              key={s.id}
              meta={s}
              complete={!!completion[s.id]}
              active={active === s.id}
            >
              {renderers[s.id]}
            </SectionCard>
          ))}

          {/* 07 — Review & publish: summary + framed live preview + publish bar */}
          <SectionCard
            meta={SECTIONS[SECTIONS.length - 1]}
            complete={phase === "done"}
            active={active === "preview"}
          >
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="-mt-1 max-w-xl text-sm text-brand-mute">
                  This is exactly what guests will see. It updates live as you
                  edit the steps above — review it, then build when you&apos;re
                  happy.
                </p>
                <div className="inline-flex items-center gap-1 rounded-pill border border-brand-line bg-white p-1">
                  {(
                    [
                      { id: "desktop", icon: Monitor, label: "Desktop" },
                      { id: "mobile", icon: Smartphone, label: "Mobile" },
                    ] as const
                  ).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDevice(d.id)}
                      className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-semibold transition ${
                        device === d.id
                          ? "bg-brand-primary text-white"
                          : "text-brand-mute hover:text-brand-ink"
                      }`}
                    >
                      <d.icon className="h-3.5 w-3.5" /> {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <StepReview
                themes={props.themes}
                paymentMethods={props.paymentMethods}
                policies={props.policies}
                state={state}
                embedded
              />

              {theme?.slug ? (
                <WizardLivePreview
                  slug={theme.slug}
                  accent={effectiveAccent}
                  siteName={state.siteName}
                  device={device}
                />
              ) : null}

              <PublishBar
                ready={ready}
                missing={requiredMissing}
                onPublish={build}
                onJump={jump}
              />
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Building overlay */}
      {phase === "building" ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-card bg-white p-6 shadow-peek">
            <StepBuilding error={error} onRetry={build} />
          </div>
        </div>
      ) : null}

      {/* Published / draft outcome */}
      {phase === "done" && createdId ? (
        <>
          {published ? <Confetti /> : null}
          <div className="fixed inset-0 z-[75] flex items-center justify-center overflow-y-auto bg-brand-dark/40 p-4 backdrop-blur-sm">
            <div className="my-auto w-full max-w-md rounded-card bg-white p-6 shadow-peek">
              <StepDone
                websiteId={createdId}
                subdomain={state.subdomain}
                published={published}
                missing={missing}
                onClose={close}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
