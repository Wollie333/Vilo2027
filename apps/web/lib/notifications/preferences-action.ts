"use server";

import { revalidatePath } from "next/cache";

import { createServerClient } from "@/lib/supabase/server";

import { preferencesSchema, type PreferencesInput } from "./preferences-schema";

export type PreferencesResult = { ok: true } | { ok: false; error: string };

// Upserts both user_notification_preferences (one row per category) and
// user_notification_settings (single per-user row). Locked categories are
// filtered before the upsert so the UI can render them disabled without
// triggering a database write.

export async function savePreferencesAction(
  raw: PreferencesInput,
  revalidate: string[],
): Promise<PreferencesResult> {
  const parsed = preferencesSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const input = parsed.data;

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Look up locked categories so we don't waste an upsert on them.
  const { data: lockedRows } = await supabase
    .from("notification_categories")
    .select("id, is_locked")
    .eq("is_locked", true);
  const lockedIds = new Set((lockedRows ?? []).map((r) => r.id as string));

  const prefRows = input.categories
    .filter((c) => !lockedIds.has(c.category_id))
    .map((c) => ({
      user_id: user.id,
      category_id: c.category_id,
      email_enabled: c.email_enabled,
      push_enabled: c.push_enabled,
      in_app_enabled: c.in_app_enabled,
      digest_mode: c.digest_mode,
      updated_at: new Date().toISOString(),
    }));

  if (prefRows.length > 0) {
    const { error: prefError } = await supabase
      .from("user_notification_preferences")
      .upsert(prefRows, { onConflict: "user_id,category_id" });
    if (prefError) {
      return { ok: false, error: prefError.message };
    }
  }

  const { error: settingsError } = await supabase
    .from("user_notification_settings")
    .upsert(
      {
        user_id: user.id,
        quiet_hours_enabled: input.quiet_hours_enabled,
        quiet_hours_start: input.quiet_hours_enabled
          ? input.quiet_hours_start
          : null,
        quiet_hours_end: input.quiet_hours_enabled
          ? input.quiet_hours_end
          : null,
        quiet_hours_timezone: input.quiet_hours_timezone,
        dedupe_enabled: input.dedupe_enabled,
        digest_send_hour: input.digest_send_hour,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (settingsError) {
    return { ok: false, error: settingsError.message };
  }

  for (const path of revalidate) revalidatePath(path);
  return { ok: true };
}
