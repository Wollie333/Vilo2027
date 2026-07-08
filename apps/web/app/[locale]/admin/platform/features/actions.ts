"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission, withAdminAudit } from "@/lib/admin";
import {
  CANONICAL_GUEST_PERMISSIONS,
  GUEST_PERMISSION_SETTING_KEY,
} from "@/lib/guests/permissions";

// plan_features has no per-row meaning to the audit target_id (uuid) — like the
// platform-settings actions we use a stable sentinel uuid and carry the real
// (plan, feature_key) in payload.args.
const FEATURE_MATRIX_TARGET = "00000000-0000-0000-0000-00000000fea7";

const upsertSchema = z.object({
  plan: z.string().min(1).max(60),
  featureKey: z.string().min(1).max(80),
  isEnabled: z.boolean(),
  // null = unlimited (or N/A for boolean features).
  limitValue: z.number().int().min(0).nullable(),
  description: z.string().max(200).optional().nullable(),
  reason: z.string().optional(),
});

// Set a single (plan × feature) cell in the permission matrix. Super-admin only,
// audited. Gates read plan_features live, so the change takes effect immediately
// (subject to the pre-MVP open-on-free short-circuit — see AGENT_RULES §3.4).
export const upsertPlanFeatureAction = withAdminAudit<
  z.infer<typeof upsertSchema>,
  { ok: true }
>(
  {
    permissionKey: "platform.features",
    actionName: "platform.features.upsert",
    targetType: "plan_feature",
    getTargetId: () => FEATURE_MATRIX_TARGET,
  },
  async (args, service) => {
    const parsed = upsertSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const { plan, featureKey, isEnabled, limitValue, description } =
      parsed.data;

    const { data, error } = await service
      .from("plan_features")
      .upsert(
        {
          plan,
          feature_key: featureKey,
          is_enabled: isEnabled,
          limit_value: limitValue,
          ...(description != null ? { description } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "plan,feature_key" },
      )
      .select("plan, feature_key, is_enabled, limit_value")
      .single();
    if (error) throw new Error(error.message);

    revalidatePath("/admin/platform/features");
    return { result: { ok: true }, after: data };
  },
);

// ─── Global guest permissions ──────────────────────────────────
// Guests have no plan/product, so their capabilities are one GLOBAL set stored
// in platform_settings (key `guest_permissions`, jsonb { [key]: boolean }). The
// gate (lib/guests/permissions.ts) reads it live; missing key = allowed.
const GUEST_PERMS_TARGET = "00000000-0000-0000-0000-0000006e5700";

const guestPermsSchema = z.object({
  permissions: z.record(z.string(), z.boolean()),
  reason: z.string().optional(),
});

export const saveGuestPermissionsAction = withAdminAudit<
  z.infer<typeof guestPermsSchema>,
  { ok: true }
>(
  {
    permissionKey: "platform.features",
    actionName: "platform.features.guest_permissions",
    targetType: "platform_setting",
    getTargetId: () => GUEST_PERMS_TARGET,
  },
  async (args, service) => {
    const parsed = guestPermsSchema.safeParse(args);
    if (!parsed.success) throw new Error("Invalid input.");
    // Persist only known catalog keys, coerced to booleans.
    const known = new Set(CANONICAL_GUEST_PERMISSIONS.map((p) => p.key));
    const value: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(parsed.data.permissions)) {
      if (known.has(k)) value[k] = Boolean(v);
    }
    const { error } = await service
      .from("platform_settings")
      .upsert(
        { key: GUEST_PERMISSION_SETTING_KEY, value },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    revalidatePath("/admin/platform/features");
    return { result: { ok: true }, after: { keys: Object.keys(value).length } };
  },
);

export async function saveGuestPermissions(
  permissions: Record<string, boolean>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await saveGuestPermissionsAction({ permissions });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

// ─── Per-host feature override ─────────────────────────────────
const overrideSchema = z.object({
  hostEmail: z.string().trim().toLowerCase().email("Enter a valid email."),
  featureKey: z.string().min(1).max(80),
  isEnabled: z.boolean(),
  limitValue: z.number().int().min(0).nullable(),
  // ISO date (yyyy-mm-dd) or null for a permanent override.
  expiresAt: z.string().nullable().optional(),
  reason: z.string().min(5, "A reason is required (min 5 chars)."),
});

// Grant/revoke a single feature for ONE host, outside their plan. Reason
// required; written to host_feature_overrides (checked first by
// check_feature_permission). Super-admin only, audited.
export const createHostOverrideAction = withAdminAudit<
  z.infer<typeof overrideSchema>,
  { ok: true }
>(
  {
    permissionKey: "platform.features",
    actionName: "platform.features.host_override",
    targetType: "feature_override",
    getTargetId: () => FEATURE_MATRIX_TARGET,
    requireReason: true,
  },
  async (args, service) => {
    const parsed = overrideSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
    }
    const { hostEmail, featureKey, isEnabled, limitValue, expiresAt, reason } =
      parsed.data;

    // Resolve the host from the email (user_profiles → hosts).
    const { data: profile } = await service
      .from("user_profiles")
      .select("id")
      .ilike("email", hostEmail)
      .maybeSingle();
    if (!profile) throw new Error("No user found with that email.");
    const { data: host } = await service
      .from("hosts")
      .select("id")
      .eq("user_id", profile.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!host) throw new Error("That user is not a host.");

    const admin = await requirePermission("platform.features");

    const { data, error } = await service
      .from("host_feature_overrides")
      .upsert(
        {
          host_id: host.id,
          feature_key: featureKey,
          is_enabled: isEnabled,
          limit_value: limitValue,
          reason,
          overridden_by: admin.userId,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        },
        { onConflict: "host_id,feature_key" },
      )
      .select("id, host_id, feature_key, is_enabled, limit_value, expires_at")
      .single();
    if (error) throw new Error(error.message);

    revalidatePath("/admin/platform/features");
    return { result: { ok: true }, after: data };
  },
);
