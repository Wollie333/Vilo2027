import { createServerClient } from "@/lib/supabase/server";

/**
 * SSOT action-layer feature gate. Resolves whether a host is entitled to a
 * feature via the canonical `check_feature_permission` RPC (host override →
 * active/trialing product → active/trialing plan → default `false`).
 *
 * Defaults to deny (`false`) on any miss or error, so a host with no active
 * subscription is locked out — the gate is fail-closed by design. Server-only.
 */
export async function hostHasFeature(
  hostId: string,
  featureKey: string,
): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase.rpc("check_feature_permission", {
    p_host_id: hostId,
    p_feature_key: featureKey,
  });
  return (data as { is_enabled?: boolean } | null)?.is_enabled ?? false;
}
