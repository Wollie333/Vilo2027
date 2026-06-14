// Plan types + pure formatting helpers.
//
// The plan CATALOG (names, prices, trials, bullets) now lives in the DB
// (`plans` + `plan_prices`) and is read via `@/lib/plans/getPlans`. This file
// only holds the shared shape + pure utils so both server and client code can
// agree on the type. Pricing is no longer hardcoded here — the super admin
// edits it in /admin/subscriptions/plans with no redeploy.

// A plan key is now an open string (the admin can create custom plan keys), not
// a fixed union. The four seeded keys are free/basic/pro/business.
export type PlanKey = string;

export type PlanDef = {
  key: PlanKey;
  name: string;
  tagline: string;
  description: string | null;
  monthly: number; // ZAR — resolved from plan_prices (monthly cycle)
  annual: number; // ZAR — resolved from plan_prices (annual cycle)
  currency: string;
  trialDays: number;
  isFree: boolean;
  isActive: boolean;
  bullets: string[];
  recommended: boolean;
  sortOrder: number;
};

export function findPlan(
  plans: ReadonlyArray<PlanDef>,
  key: string | null | undefined,
): PlanDef | null {
  if (!key) return null;
  return plans.find((p) => p.key === key) ?? null;
}

export function formatZar(amount: number): string {
  if (amount === 0) return "Free";
  return `R ${amount.toLocaleString("en-ZA").replace(/,/g, " ")}`;
}
