import { cache } from "react";

import { createServerClient } from "@/lib/supabase/server";

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
/**
 * PRE-MVP: the website CMS family is OPEN to every host regardless of plan, so
 * the founder can smoke-test multi-user signup/create/publish without buying a
 * subscription. This short-circuits every `website_*` gate (sidebar visibility,
 * the portfolio page, both editor layouts, all website server actions, listing
 * visibility) to `true`. Re-gate later via products/permissions in admin —
 * delete this block to restore plan-based gating. See CLAUDE.md "Feature
 * Permissions" pre-MVP policy / AGENT_RULES.md §3.4.
 */
const PRE_MVP_OPEN_FEATURES = new Set([
  "website_builder",
  "website_blog",
  "website_custom_domain",
  "looking_for_access",
]);

export const hostHasFeature = cache(async function hostHasFeature(
  hostId: string,
  featureKey: string,
): Promise<boolean> {
  if (PRE_MVP_OPEN_FEATURES.has(featureKey)) return true;
  const supabase = createServerClient();
  const { data } = await supabase.rpc("check_feature_permission", {
    p_host_id: hostId,
    p_feature_key: featureKey,
  });
  return (data as { is_enabled?: boolean } | null)?.is_enabled ?? false;
});
