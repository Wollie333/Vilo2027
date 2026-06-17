import "server-only";

import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

type Db = ReturnType<typeof createServerClient>;

export type ListingHostCtx =
  | { ok: true; db: Db; hostId: string; userId: string; asAdmin: boolean }
  | { ok: false; error: string };

/**
 * Resolve who may manage resources that belong to a listing's host, from the
 * listing id alone:
 *   • the listing's owner  → the RLS-bound client (host self-service, unchanged);
 *   • active platform staff → the service-role client (so they can manage ANY
 *     host's add-ons / policies / assignments from the admin user record), plus
 *     an admin_audit_log row tagged with the owner's user id so it surfaces on
 *     that user's Activity tab.
 * Anyone else is refused. Mirrors the listing-editor ownership resolver so the
 * whole admin "edit this user's listing" surface shares one security model.
 */
export async function resolveListingHostContext(
  listingId: string,
  auditAction: string,
): Promise<ListingHostCtx> {
  const rls = createServerClient();
  const {
    data: { user },
  } = await rls.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("properties")
    .select("host_id, host:hosts!inner ( user_id )")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return { ok: false, error: "Listing not found." };

  const hostId = (listing as { host_id: string }).host_id;
  const ownerUserId = (listing as unknown as { host: { user_id: string } }).host
    .user_id;

  if (ownerUserId === user.id) {
    return { ok: true, db: rls, hostId, userId: user.id, asAdmin: false };
  }

  const { data: staff } = await rls
    .from("platform_staff")
    .select("is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!staff?.is_active) return { ok: false, error: "Not your listing." };

  try {
    const h = headers();
    await admin.from("admin_audit_log").insert({
      admin_id: user.id,
      action: auditAction,
      target_type: "listing",
      target_id: listingId,
      payload: { owner_user_id: ownerUserId },
      ip_address:
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        null,
      user_agent: h.get("user-agent"),
    });
  } catch {
    // Never let an audit failure block the edit.
  }

  return {
    ok: true,
    db: admin as unknown as Db,
    hostId,
    userId: user.id,
    asAdmin: true,
  };
}
