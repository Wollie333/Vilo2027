"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Mark an error as dealt with. Not a delete — the row stays, and a fresh
 * occurrence clears resolved_at again (see record_error_event), so "fixed" that
 * turns out not to be fixed reappears by itself rather than staying hidden.
 */
export async function resolveErrorAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const service = createAdminClient();
  const { error } = await service
    .from("error_events")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "Could not resolve that error." };
  revalidatePath("/admin/platform/errors");
  return { ok: true };
}
