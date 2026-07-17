import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

import { createServerClient } from "@/lib/supabase/server";

/**
 * Master feature-gate switch.
 *
 * ENFORCING (false, 2026-07-17): access gates resolve through the real
 * entitlement chain (host override → active/trialing product → plan → default
 * false). Hosts are provisioned via the "Beta" product, which opens every host
 * feature EXCEPT the website builder (shipping later). A host with no active
 * subscription is gated out — that is the intended enforcement.
 *
 * Set back to true only to temporarily re-open everything for broad smoke-testing
 * (AGENT_RULES.md §3.4).
 */
export const PRE_MVP_FEATURES_OPEN = false;

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

/** What `check_feature_permission` actually returns. */
type FeaturePermission = {
  is_enabled?: boolean;
  limit_value?: number | null;
  source?: string;
};

export type FeatureLimit = {
  /** Resolved cap. `null` = unlimited. `0` = none allowed. */
  limit: number | null;
  /** Which layer answered — 'override' | 'product' | 'plan' | 'default'. */
  source: string;
};

/**
 * Core limit resolution against an explicit client.
 *
 * Split out from `hostFeatureLimit` because the credit-grant path runs from
 * webhooks / settle paths / admin actions with a service-role client and NO user
 * session, where the cookie-based server client isn't usable.
 * `check_feature_permission` is SECURITY DEFINER, so any client resolves the same
 * answer.
 */
export async function resolveFeatureLimit(
  client: SupabaseClient,
  hostId: string,
  featureKey: string,
): Promise<FeatureLimit> {
  const { data, error } = await client.rpc("check_feature_permission", {
    p_host_id: hostId,
    p_feature_key: featureKey,
  });
  if (error) {
    // Fail closed, and say which layer we believe answered, so a caller that
    // logs this can tell a real 0 from an errored 0.
    return { limit: 0, source: "error" };
  }
  const perm = (data ?? null) as FeaturePermission | null;
  if (!perm?.is_enabled) return { limit: 0, source: perm?.source ?? "default" };
  return { limit: perm.limit_value ?? null, source: perm.source ?? "default" };
}

/**
 * SSOT reader for a host's NUMERIC allowance on a quantity feature (one with
 * `scope: "total"` / `"per_business"` in the canonical catalog).
 *
 * `check_feature_permission` has always resolved a `limit_value` alongside
 * `is_enabled`, with the same precedence (host override → active/trialing
 * product → active/trialing plan → default) — but `hostHasFeature` discards it,
 * so every admin-entered limit was write-only. This is the read path.
 *
 * Semantics:
 *   - feature disabled at the winning layer → `0` (entitled to none)
 *   - enabled with `limit_value = NULL`     → `null` (unlimited)
 *   - nothing configured anywhere           → `0` from the RPC's fail-closed
 *     default, so callers must decide their own fallback deliberately rather
 *     than silently inheriting "unlimited".
 *
 * Deliberately does NOT honour `PRE_MVP_FEATURES_OPEN`: that switch keeps
 * *access* open for smoke-testing, but a limit is a quantity, not an
 * entitlement, and the credit meter already enforces for real pre-MVP
 * (`spendQuoteCredit` blocks at 0 today). Short-circuiting to unlimited would
 * make the allowances untestable — see the plan doc.
 *
 * Server-only. `cache()`d per (host, feature) per request like `hostHasFeature`.
 */
export const hostFeatureLimit = cache(async function hostFeatureLimit(
  hostId: string,
  featureKey: string,
): Promise<FeatureLimit> {
  return resolveFeatureLimit(createServerClient(), hostId, featureKey);
});

/**
 * Enforce a "total"-scope account cap (e.g. `listings_limit`, `businesses_limit`)
 * before creating one more of something. Resolves the host's allowance via the
 * canonical RPC and compares it to how many they already have.
 *
 * `null` limit → unlimited (always ok). Fail-closed: a host with no entitlement
 * resolves to 0 and is blocked. The caller passes its own `currentCount` because
 * the "active" filter differs per table (properties use deleted_at; businesses
 * use is_archived).
 */
export async function assertWithinTotalCap(
  client: SupabaseClient,
  hostId: string,
  featureKey: string,
  currentCount: number,
  label: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { limit } = await resolveFeatureLimit(client, hostId, featureKey);
  if (limit === null) return { ok: true }; // unlimited
  if (currentCount >= limit) {
    return {
      ok: false,
      error:
        limit === 0
          ? `Your plan doesn’t include ${label}s. Upgrade to add one.`
          : `Your plan allows ${limit} ${label}${limit === 1 ? "" : "s"}. Upgrade to add more.`,
    };
  }
  return { ok: true };
}
