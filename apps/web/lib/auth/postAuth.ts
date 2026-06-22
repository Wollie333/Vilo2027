import { safeNextPath } from "@/lib/auth/safeNext";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolves the destination after a successful sign-in (or OTP verify).
 *
 * Order:
 *   1. Honour `next` if it's a relative path (open-redirect guard).
 *   2. Active platform_staff  → /admin
 *   3. Non-deleted host row   → /dashboard
 *   4. Everyone else          → /portal
 *
 * Uses the service-role client because the user-bound cookie/session may
 * not be fully applied in time for an RLS-gated SELECT in the same Server
 * Action tick (this was the original reason for the admin client here).
 */
export async function resolvePostAuthDestination(
  userId: string | null,
  next?: string | null,
): Promise<string> {
  const safeNext = safeNextPath(next);
  if (safeNext) return safeNext;

  if (!userId) return "/portal";

  const service = createAdminClient();
  const [{ data: staff }, { data: host }] = await Promise.all([
    service
      .from("platform_staff")
      .select("user_id, is_active")
      .eq("user_id", userId)
      .maybeSingle(),
    service
      .from("hosts")
      .select("id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (staff?.is_active) return "/admin";
  if (host) return "/dashboard";
  return "/portal";
}
