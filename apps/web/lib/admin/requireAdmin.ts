import "server-only";

import { createServerClient } from "@/lib/supabase/server";

import { AdminAccessDenied } from "./errors";

export type AdminContext = {
  userId: string;
  email: string;
  roleId: string;
  isActive: boolean;
};

/**
 * Server-side gate. Resolves to the caller's admin context or throws
 * AdminAccessDenied if the caller is not signed in or has no active
 * platform_staff row.
 *
 * Pre-MVP: AAL2 (MFA) is NOT required — /account/mfa-enrol was never built,
 * so the MFA gate would 404 the admin panel for every staff member. Restore
 * the AAL2 check (and re-import AdminMfaRequired) before production launch,
 * paired with the equivalent revert of migration 20260525000009.
 */
export async function requireAdmin(): Promise<AdminContext> {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AdminAccessDenied("Not signed in.");

  const { data: staff, error } = await supabase
    .from("platform_staff")
    .select("user_id, role_id, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new AdminAccessDenied("Failed to load admin context.");
  if (!staff || !staff.is_active) {
    throw new AdminAccessDenied("Not a platform staff member.");
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    roleId: staff.role_id,
    isActive: staff.is_active,
  };
}
