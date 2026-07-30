"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/admin/requirePermission";
import { isRegisteredEvent } from "@/lib/notifications/registry";
import { createAdminClient } from "@/lib/supabase/admin";

// Server actions for the Communications hub message-override layer. Gated by
// notifications.broadcast (the platform-comms permission). Every write targets
// notification_overrides (one row per event kind).

type Result = { ok: true } | { ok: false; error: string };

const saveSchema = z.object({
  kind: z.string().min(1),
  masterEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
  // Empty string clears the override (back to the code default copy).
  subjectOverride: z.string().trim().max(200),
  introOverride: z.string().trim().max(2000),
});

export type SaveOverrideInput = z.infer<typeof saveSchema>;

export async function saveMessageOverrideAction(
  input: SaveOverrideInput,
): Promise<Result> {
  const ctx = await requirePermission("notifications.broadcast");

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const v = parsed.data;
  if (!isRegisteredEvent(v.kind)) {
    return { ok: false, error: `Unknown message: ${v.kind}` };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("notification_overrides").upsert(
    {
      event_kind: v.kind,
      master_enabled: v.masterEnabled,
      email_enabled: v.emailEnabled,
      push_enabled: v.pushEnabled,
      in_app_enabled: v.inAppEnabled,
      subject_override: v.subjectOverride.length ? v.subjectOverride : null,
      intro_override: v.introOverride.length ? v.introOverride : null,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_kind" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/communications");
  return { ok: true };
}

/** Delete the override row → back to all-on with code-default copy. */
export async function resetMessageOverrideAction(
  kind: string,
): Promise<Result> {
  await requirePermission("notifications.broadcast");
  if (!isRegisteredEvent(kind)) {
    return { ok: false, error: `Unknown message: ${kind}` };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("notification_overrides")
    .delete()
    .eq("event_kind", kind);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/communications");
  return { ok: true };
}

/** Toggle just the master switch inline (row list) without opening the drawer. */
export async function toggleMasterAction(
  kind: string,
  enabled: boolean,
): Promise<Result> {
  const ctx = await requirePermission("notifications.broadcast");
  if (!isRegisteredEvent(kind)) {
    return { ok: false, error: `Unknown message: ${kind}` };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("notification_overrides").upsert(
    {
      event_kind: kind,
      master_enabled: enabled,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_kind" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/communications");
  return { ok: true };
}
