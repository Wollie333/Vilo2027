"use client";

import {
  CreditCard,
  Info,
  Landmark,
  Pencil,
  Plus,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import type {
  WizardPaymentKey,
  WizardPaymentMethod,
  WizardPolicy,
  WizardState,
} from "../wizardState";

const METHOD_ICON: Record<WizardPaymentKey, LucideIcon> = {
  paystack: CreditCard,
  paypal: Wallet,
  eft: Landmark,
};

// Confirm-and-activate: the host's real payment methods + policies, each with a
// "show on website" toggle. Edits open the account editor in a new tab so the
// (in-memory) wizard progress is never lost. Persisted per-site on build.
export function StepPayments({
  paymentMethods,
  policies,
  state,
  update,
  onNext,
  onBack,
}: {
  paymentMethods: WizardPaymentMethod[];
  policies: WizardPolicy[];
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("website");

  const togglePayment = (key: string) =>
    update({
      paymentVisibility: {
        ...state.paymentVisibility,
        [key]: !state.paymentVisibility[key],
      },
    });

  const togglePolicy = (key: string) =>
    update({
      policyVisibility: {
        ...state.policyVisibility,
        [key]: !state.policyVisibility[key],
      },
    });

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-bold text-brand-ink">
          {t("wizardPaymentsTitle")}
        </h3>
        <p className="mt-0.5 text-[13px] text-brand-mute">
          {t("wizardPaymentsBody")}
        </p>
      </div>

      {/* Scope warning — edits here apply account-wide, not just to this site. */}
      <div className="flex items-start gap-2 rounded-card border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12.5px] text-amber-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t("wizardPaymentsScope")}</span>
      </div>

      {/* Payment methods */}
      <section className="space-y-2.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          {t("wizardPayMethodsHeading")}
        </h4>
        <ul className="space-y-2">
          {paymentMethods.map((m) => {
            const Icon = METHOD_ICON[m.key];
            const on = state.paymentVisibility[m.key] ?? false;
            return (
              <li
                key={m.key}
                className="flex items-center gap-3 rounded-card border border-brand-line px-3.5 py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-brand-light text-brand-ink">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13.5px] font-semibold text-brand-ink">
                      {t(`wizardPayMethod_${m.key}`)}
                    </span>
                    <StatusBadge status={m.status} t={t} />
                    <ScopeChip label={t("wizardScopeChip")} />
                  </div>
                  <p className="mt-0.5 text-[12px] text-brand-mute">
                    {t(`wizardPayMethodDesc_${m.key}`)}
                  </p>
                </div>
                <EditLink href={m.editHref} label={t("wizardEdit")} />
                <Toggle
                  on={on}
                  onClick={() => togglePayment(m.key)}
                  label={t("wizardShowOnSite")}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {/* Policies */}
      <section className="space-y-2.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          {t("wizardPoliciesHeading")}
        </h4>
        <ul className="space-y-2">
          {policies.map((p) => {
            const on = state.policyVisibility[p.key] ?? false;
            const label = p.name || t(`wizardPolicyType_${p.type}`);
            if (!p.configured) {
              return (
                <li
                  key={p.key}
                  className="flex items-center gap-3 rounded-card border border-amber-200 bg-amber-50/60 px-3.5 py-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-amber-100 text-amber-700">
                    <ShieldCheck className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[13.5px] font-semibold text-brand-ink">
                      {t(`wizardPolicyType_${p.type}`)}
                    </span>
                    <p className="mt-0.5 text-[12px] text-amber-700">
                      {t("wizardPolicyNotSet")}
                    </p>
                  </div>
                  <EditLink
                    href={p.editHref}
                    label={t("wizardAdd")}
                    icon={Plus}
                  />
                </li>
              );
            }
            return (
              <li
                key={p.key}
                className="flex items-center gap-3 rounded-card border border-brand-line px-3.5 py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-brand-light text-brand-ink">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-[13.5px] font-semibold text-brand-ink">
                    {label}
                  </span>
                  {p.summary ? (
                    <p className="mt-0.5 truncate text-[12px] text-brand-mute">
                      {p.summary}
                    </p>
                  ) : null}
                </div>
                <EditLink href={p.editHref} label={t("wizardEdit")} />
                <Toggle
                  on={on}
                  onClick={() => togglePolicy(p.key)}
                  label={t("wizardShowOnSite")}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="rounded-[10px] border border-brand-line px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-light"
        >
          {t("wizardBack")}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
        >
          {t("wizardNext")}
        </button>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: "active" | "review";
  t: ReturnType<typeof useTranslations>;
}) {
  const active = status === "active";
  return (
    <span
      className={`rounded-pill px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        active
          ? "bg-brand-primary/10 text-brand-primary"
          : "bg-amber-100 text-amber-700"
      }`}
    >
      {active ? t("wizardStatusActive") : t("wizardStatusReview")}
    </span>
  );
}

function ScopeChip({ label }: { label: string }) {
  return (
    <span className="rounded-pill bg-brand-light px-1.5 py-0.5 text-[10px] font-medium text-brand-mute">
      {label}
    </span>
  );
}

function EditLink({
  href,
  label,
  icon: Icon = Pencil,
}: {
  href: string;
  label: string;
  icon?: LucideIcon;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex shrink-0 items-center gap-1 rounded-[8px] border border-brand-line px-2.5 py-1.5 text-[12px] font-semibold text-brand-ink transition-colors hover:bg-brand-light"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

function Toggle({
  on,
  onClick,
  label,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        on ? "bg-brand-primary" : "bg-brand-line"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
          on ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
