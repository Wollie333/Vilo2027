import "server-only";

import { createServerClient } from "@/lib/supabase/server";

import { AdminAccessDenied, AdminMfaRequired } from "./errors";

export type AdminContext = {
  userId: string;
  email: string;
  roleId: string;
  isActive: boolean;
};

/**
 * Server-side gate. Resolves to the caller's admin context or throws:
 *   - AdminAccessDenied — not signed in, or no active platform_staff row
 *   - AdminMfaRequired  — signed in + staff, but session is not AAL2
 *
 * Call this at the top of every server component or server action that lives
 * under /admin. Use requirePermission() for fine-grained capability checks.
 */
export async function requireAdmin(): Promise<AdminContext> {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AdminAccessDenied("Not signed in.");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const aal =
    (session?.user.app_metadata as { aal?: string } | undefined)?.aal ??
    (session?.access_token ? extractAal(session.access_token) : null);

  const { data: staff, error } = await supabase
    .from("platform_staff")
    .select("user_id, role_id, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new AdminAccessDenied("Failed to load admin context.");
  if (!staff || !staff.is_active) {
    throw new AdminAccessDenied("Not a platform staff member.");
  }

  if (aal !== "aal2") throw new AdminMfaRequired();

  return {
    userId: user.id,
    email: user.email ?? "",
    roleId: staff.role_id,
    isActive: staff.is_active,
  };
}

/**
 * Pull the AAL claim out of a JWT without verifying — middleware/auth has
 * already verified it. Returns null on parse failure.
 */
function extractAal(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
    const json = JSON.parse(
      Buffer.from(padded, "base64").toString("utf-8"),
    ) as { aal?: string };
    return json.aal ?? null;
  } catch {
    return null;
  }
}
