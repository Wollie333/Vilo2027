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
