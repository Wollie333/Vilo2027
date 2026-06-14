import "server-only";

import { unstable_cache } from "next/cache";

import type { PlanDef } from "@/app/[locale]/dashboard/settings/subscription/plans";
import { createAdminClient } from "@/lib/supabase/admin";

// Single source of truth for the plan catalog (names, prices, trials, bullets).
// Reads the DB `plans` + `plan_prices` tables. Uses the service-role admin
// client (no request cookies) so it is safe to wrap in unstable_cache. Pricing
// is admin-editable in /admin/subscriptions/plans — call revalidateTag("plans")
// after any edit.

export const PLANS_CACHE_TAG = "plans";

function toBullets(raw: unknown): string[] {
  if (Array.isArray(raw))
    return raw.filter((b): b is string => typeof b === "string");
  return [];
}

async function loadPlans(includeInactive: boolean): Promise<PlanDef[]> {
  const db = createAdminClient();
  const [{ data: plans }, { data: prices }] = await Promise.all([
    db.from("plans").select("*").order("sort_order", { ascending: true }),
    db
      .from("plan_prices")
      .select("plan, billing_cycle, price, currency, is_active"),
  ]);

  const priceFor = (plan: string, cycle: "monthly" | "annual"): number => {
    const row = (prices ?? []).find(
      (p) => p.plan === plan && p.billing_cycle === cycle && p.is_active,
    );
    return row ? Number(row.price) : 0;
  };

  return (plans ?? [])
    .filter((p) => includeInactive || p.is_active)
    .map((p) => ({
      key: p.key,
      name: p.name,
      tagline: p.tagline ?? "",
      description: p.description ?? null,
      monthly: priceFor(p.key, "monthly"),
      annual: priceFor(p.key, "annual"),
      currency: p.currency,
      trialDays: p.trial_days,
      isFree: p.is_free,
      isActive: p.is_active,
      bullets: toBullets(p.bullets),
      recommended: p.is_recommended,
      sortOrder: p.sort_order,
    }));
}

// Active plans only — cached; for host-facing surfaces (subscription page,
// signup, plan picker).
export const getPlans = unstable_cache(
  () => loadPlans(false),
  ["plans-active"],
  {
    tags: [PLANS_CACHE_TAG],
  },
);

// Every plan incl. inactive — uncached; for the admin editor.
export function getAllPlans(): Promise<PlanDef[]> {
  return loadPlans(true);
}

// Resolve a single plan by key (incl. inactive, so a host on a retired plan
// still sees its name). Not cached — cheap single lookup.
export async function getPlan(
  key: string | null | undefined,
): Promise<PlanDef | null> {
  if (!key) return null;
  const all = await loadPlans(true);
  return all.find((p) => p.key === key) ?? null;
}
