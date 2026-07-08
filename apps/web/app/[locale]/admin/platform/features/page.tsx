import { ShieldCheck } from "lucide-react";

import { requirePermission } from "@/lib/admin";
import {
  CANONICAL_GUEST_PERMISSIONS,
  getGuestPermissions,
} from "@/lib/guests/permissions";
import { getAllPlans } from "@/lib/plans/getPlans";
import { createAdminClient } from "@/lib/supabase/admin";

import { AudienceTabs } from "./AudienceTabs";
import {
  FeatureMatrix,
  type CellState,
  type MatrixFeature,
  type MatrixPlan,
} from "./FeatureMatrix";
import { GuestPermissionsForm } from "./GuestPermissionsForm";
import { HostOverrideForm } from "./HostOverrideForm";

export const dynamic = "force-dynamic";

export default async function FeatureFlagsPage() {
  await requirePermission("platform.features");
  const service = createAdminClient();

  const [plansRaw, { data: featureRows }, guestPerms] = await Promise.all([
    getAllPlans(),
    service
      .from("plan_features")
      .select("plan, feature_key, is_enabled, limit_value, description"),
    getGuestPermissions(),
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

  const hostView = (
    <div className="space-y-6">
      <div className="flex items-start gap-2.5 rounded-card border border-brand-line bg-[#F6FAF7] px-4 py-3 text-[13px] text-brand-dark">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
        <div>
          <span className="font-semibold">Gates are enforced.</span> Host access
          is resolved live: host override → the host&apos;s product features
          (Products → features) → this plan matrix as a fallback → deny. Edit a
          cell to grant/revoke; set a number on a{" "}
          <span className="font-mono">_limit</span>/
          <span className="font-mono">_seats</span> feature to cap it (blank =
          unlimited).
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

  const guestView = (
    <GuestPermissionsForm
      catalog={CANONICAL_GUEST_PERMISSIONS}
      initial={guestPerms}
    />
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Feature permissions
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Control what each audience can do. <strong>Hosts</strong> unlock
          features by plan/product; <strong>Guests</strong> share one global
          permission set. Changes save instantly and gates read this live.
        </p>
      </header>

      <AudienceTabs host={hostView} guest={guestView} />
    </div>
  );
}
