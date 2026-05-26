"use server";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  accountSchema,
  finalizeOnboardingSchema,
  type AccountInput,
  type FinalizeOnboardingInput,
} from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// ─── Step 1: create the auth user + sign them in ─────────────────
//
// Uses the admin client to create with email_confirm = true so the founder
// can smoke-test the whole onboarding without needing to click a verification
// email. When real-user email verification is required later, flip this to
// regular `supabase.auth.signUp` and require the user to come back via the
// confirm link.

export async function createAccountAction(
  input: AccountInput,
): Promise<ActionResult> {
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }
  const d = parsed.data;

  const admin = createAdminClient();

  // Create user with email pre-confirmed.
  const { error: createErr } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true,
    user_metadata: { full_name: d.full_name },
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

  // Sign them in immediately so the wizard can continue under their session.
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

  return { ok: true };
}

// ─── Avatar upload — used by step 2 (About you) ──────────────────
//
// Mirrors the guest-side action: uploads to the `avatars` bucket at
// <user_id>/avatar-<ts>.<ext> and returns the public URL. Storage RLS
// (avatars bucket: owner can write/update under their folder) ensures
// the user can only write under their own folder.

export async function uploadHostAvatarAction(
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

  // Use the admin storage client so the upload doesn't depend on session
  // cookies being readable inside this server-action context. The path is
  // still scoped to user.id from the authenticated session above.
  const admin = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadErr) {
    console.error("[host-onboarding:uploadAvatar] failed", uploadErr);
    return { ok: false, error: `Upload failed: ${uploadErr.message}` };
  }

  const { data: pub } = admin.storage.from("avatars").getPublicUrl(path);
  return { ok: true, data: { url: pub.publicUrl } };
}

// ─── Final step: create profile + host + listing + free subscription ─

export async function finalizeOnboardingAction(
  input: FinalizeOnboardingInput,
): Promise<ActionResult> {
  const parsed = finalizeOnboardingSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? "Please check the form and try again.",
    };
  }
  const d = parsed.data;

  // We authenticate via the user-bound client so we can trust auth.uid(),
  // then switch to the service-role client for the writes. Reasons:
  //  - user_profiles RLS forbids users changing their own `role` column
  //    (WITH CHECK requires the new role to equal the old role), so the
  //    user-bound update would silently fail for the guest→host promotion.
  //  - The host_id chain (hosts → listings → subscriptions) is cleaner
  //    under one privileged code path that won't half-succeed because of
  //    RLS edge cases. We already validated the user above.
  const userClient = createServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: "Your session expired — sign back in to finish onboarding.",
    };
  }

  const admin = createAdminClient();

  // Bail if onboarding already ran (e.g. double-submit, duplicate tab).
  const { data: existingHost } = await admin
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingHost) {
    redirect("/dashboard?welcome=1");
  }

  // 1. Profile — every field collected in the About step persisted on
  //    user_profiles so they survive past onboarding.
  const { error: profileErr } = await admin
    .from("user_profiles")
    .update({
      full_name: d.full_name,
      phone: d.phone,
      country: d.country,
      bio: d.bio && d.bio.length > 0 ? d.bio : null,
      languages: d.languages,
      avatar_url: d.avatar_url && d.avatar_url.length > 0 ? d.avatar_url : null,
      role: "host",
    })
    .eq("id", user.id);
  if (profileErr) {
    return { ok: false, error: "Could not save your details. Try again." };
  }

  // 2. Host row — handle auto-generated by trigger_host_handle from
  //    display_name. bio + languages mirrored onto hosts so the public
  //    host page can render them without joining user_profiles.
  const { data: host, error: hostErr } = await admin
    .from("hosts")
    .insert({
      user_id: user.id,
      display_name: d.full_name,
      bio: d.bio && d.bio.length > 0 ? d.bio : null,
      languages_spoken: d.languages,
      // Mirror avatar onto hosts so the public host page + listing cards
      // can render it without joining user_profiles.
      avatar_url: d.avatar_url && d.avatar_url.length > 0 ? d.avatar_url : null,
    })
    .select("id, handle")
    .single();
  if (hostErr || !host) {
    return {
      ok: false,
      error: "Could not create your host profile. Try again.",
    };
  }

  // 3. First DRAFT listing — full address collected, capacity/pricing/
  //    duration/photos stay NULL until the host opens the listing editor.
  //    If this fails we KEEP the host row (the user is still a host, they
  //    can create a listing from the dashboard) — avoids the stuck state
  //    where the cleanup deletes the host and leaves the user homeless.
  const finalKind = d.listing_kind;
  const { error: listingErr } = await admin.from("listings").insert({
    host_id: host.id,
    listing_type: finalKind,
    accommodation_type:
      finalKind === "accommodation" ? (d.accommodation_type ?? null) : null,
    experience_type:
      finalKind === "experience" ? (d.experience_type ?? null) : null,
    name: d.listing_name,
    address_line1: d.address_line1,
    address_line2:
      d.address_line2 && d.address_line2.length > 0 ? d.address_line2 : null,
    city: d.city,
    province: d.region,
    postal_code: d.postal_code,
    // country defaults to 'ZA' at DB level.
  });
  if (listingErr) {
    // Non-blocking — host can create their first listing from the editor.
    // Surface it as a soft warning rather than failing the whole onboard.
    console.error("[host-onboarding] listings insert failed", listingErr);
  }

  // 4. Subscription — Free for now regardless of plan picked. Payment +
  //    plan upgrade flow lands later. Non-blocking on failure.
  await admin.from("subscriptions").insert({
    host_id: host.id,
    plan: "free",
    status: "active",
  });

  redirect("/dashboard?welcome=1");
}
