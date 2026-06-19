import { hostHasFeature } from "@/lib/products/featureGate";

/**
 * Canonical feature key for the Specials feature. Seeded `true` for every plan
 * in plan_features (migration 20260619002000) and listed in
 * CANONICAL_PRODUCT_FEATURES so the admin product editor can configure it.
 */
export const SPECIALS_FEATURE_KEY = "specials";

/**
 * Pre-MVP open-on-free flag (AGENT_RULES §3.4). While the platform has no real
 * users and no subscription management, hosts created via handle_new_user have
 * no subscriptions row, so the fail-closed check_feature_permission RPC would
 * lock everyone out. We keep the RPC wiring in place (below) but short-circuit
 * to `true` so the founder can smoke-test end-to-end.
 *
 * At MVP launch: set this to `false`. The action + UI gate then enforce per-plan
 * entitlement via the already-seeded plan_features rows — no other code change.
 */
const PRE_MVP_OPEN = true;

/**
 * SSOT entitlement check for Specials. Resolves whether a host may create /
 * manage specials. Used at both the Server Action layer (actions.ts) and the UI
 * layer (page.tsx) per AGENT_RULES §3.2 (gate at both layers). Server-only.
 */
export async function canUseSpecials(hostId: string): Promise<boolean> {
  if (PRE_MVP_OPEN) return true;
  return hostHasFeature(hostId, SPECIALS_FEATURE_KEY);
}
