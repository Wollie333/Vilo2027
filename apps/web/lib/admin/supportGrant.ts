import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

// Resolve a host's CURRENT support-access grant (host-approved, not expired).
// While one exists the super admin may edit that host's financial data; without
// one, financial tabs are read-only.
export async function getActiveSupportGrant(
  admin: ReturnType<typeof createAdminClient>,
  hostId: string,
): Promise<{ id: string; expiresAt: string } | null> {
  const { data } = await admin
    .from("admin_support_grants")
    .select("id, expires_at")
    .eq("host_id", hostId)
    .eq("status", "approved")
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.expires_at ? { id: data.id, expiresAt: data.expires_at } : null;
}

// Guard for financial WRITE actions on a user's record: throws unless the host
// has approved an (unexpired) support-access grant. Editing a user's financial
// records requires their explicit, time-boxed consent — this is the server-side
// enforcement behind the read-only banner (never rely on the UI alone).
export async function assertActiveSupportGrant(
  admin: ReturnType<typeof createAdminClient>,
  hostId: string,
): Promise<void> {
  const grant = await getActiveSupportGrant(admin, hostId);
  if (!grant) {
    throw new Error(
      "This account's financial records are locked. Request support access and wait for the account owner to approve before making changes.",
    );
  }
}

// Latest grant of any status (for showing pending/declined state on the record).
export async function getLatestSupportGrant(
  admin: ReturnType<typeof createAdminClient>,
  hostId: string,
): Promise<{ id: string; status: string; expiresAt: string | null } | null> {
  const { data } = await admin
    .from("admin_support_grants")
    .select("id, status, expires_at")
    .eq("host_id", hostId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data
    ? { id: data.id, status: data.status, expiresAt: data.expires_at }
    : null;
}
