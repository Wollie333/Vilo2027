"use client";

import { Check, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useBrandName } from "@/components/brand/BrandProvider";

import { switchPlanAction } from "./actions";
import { PLANS, formatZar, type PlanKey } from "./plans";

type Props = {
  currentPlan: PlanKey;
  currentCycle: "monthly" | "annual" | null;
};

export function PlanPicker({ currentPlan, currentCycle }: Props) {
  const router = useRouter();
  const brandName = useBrandName();
  const [cycle, setCycle] = useState<"monthly" | "annual">(
    currentCycle ?? "monthly",
  );
  const [pendingPlan, setPendingPlan] = useState<PlanKey | null>(null);
  const [pending, start] = useTransition();

  function switchTo(plan: PlanKey) {
    if (plan === currentPlan && cycle === currentCycle) {
      toast.info("Already on this plan.");
      return;
    }
    setPendingPlan(plan);
    start(async () => {
      const result = await switchPlanAction({
        plan,
        cycle: plan === "free" ? null : cycle,
      });
      setPendingPlan(null);
      if (result.ok) {
        toast.success(
          plan === "free"
            ? "Switched to the Free plan."
            : `Switched to ${plan[0].toUpperCase() + plan.slice(1)} (${cycle}).`,
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-bold text-brand-ink">
          Switch plan
        </h2>
        <div
          role="tablist"
          aria-label="Billing cycle"
          className="inline-flex items-center rounded-pill border border-brand-line bg-white p-1 text-xs font-medium"
        >
          <button
            type="button"
            role="tab"
            aria-selected={cycle === "monthly"}
            onClick={() => setCycle("monthly")}
            className={`rounded-pill px-3 py-1.5 transition-colors ${
              cycle === "monthly"
                ? "bg-brand-primary text-white shadow-sm"
                : "text-brand-mute hover:text-brand-ink"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={cycle === "annual"}
            onClick={() => setCycle("annual")}
            className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 transition-colors ${
              cycle === "annual"
                ? "bg-brand-primary text-white shadow-sm"
                : "text-brand-mute hover:text-brand-ink"
            }`}
          >
            Annual
            <span
              className={`rounded-pill px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                cycle === "annual"
                  ? "bg-white/20 text-white"
                  : "bg-brand-accent text-brand-primary"
              }`}
            >
              Save 17%
            </span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent =
            plan.key === currentPlan &&
            (plan.key === "free" || cycle === currentCycle);
          const showMonthly =
            cycle === "monthly" ? plan.monthly : Math.round(plan.annual / 12);
          const showAnnual = plan.annual;
          const submitting = pendingPlan === plan.key && pending;

          return (
            <div
              key={plan.key}
              className={`relative flex flex-col rounded-card border bg-white p-5 shadow-card transition-shadow ${
                plan.recommended
                  ? "border-brand-primary ring-1 ring-brand-primary/30"
                  : "border-brand-line"
              }`}
            >
              {plan.recommended ? (
                <span className="absolute -top-2 right-4 inline-flex items-center gap-1 rounded-pill bg-brand-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm">
                  <Sparkles className="h-3 w-3" />
                  Popular
                </span>
              ) : null}

              <div className="font-display text-base font-semibold text-brand-ink">
                {plan.name}
              </div>
              <p className="mt-1 text-[12.5px] text-brand-mute">
                {plan.tagline}
              </p>

              <div className="mt-4">
                {plan.key === "free" ? (
                  <div className="font-display text-2xl font-bold text-brand-ink">
                    Free
                  </div>
                ) : (
                  <>
                    <div className="font-display text-2xl font-bold text-brand-ink">
                      {formatZar(showMonthly)}
                      <span className="text-sm font-medium text-brand-mute">
                        {" "}
                        / month
                      </span>
                    </div>
                    {cycle === "annual" ? (
                      <div className="text-[11px] text-brand-mute">
                        Billed yearly: {formatZar(showAnnual)}
                      </div>
                    ) : (
                      <div className="text-[11px] text-brand-mute">
                        Or annual: {formatZar(showAnnual)} / year
                      </div>
                    )}
                  </>
                )}
              </div>

              <ul className="mt-4 space-y-2 text-[13px] text-brand-dark">
                {plan.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                    <span>{b.replace("Vilo", brandName)}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => switchTo(plan.key)}
                disabled={isCurrent || pending}
                className={`mt-5 inline-flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  plan.recommended
                    ? "bg-brand-primary text-white hover:bg-brand-secondary"
                    : "border border-brand-line bg-white text-brand-ink hover:bg-brand-light"
                }`}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {isCurrent
                  ? "Current plan"
                  : plan.key === "free"
                    ? "Downgrade to Free"
                    : currentPlan === "free"
                      ? `Start ${plan.name} trial`
                      : `Switch to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-[12px] text-brand-mute">
        Switching is instant. Paid plans get a 14-day trial when you upgrade
        from Free. Real card billing connects when the Paystack and PayPal
        webhooks go live — until then your plan record is the source of truth
        for feature gates.
      </p>
    </section>
  );
}
