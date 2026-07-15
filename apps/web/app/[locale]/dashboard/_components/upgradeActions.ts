"use server";

import { revalidatePath } from "next/cache";

import { notifyAdmins } from "@/lib/admin/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export type UpgradeResult = { ok: true } | { ok: false; error: string };

// Self-serve upgrade: a quotes-only account becomes a FULL host account. Flips
// hosts.account_kind 'quote_only' → 'host' so the account leaves the scoped
// quotes-only shell and gets the full host dashboard. Their Looking-For quotes +
// Wielo Credits are untouched. Paid host features stay behind a host plan the
// user subscribes to afterward — this only changes the account CLASS, like the
// admin "Make full host" control, but initiated by the user.
//
// It deliberately does NOT touch platform_access: an admin who blocked the
// account (platform_access=false) keeps it blocked — the account_kind flip alone
// won't self-lift an admin block (quotesOnly stays true via !platform_access).
export async function upgradeToFullHostAction(): Promise<UpgradeResult> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to upgrade." };

  const { data: host } = await supabase
    .from("hosts")
    .select("id, account_kind, display_name")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!host) return { ok: false, error: "No account to upgrade." };

  // Idempotent — already a full host.
  if (host.account_kind !== "quote_only") return { ok: true };

  // Service role: account_kind is an admin-controlled column, so the owner's
  // RLS-bound client can't flip it. We already verified the caller owns this host.
  const admin = createAdminClient();
  const { error } = await admin
    .from("hosts")
    .update({
      account_kind: "host",
      updated_at: new Date().toISOString(),
    })
    .eq("id", host.id)
    .eq("account_kind", "quote_only");
  if (error) {
    return { ok: false, error: "Could not upgrade your account. Try again." };
  }

  // Let admins see conversions in the platform feed (best-effort).
  try {
    await notifyAdmins(admin, {
      category: "support",
      kind: "account_upgraded",
      title: "Quote-only account upgraded to full host",
      body: `${host.display_name ?? user.email ?? "An account"} upgraded to a full host account.`,
      userId: user.id,
      hostId: host.id,
      href: `/admin/users/${user.id}`,
    });
  } catch {
    // non-fatal
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
