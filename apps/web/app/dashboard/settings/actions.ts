"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  passwordSchema,
  profileSchema,
  type PasswordInput,
  type ProfileInput,
} from "./schemas";

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

// Saves both user_profiles AND hosts (if a hosts row exists) in one call.
// Avatar is mirrored onto hosts.avatar_url so the public host page and
// listing cards pick it up without a join.
export async function saveProfileAction(
  input: ProfileInput,
): Promise<SettingsActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? "Please check the form and try again.",
    };
  }
  const d = parsed.data;

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to update your profile." };

  const avatarUrl =
    d.avatar_url && d.avatar_url.length > 0 ? d.avatar_url : null;
  const phone = d.phone && d.phone.length > 0 ? d.phone : null;
  const bio = d.bio && d.bio.length > 0 ? d.bio : null;
  const websiteUrl =
    d.website_url && d.website_url.length > 0 ? d.website_url : null;

  // Email change — pre-MVP we update both auth.users and user_profiles via
  // the admin client (immediate, no confirmation email). When real users
  // land switch to supabase.auth.updateUser({ email }) for the standard
  // confirm-via-email flow.
  const currentEmail = (user.email ?? "").toLowerCase();
  const nextEmail = d.email.toLowerCase();
  if (nextEmail !== currentEmail) {
    const admin = createAdminClient();
    const { error: emailErr } = await admin.auth.admin.updateUserById(user.id, {
      email: nextEmail,
      email_confirm: true,
    });
    if (emailErr) {
      const msg = emailErr.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        return {
          ok: false,
          error: "That email is already in use by another account.",
        };
      }
      console.error("[settings:saveProfile] email update failed", emailErr);
      return {
        ok: false,
        error: `Could not change your email: ${emailErr.message}`,
      };
    }
  }

  // Always update user_profiles. Avatar lives here too — the layout reads it.
  const { error: profileErr } = await supabase
    .from("user_profiles")
    .update({
      full_name: d.full_name,
      email: nextEmail,
      phone,
      avatar_url: avatarUrl,
    })
    .eq("id", user.id);
  if (profileErr) {
    return { ok: false, error: "Could not save your profile." };
  }

  // If a hosts row exists, mirror display_name / bio / website / avatar onto it.
  // Use the user-bound client; RLS host_manage_own permits user_id=auth.uid().
  const { data: hostRow } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (hostRow) {
    const displayName =
      d.display_name && d.display_name.length > 0
        ? d.display_name
        : d.full_name;
    const hostPatch: Record<string, unknown> = {
      display_name: displayName,
      bio,
      website_url: websiteUrl,
      avatar_url: avatarUrl,
    };
    // languages_spoken is optional — only set when the wizard sends it,
    // so the settings ProfileForm (which doesn't collect it) doesn't wipe
    // the host's existing languages on every save.
    if (d.languages_spoken !== undefined) {
      hostPatch.languages_spoken = d.languages_spoken;
    }
    // Optional in the schema; treat "unset" as "no highlights".
    hostPatch.highlights = d.highlights ?? [];
    const { error: hostErr } = await supabase
      .from("hosts")
      .update(hostPatch)
      .eq("user_id", user.id);
    if (hostErr) {
      return { ok: false, error: "Could not save your host page." };
    }
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Uploads an avatar to the `avatars` bucket at <user_id>/avatar-<ts>.<ext>.
// Uses the admin storage client so we don't depend on session cookies being
// readable in this server action context (which has bitten the onboarding
// flow). The user.id from getUser() still scopes the upload path.
export async function uploadAvatarAction(
  formData: FormData,
): Promise<SettingsActionResult & { url?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file received." };
  }
  // 4MB stays under the Vercel Server-Action body cap (~4.5MB) and matches the
  // client-side guard in HostProfileForm.
  if (file.size > 4 * 1024 * 1024) {
    return { ok: false, error: "Image is too large — max 4MB." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Only image files are allowed." };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: "Your session expired — sign back in to upload a photo.",
    };
  }

  const admin = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadErr) {
    console.error("[settings:uploadAvatar] storage upload failed", uploadErr);
    return {
      ok: false,
      error: `Upload failed: ${uploadErr.message}`,
    };
  }

  const { data: pub } = admin.storage.from("avatars").getPublicUrl(path);
  return { ok: true, url: pub.publicUrl };
}

// Changes the signed-in user's password via the admin client. Pre-MVP we
// don't require the current password — the user is already authenticated
// in this session. When real users land, gate this behind a re-auth step.
export async function changePasswordAction(
  input: PasswordInput,
): Promise<SettingsActionResult> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? "Please check the form and try again.",
    };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to change your password." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: parsed.data.new_password,
  });
  if (error) {
    console.error("[settings:changePassword] update failed", error);
    return {
      ok: false,
      error: `Could not change your password: ${error.message}`,
    };
  }
  return { ok: true };
}
