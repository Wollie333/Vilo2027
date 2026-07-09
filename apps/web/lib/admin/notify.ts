import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type AdminNotifyInput = {
  category: "finance" | "support";
  // Machine kind, e.g. eft_pending | payment_initiated | payment_received |
  // support_request | cancellation_request | subscription_paused.
  kind: string;
  title: string;
  body?: string | null;
  userId?: string | null;
  hostId?: string | null;
  ledgerId?: string | null;
  orderId?: string | null;
  href?: string | null;
};

// Record a staff-facing transactional notification (the admin "Latest actions"
// feed). BEST-EFFORT — a notification failure must never break the money or
// support path that triggered it.
export async function notifyAdmins(
  admin: Admin,
  input: AdminNotifyInput,
): Promise<void> {
  try {
    await admin.from("admin_notifications").insert({
      category: input.category,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      user_id: input.userId ?? null,
      host_id: input.hostId ?? null,
      ledger_id: input.ledgerId ?? null,
      order_id: input.orderId ?? null,
      href: input.href ?? null,
    });
  } catch {
    // Never surface a notification failure to the caller.
  }
}
