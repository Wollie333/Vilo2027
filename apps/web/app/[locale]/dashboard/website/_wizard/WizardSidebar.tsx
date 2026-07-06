"use client";

import { useTranslations } from "next-intl";

import { generatePalettes, isHexColor } from "@/lib/site/palettes";
import type { ThemeOption } from "@/lib/site/themes.server";

import {
  themeBaseAccent,
  type WizardPaymentMethod,
  type WizardPolicy,
  type WizardState,
} from "./wizardState";

// The live "Site build" status panel that sits beside the steps (spec: the
// sidebar updates in real time as the host makes choices).
export function WizardSidebar({
  themes,
  paymentMethods,
  policies,
  state,
}: {
  themes: ThemeOption[];
  paymentMethods: WizardPaymentMethod[];
  policies: WizardPolicy[];
  state: WizardState;
}) {
  const t = useTranslations("website");
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "wielo.site";

  const theme = themes.find((x) => x.id === state.themeId) ?? themes[0];
  const baseAccent = themeBaseAccent(themes, state.themeId);
  const palettes = generatePalettes(baseAccent);
  const liveAccent =
    state.useCustom && isHexColor(state.customAccent)
      ? state.customAccent
      : (palettes[state.paletteIndex]?.accent ?? baseAccent);

  const included = state.pages.filter((p) => p.include);
  const pageNames = included.map((p) => t(`wizardPage_${p.kind}`)).join(", ");
  const paymentsOn = paymentMethods.filter(
    (m) => state.paymentVisibility[m.key],
  ).length;
  const policiesOn = policies.filter(
    (p) => p.configured && state.policyVisibility[p.key],
  ).length;

  return (
    <aside className="lg:sticky lg:top-4">
      <div className="rounded-card border border-brand-line bg-brand-light/40 p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          {t("wizardSideTitle")}
        </h4>

        <dl className="mt-3 space-y-3">
          <Row label={t("wizardSideAddress")}>
            <span className="font-mono text-[12px] text-brand-ink">
              {state.subdomain || "—"}
              <span className="text-brand-mute">.{root}</span>
            </span>
          </Row>

          <Row label={t("wizardReviewSkin")}>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-ink">
              <span
                className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ background: liveAccent }}
              />
              {theme?.name ?? "—"}
            </span>
          </Row>

          <Row
            label={t("wizardReviewPages")}
            value={t("wizardSidePagesValue", {
              active: included.length,
              total: state.pages.length,
            })}
          >
            {pageNames ? (
              <p className="mt-0.5 text-[11.5px] leading-snug text-brand-mute">
                {pageNames}
              </p>
            ) : null}
          </Row>

          <Row
            label={t("wizardReviewPayments")}
            value={String(paymentsOn)}
            muted={paymentsOn === 0}
          />
          <Row
            label={t("wizardReviewPolicies")}
            value={String(policiesOn)}
            muted={policiesOn === 0}
          />
        </dl>
      </div>

      <p className="mt-3 px-1 text-[11.5px] leading-snug text-brand-mute">
        {t("wizardSideNote")}
      </p>
    </aside>
  );
}

function Row({
  label,
  value,
  muted,
  children,
}: {
  label: string;
  value?: string;
  muted?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <dt className="text-[12px] text-brand-mute">{label}</dt>
        {value ? (
          <dd
            className={`text-[13px] font-semibold ${
              muted ? "text-brand-mute" : "text-brand-ink"
            }`}
          >
            {value}
          </dd>
        ) : null}
      </div>
      {children}
    </div>
  );
}
