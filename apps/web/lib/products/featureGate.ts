import { cache } from "react";

import { createServerClient } from "@/lib/supabase/server";

/**
 * Pre-MVP master switch: when true, every feature gate resolves open so the
 * whole system ships as the MVP and the founder can smoke-test everything
 * (AGENT_RULES.md §3.4). Flip to false to re-enable per-product entitlement
 * (check_feature_permission) before Phase 3 / paid tiers.
 */
export const PRE_MVP_FEATURES_OPEN = true;

/**
 * SSOT action-layer feature gate. Resolves whether a host is entitled to a
 * feature via the canonical `check_feature_permission` RPC (host override →
 * active/trialing product → active/trialing plan → default `false`).
 *
 * Defaults to deny (`false`) on any miss or error, so a host with no active
 * subscription is locked out — the gate is fail-closed by design. Server-only.
 *
 * Wrapped in React `cache()` so repeated checks for the same (host, feature)
 * within one request are deduped — the dashboard layout calls this on every
 * navigation just to decide sidebar visibility, and this keeps it to one RPC.
 */
export const hostHasFeature = cache(async function hostHasFeature(
  hostId: string,
  featureKey: string,
): Promise<boolean> {
  // Pre-MVP: every feature is open so the founder can smoke-test and the whole
  // system ships as the MVP (AGENT_RULES.md §3.4). The check_feature_permission
  // wiring below stays in place; restore it before Phase 3 (paid tiers).
  if (PRE_MVP_FEATURES_OPEN) return true;

  const supabase = createServerClient();
  const { data } = await supabase.rpc("check_feature_permission", {
    p_host_id: hostId,
    p_feature_key: featureKey,
  });
  return (data as { is_enabled?: boolean } | null)?.is_enabled ?? false;
});
