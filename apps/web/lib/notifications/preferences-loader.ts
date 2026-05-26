import "server-only";

import { createServerClient } from "@/lib/supabase/server";

import type { Role } from "./types";

export type EffectiveCategoryPref = {
  id: string;
  label: string;
  description: string;
  icon_name: string;
  is_locked: boolean;
  supports_digest: boolean;
  display_order: number;
  default_email: boolean;
  default_push: boolean;
  default_in_app: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  digest_mode: "off" | "daily" | "weekly";
  is_user_set: boolean;
};

export type PreferencesViewModel = {
  role: Role;
  categories: EffectiveCategoryPref[];
  settings: {
    quiet_hours_enabled: boolean;
    quiet_hours_start: string | null;
    quiet_hours_end: string | null;
    quiet_hours_timezone: string;
    dedupe_enabled: boolean;
    digest_send_hour: number;
  };
};

// Loads everything the preferences form needs in one round trip. Used by
// both the host (/dashboard/settings/notifications) and guest
// (/account/settings/notifications) pages.

export async function loadPreferencesViewModel(): Promise<PreferencesViewModel | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = ((profile?.role as Role | undefined) ?? "guest") as Role;

  const [{ data: categoryRows }, { data: prefRows }, { data: settingsRow }] =
    await Promise.all([
      supabase
        .from("notification_categories")
        .select(
          "id, label, description, icon_name, is_locked, supports_digest, display_order, default_for_role",
        )
        .order("display_order", { ascending: true }),
      supabase
        .from("user_notification_preferences")
        .select(
          "category_id, email_enabled, push_enabled, in_app_enabled, digest_mode",
        )
        .eq("user_id", user.id),
      supabase
        .from("user_notification_settings")
        .select(
          "quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone, dedupe_enabled, digest_send_hour",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const prefByCategory = new Map(
    (prefRows ?? []).map((r) => [r.category_id as string, r]),
  );

  const categories: EffectiveCategoryPref[] = (categoryRows ?? []).map(
    (cat) => {
      const defaults =
        (
          cat.default_for_role as Record<
            string,
            { email?: boolean; push?: boolean; in_app?: boolean }
          >
        )[role] ?? {};
      const defaultEmail = defaults.email ?? true;
      const defaultPush = defaults.push ?? true;
      const defaultInApp = defaults.in_app ?? true;
      const userPref = prefByCategory.get(cat.id as string);

      const base = {
        id: cat.id as string,
        label: cat.label as string,
        description: cat.description as string,
        icon_name: cat.icon_name as string,
        is_locked: cat.is_locked as boolean,
        supports_digest: cat.supports_digest as boolean,
        display_order: cat.display_order as number,
        default_email: defaultEmail,
        default_push: defaultPush,
        default_in_app: defaultInApp,
      };

      if (cat.is_locked) {
        return {
          ...base,
          email_enabled: true,
          push_enabled: true,
          in_app_enabled: true,
          digest_mode: "off" as const,
          is_user_set: false,
        };
      }

      return {
        ...base,
        email_enabled:
          (userPref?.email_enabled as boolean | undefined) ?? defaultEmail,
        push_enabled:
          (userPref?.push_enabled as boolean | undefined) ?? defaultPush,
        in_app_enabled:
          (userPref?.in_app_enabled as boolean | undefined) ?? defaultInApp,
        digest_mode:
          (userPref?.digest_mode as "off" | "daily" | "weekly" | undefined) ??
          "off",
        is_user_set: Boolean(userPref),
      };
    },
  );

  return {
    role,
    categories,
    settings: {
      quiet_hours_enabled:
        (settingsRow?.quiet_hours_enabled as boolean | undefined) ?? false,
      quiet_hours_start:
        (settingsRow?.quiet_hours_start as string | undefined)?.slice(0, 5) ??
        null,
      quiet_hours_end:
        (settingsRow?.quiet_hours_end as string | undefined)?.slice(0, 5) ??
        null,
      quiet_hours_timezone:
        (settingsRow?.quiet_hours_timezone as string | undefined) ??
        "Africa/Johannesburg",
      dedupe_enabled:
        (settingsRow?.dedupe_enabled as boolean | undefined) ?? true,
      digest_send_hour:
        (settingsRow?.digest_send_hour as number | undefined) ?? 9,
    },
  };
}
