import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

// How long a soft-deleted account is held (recoverable) before an admin may
// permanently purge it. Self-service deletion soft-deletes; after this window
// an admin can hard-delete every row. Nothing auto-purges — purge is a manual
// admin-only action.
export const DELETED_ACCOUNT_HOLD_DAYS = 30;

/** Whole days elapsed since a soft-delete timestamp (>= 0). */
export function daysSinceDeleted(deletedAt: string | null | undefined): number {
  if (!deletedAt) return 0;
  const ms = Date.now() - new Date(deletedAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** True once the 30-day hold has fully elapsed and a purge is permitted. */
export function isPurgeEligible(deletedAt: string | null | undefined): boolean {
  return daysSinceDeleted(deletedAt) >= DELETED_ACCOUNT_HOLD_DAYS;
}

// ─── Soft delete ──────────────────────────────────────────────────────
// Hide the account from the world + block sign-in, but RETAIN every row so the
// account is fully recoverable during the hold. No anonymisation here — PII is
// removed only at the manual hard purge. RLS + the ban keep the data hidden
// (public reads require deleted_at IS NULL; a banned auth user can't sign in).
export async function softDeleteUserAccount(
  admin: AdminClient,
  userId: string,
): Promise<void> {
  const now = new Date().toISOString();

  const { error: profErr } = await admin
    .from("user_profiles")
    .update({ is_active: false, deleted_at: now })
    .eq("id", userId);
  if (profErr) throw new Error(profErr.message);

  // Soft-delete the host row too (RLS/triggers key off deleted_at; listings
  // cascade off the host's deleted_at via the existing soft-delete triggers).
  await admin
    .from("hosts")
    .update({ deleted_at: now })
    .eq("user_id", userId)
    .is("deleted_at", null);

  // Block sign-in WITHOUT deleting the auth row (deleting it would cascade-purge
  // the profile + children). The ban is lifted on restore.
  await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
}

// ─── Restore (reinstate) ──────────────────────────────────────────────
// Reverse a soft delete: clear deleted_at, reactivate, un-hide the host, and
// lift the auth ban so the user can sign in again with their existing password.
export async function restoreUserAccount(
  admin: AdminClient,
  userId: string,
): Promise<void> {
  const { error: profErr } = await admin
    .from("user_profiles")
    .update({ is_active: true, deleted_at: null })
    .eq("id", userId);
  if (profErr) throw new Error(profErr.message);

  await admin.from("hosts").update({ deleted_at: null }).eq("user_id", userId);

  await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
}

// ─── Hard purge ───────────────────────────────────────────────────────
// Permanently remove every row the user owns (FK-safe via the transactional DB
// function) then delete the auth user. Irreversible. Callers must gate this on
// the 30-day hold + permissions — this helper only performs the deletion.
export async function hardPurgeUserAccount(
  admin: AdminClient,
  userId: string,
): Promise<void> {
  const { error: purgeErr } = await admin.rpc("app_purge_user_account", {
    p_user_id: userId,
  });
  if (purgeErr) throw new Error(purgeErr.message);

  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
  if (deleteErr) throw new Error(deleteErr.message);
}
