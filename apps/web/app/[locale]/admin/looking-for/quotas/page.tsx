import { Settings } from "lucide-react";

import { requirePermission } from "@/lib/admin";
import { getAllPlans } from "@/lib/plans/getPlans";
import { createAdminClient } from "@/lib/supabase/admin";

import { QuotaForm } from "./QuotaForm";

export const dynamic = "force-dynamic";

export default async function LookingForQuotasPage() {
  await requirePermission("platform.features");
  const service = createAdminClient();

  const [plans, { data: quotas }] = await Promise.all([
    getAllPlans(),
    service.from("looking_for_quotas").select("*"),
  ]);

  // Build a map of plan_id -> quota settings
  const quotaByPlan = new Map<
    string,
    {
      guest_posts_per_day: number | null;
      guest_posts_per_month: number | null;
      host_quotes_per_day: number | null;
      host_quotes_per_month: number | null;
    }
  >();

  for (const q of quotas ?? []) {
    quotaByPlan.set(q.plan_id, {
      guest_posts_per_day: q.guest_posts_per_day,
      guest_posts_per_month: q.guest_posts_per_month,
      host_quotes_per_day: q.host_quotes_per_day,
      host_quotes_per_month: q.host_quotes_per_month,
    });
  }

  // Default quotas for plans without explicit settings
  const defaultQuota = {
    guest_posts_per_day: null,
    guest_posts_per_month: null,
    host_quotes_per_day: null,
    host_quotes_per_month: null,
  };

  const planQuotas = plans.map((plan) => ({
    plan_id: plan.key,
    plan_name: plan.name,
    ...defaultQuota,
    ...quotaByPlan.get(plan.key),
  }));

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Looking For Quotas
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Configure daily and monthly limits for guest posts and host quotes
            per subscription plan. Blank values mean unlimited.
          </p>
        </div>
      </header>

      <div className="rounded-card border border-brand-line bg-white">
        <div className="border-b border-brand-line px-6 py-4">
          <h2 className="font-display font-semibold text-brand-ink">
            Quota Limits by Plan
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-line bg-brand-light">
                <th className="px-6 py-3 text-left font-medium text-brand-mute">
                  Plan
                </th>
                <th className="px-6 py-3 text-left font-medium text-brand-mute">
                  Guest Posts / Day
                </th>
                <th className="px-6 py-3 text-left font-medium text-brand-mute">
                  Guest Posts / Month
                </th>
                <th className="px-6 py-3 text-left font-medium text-brand-mute">
                  Host Quotes / Day
                </th>
                <th className="px-6 py-3 text-left font-medium text-brand-mute">
                  Host Quotes / Month
                </th>
                <th className="px-6 py-3 text-right font-medium text-brand-mute">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {planQuotas.map((pq) => (
                <QuotaForm key={pq.plan_id} quota={pq} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-card border border-dashed border-brand-line bg-brand-light p-4">
        <p className="text-sm text-brand-mute">
          <strong>Note:</strong> Changes take effect immediately. Quota checks
          use the <code>check_guest_post_quota</code> and{" "}
          <code>check_host_quote_quota</code> RPCs which read from this table.
        </p>
      </div>
    </div>
  );
}
