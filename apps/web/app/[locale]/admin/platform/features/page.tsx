import { AlertTriangle } from "lucide-react";

import { requirePermission } from "@/lib/admin";
import { getAllPlans } from "@/lib/plans/getPlans";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  FeatureMatrix,
  type CellState,
  type MatrixFeature,
  type MatrixPlan,
} from "./FeatureMatrix";
import { HostOverrideForm } from "./HostOverrideForm";

export const dynamic = "force-dynamic";

export default async function FeatureFlagsPage() {
  await requirePermission("platform.features");
  const service = createAdminClient();

  const [plansRaw, { data: featureRows }] = await Promise.all([
    getAllPlans(),
    service
      .from("plan_features")
      .select("plan, feature_key, is_enabled, limit_value, description"),
  ]);

  const plans: MatrixPlan[] = plansRaw.map((p) => ({
    key: p.key,
    name: p.name,
  }));

  // Distinct feature keys (alpha) with the best available description.
  const descByKey = new Map<string, string>();
  for (const row of featureRows ?? []) {
    if (row.description && !descByKey.get(row.feature_key)) {
      descByKey.set(row.feature_key, row.description);
    } else if (!descByKey.has(row.feature_key)) {
      descByKey.set(row.feature_key, "");
    }
  }
  const features: MatrixFeature[] = [...descByKey.keys()]
    .sort()
    .map((key) => ({ key, description: descByKey.get(key) ?? "" }));

  const cells: Record<string, CellState> = {};
  for (const row of featureRows ?? []) {
    cells[`${row.plan}:${row.feature_key}`] = {
      is_enabled: row.is_enabled,
      limit_value: row.limit_value,
    };
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Feature permissions
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Control exactly which features each plan unlocks. Toggle a cell to
          grant/revoke; set a number on a{" "}
          <span className="font-mono">_limit</span>/
          <span className="font-mono">_seats</span> feature to cap it (blank =
          unlimited). Changes save instantly and gates read this live.
        </p>
      </header>

      {/* Pre-MVP open-on-free banner (AGENT_RULES §3.4). */}
      <div className="flex items-start gap-2.5 rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <span className="font-semibold">Pre-MVP: gates are open.</span>{" "}
          Feature checks currently short-circuit to allow everyone through so
          the founder can smoke-test. Editing this matrix changes the stored
          permissions, but they won&apos;t be enforced until the open-on-free
          switch is flipped when live billing lands.
        </div>
      </div>

      <FeatureMatrix plans={plans} features={features} cells={cells} />

      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-bold text-brand-ink">
          Per-host override
        </h2>
        <p className="mb-4 mt-1 text-[13px] text-brand-mute">
          Grant or revoke a single feature for one host outside their plan (e.g.
          a courtesy upgrade or a trial). Checked before the plan default. A
          reason is recorded in the audit log.
        </p>
        <HostOverrideForm featureKeys={features.map((f) => f.key)} />
      </section>
    </div>
  );
}
