"use server";

import { redirect } from "next/navigation";

import { bindAffiliateReferral } from "@/lib/affiliate/attribution";
import { combineName } from "@/lib/profile/name";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  accountSchema,
  finalizeGuestOnboardingSchema,
  type AccountInput,
  type FinalizeGuestOnboardingInput,
} from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// ─── Step 1: create the auth user + sign them in ─────────────────
// Same shape as the host equivalent but never inserts a hosts row.

export async function createGuestAccountAction(
  input: AccountInput,
): Promise<ActionResult> {
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }
  const d = parsed.data;
  const full_name = combineName(d.first_name, d.surname);

  const admin = createAdminClient();
  const { error: createErr } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (createErr) {
    if (
      createErr.message.toLowerCase().includes("already") ||
      createErr.message.toLowerCase().includes("registered")
    ) {
      return {
        ok: false,
        error:
          "An account with this email already exists. Sign in instead, or use a different email.",
      };
    }
    return { ok: false, error: "Could not create your account. Try again." };
  }

  const supabase = createServerClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: d.email,
    password: d.password,
  });
  if (signInErr) {
    return {
      ok: false,
      error: "Account was created but sign-in failed. Try signing in manually.",
    };
  }

  // Seed user_profiles with the name so /portal greets them correctly even if
  // they bail before the finalize step. The handle_new_user trigger should
  // have already inserted the row; we just write the name.
  const {
    data: { user: newUser },
  } = await supabase.auth.getUser();
  if (newUser) {
    await supabase
      .from("user_profiles")
      .update({ full_name, role: "guest" })
      .eq("id", newUser.id);
    // Attribute this signup to a referring affiliate if a vilo_ref cookie is set.
    await bindAffiliateReferral(newUser.id);
  }

  return { ok: true };
}

// ─── Avatar upload — used by step 2 ──────────────────────────────
//
// Uploads to the avatars bucket at <user_id>/<filename>. Returns the public
// URL. Storage RLS (avatars: owner can write/update) ensures the user can
// only write under their own folder.

export async function uploadAvatarAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file received." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "Image is too large — max 5MB." };
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

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadErr) {
    return { ok: false, error: "Upload failed. Try again." };
  }

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  return { ok: true, data: { url: pub.publicUrl } };
}

// ─── Final step: persist about + prefs onto user_profiles ────────

export async function finalizeGuestOnboardingAction(
  input: FinalizeGuestOnboardingInput,
): Promise<ActionResult> {
  const parsed = finalizeGuestOnboardingSchema.safeParse(input);
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
  if (!user) {
    return {
      ok: false,
      error: "Your session expired — sign back in to finish onboarding.",
    };
  }

  const { error: profileErr } = await supabase
    .from("user_profiles")
    .update({
      full_name: d.full_name,
      phone: d.phone && d.phone.length > 0 ? d.phone : null,
      country: d.country && d.country.length > 0 ? d.country : null,
      bio: d.bio && d.bio.length > 0 ? d.bio : null,
      languages: d.languages,
      avatar_url: d.avatar_url && d.avatar_url.length > 0 ? d.avatar_url : null,
      preferred_cities: d.preferred_cities,
      marketing_opt_in: d.marketing_opt_in,
      role: "guest",
    })
    .eq("id", user.id);
  if (profileErr) {
    return { ok: false, error: "Could not save your details. Try again." };
  }

  redirect("/portal?welcome=1");
}
