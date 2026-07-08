import { hostHasFeature } from "@/lib/products/featureGate";

/**
 * Canonical feature key for the Specials feature. Seeded `true` for every plan
 * in plan_features (migration 20260619002000) and listed in
 * CANONICAL_PRODUCT_FEATURES so the admin product editor can configure it.
 */
export const SPECIALS_FEATURE_KEY = "specials";

/**
 * SSOT entitlement check for Specials. Resolves whether a host may create /
 * manage specials via the canonical product-feature gate (the admin assigns the
 * `specials` feature per product). Used at both the Server Action layer
 * (actions.ts) and the UI layer (page.tsx) per AGENT_RULES §3.2. Server-only.
 */
export async function canUseSpecials(hostId: string): Promise<boolean> {
  return hostHasFeature(hostId, SPECIALS_FEATURE_KEY);
}
