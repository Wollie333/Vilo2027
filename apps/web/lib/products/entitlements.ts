// Resolves a product's stored feature config into the EFFECTIVE allowances for a
// given account, applying the per-business scaling rule.
//
// product_features stores the raw, per-product values the admin sets:
//   - "total" features: the absolute cap as entered.
//   - "per_business" features: the cap PER business (typically 1).
//   - "toggle" features: is_enabled only.
//
// At enforcement time we multiply per-business caps by the account's business
// allowance, so Business=3 with payment_eft=1 yields 3 EFT configs without the
// admin re-entering anything. limit_value NULL = unlimited.

import { FEATURE_BY_KEY } from "./features";

export type RawFeature = {
  isEnabled: boolean;
  limitValue: number | null;
};

export type Entitlement = {
  key: string;
  enabled: boolean;
  /** Effective cap; null = unlimited; undefined = not a quantity feature. */
  limit: number | null | undefined;
};

/**
 * @param features    product_features keyed by feature_key.
 * @param businessCap how many businesses this product allows (the resolved
 *                    `businesses_limit`; defaults to 1 when unset/unlimited→1 for
 *                    scaling purposes is intentional — unlimited businesses with
 *                    1-per-business gateways stays unlimited, handled below).
 */
export function resolveEntitlements(
  features: Record<string, RawFeature>,
  businessCap: number | null,
): Record<string, Entitlement> {
  const out: Record<string, Entitlement> = {};
  // For multiplying per-business caps: unlimited businesses → unlimited configs.
  const multiplier = businessCap == null ? null : Math.max(1, businessCap);

  for (const [key, raw] of Object.entries(features)) {
    const def = FEATURE_BY_KEY[key];
    const scope = def?.scope ?? "total";

    if (!raw.isEnabled) {
      out[key] = {
        key,
        enabled: false,
        limit: scope === "toggle" ? undefined : 0,
      };
      continue;
    }

    if (scope === "toggle") {
      out[key] = { key, enabled: true, limit: undefined };
    } else if (scope === "per_business") {
      // 1-per-business × businesses → scales; unlimited businesses → unlimited.
      const per = raw.limitValue; // NULL = unlimited per business
      const limit = per == null || multiplier == null ? null : per * multiplier;
      out[key] = { key, enabled: true, limit };
    } else {
      // total
      out[key] = { key, enabled: true, limit: raw.limitValue };
    }
  }
  return out;
}

/** Convenience: the businesses_limit value from a raw feature map. */
export function businessCapOf(
  features: Record<string, RawFeature>,
): number | null {
  const b = features["businesses_limit"];
  if (!b || !b.isEnabled) return 1;
  return b.limitValue; // null = unlimited
}
