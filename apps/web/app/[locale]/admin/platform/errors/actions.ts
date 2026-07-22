"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Mark an error as dealt with. Not a delete — the row stays, and a fresh
 * occurrence clears resolved_at again (see record_error_event), so "fixed" that
 * turns out not to be fixed reappears by itself rather than staying hidden.
 *
 * Gated on `platform.settings` (ops + super_admin) to match the page. It used to
 * take only `requireAdmin()`, so ANY active staff member of ANY role could
 * resolve platform error events — an `is_active`-only capability check, which
 * AGENT_RULES.md §6.4 forbids.
 */
export async function resolveErrorAction(id: string): Promise<ActionResult> {
  await requirePermission("platform.settings");
  const service = createAdminClient();

  // RETURNING, not a bare update: an update that matches zero rows is not an
  // error in Postgres and PostgREST answers 200/204 for it (RULES.md §8.1), so
  // without this a stale id would report success and resolve nothing.
  const { data, error } = await service
    .from("error_events")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, error: "Could not resolve that error." };
  if (!data || data.length === 0) {
    return { ok: false, error: "That error no longer exists." };
  }

  revalidatePath("/admin/platform/errors");
  return { ok: true };
}
