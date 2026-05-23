"use server";

import { revalidatePath } from "next/cache";

import { createServerClient } from "@/lib/supabase/server";

import {
  hostSchema,
  profileSchema,
  type HostInput,
  type ProfileInput,
} from "./schemas";

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

export async function saveProfileAction(
  input: ProfileInput,
): Promise<SettingsActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to update your profile." };

  const { error } = await supabase
    .from("user_profiles")
    .update({
      full_name: parsed.data.full_name,
      phone:
        parsed.data.phone && parsed.data.phone.length > 0
          ? parsed.data.phone
          : null,
    })
    .eq("id", user.id);
  if (error) {
    return { ok: false, error: "Could not save your profile." };
  }
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function saveHostAction(
  input: HostInput,
): Promise<SettingsActionResult> {
  const parsed = hostSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to update your host page." };

  // RLS host_manage_own — user_id = auth.uid() lets the update through.
  const { error } = await supabase
    .from("hosts")
    .update({
      display_name: parsed.data.display_name,
      bio:
        parsed.data.bio && parsed.data.bio.length > 0 ? parsed.data.bio : null,
      website_url:
        parsed.data.website_url && parsed.data.website_url.length > 0
          ? parsed.data.website_url
          : null,
    })
    .eq("user_id", user.id);
  if (error) {
    return { ok: false, error: "Could not save your host page." };
  }
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}
