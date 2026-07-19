"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { bindAffiliateReferral } from "@/lib/affiliate/attribution";
import { getConsentVersion } from "@/lib/auth/consent";
import { isBreachedPassword } from "@/lib/auth/password";
import { checkSignupRateLimit } from "@/lib/auth/rateLimit";
import {
  sendSignupCollisionEmail,
  sendVerificationEmail,
} from "@/lib/auth/verifyEmail";
import { combineName } from "@/lib/profile/name";
import { isHoneypotTripped } from "@/lib/security/honeypot";
import { clientIpFromHeaders, verifyTurnstile } from "@/lib/security/turnstile";
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
// Same shape + hardening as the host equivalent but never inserts a hosts row.
// See host/actions.ts createAccountAction for the soft-verification rationale.

export async function createGuestAccountAction(
  input: AccountInput,
  captchaToken?: string | null,
  honeypot?: string | null,
): Promise<ActionResult> {
  // Honeypot — a filled decoy field means a bot. Reject quietly (generic error,
  // no account created) so we never hint the field is a trap. Runs first: it's
  // free and needs no third party (Turnstile is inert without its secret key).
  if (isHoneypotTripped(honeypot)) {
    return { ok: false, error: "Could not create your account. Try again." };
  }

  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Some fields look wrong." };
  }
  const d = parsed.data;
  const full_name = combineName(d.first_name, d.surname);

  const hdrs = headers();
  const origin = hdrs.get("origin") ?? "";
  const ip = clientIpFromHeaders(hdrs);

  // 1. Rate limit — the admin create path bypasses Supabase's per-IP throttle.
  const limit = await checkSignupRateLimit(ip);
  if (!limit.ok) {
    return {
      ok: false,
      error: "Too many signups from this network. Please try again later.",
    };
  }

  // 2. Bot check (inert until TURNSTILE_SECRET_KEY is set).
  const captcha = await verifyTurnstile(captchaToken, ip);
  if (!captcha.ok) {
    return {
      ok: false,
      error: "Couldn't verify you're human. Refresh and try again.",
    };
  }

  // 3. Reject known-breached passwords (best-effort; never blocks on outage).
  if (await isBreachedPassword(d.password)) {
    return {
      ok: false,
      error:
        "That password has appeared in a data breach. Please choose a different one.",
    };
  }

  const admin = createAdminClient();

  // 4. Provision the user (confirmed for guaranteed sign-in; inbox ownership is
  //    tracked via email_verified_at — see host/actions.ts).
  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email: d.email,
      password: d.password,
      email_confirm: true,
      user_metadata: { full_name },
    },
  );
  if (createErr || !created?.user) {
    const msg = createErr?.message?.toLowerCase() ?? "";
    if (
      msg.includes("already") ||
      msg.includes("registered") ||
      msg.includes("exists")
    ) {
      // Anti-enumeration: don't confirm the email is registered. Email the real
      // owner instead — a passwordless lead (added as a party guest on someone's
      // booking, or from an enquiry) gets a claim link rather than a "just sign
      // in" notice they could never act on (BUSINESS_PRINCIPLES #1 rule 3:
      // signup must never dead-end a returning passwordless guest).
      const sent = await sendSignupCollisionEmail({ email: d.email, origin });
      return {
        ok: false,
        error:
          sent === "claim"
            ? "You already have an account with this email — check your inbox for a link to set your password."
            : "We couldn't complete your signup. If you already have an account, sign in or reset your password.",
      };
    }
    return { ok: false, error: "Could not create your account. Try again." };
  }
  const newUserId = created.user.id;

  // 5. Sign them in so the wizard can continue.
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

  // 6. Seed the name + role + legal consent so /portal greets them even if they
  //    bail before finalize. handle_new_user already inserted the profile row.
  //    email_verified_at stays null → soft banner shows until they confirm.
  await admin
    .from("user_profiles")
    .update({
      full_name,
      role: "guest",
      terms_accepted_at: new Date().toISOString(),
      terms_version: await getConsentVersion(),
    })
    .eq("id", newUserId);

  // 7. Send the confirmation email (best-effort — inert without a Resend key).
  await sendVerificationEmail({
    userId: newUserId,
    email: d.email,
    origin,
    firstName: d.first_name,
  });

  // Attribute this signup to a referring affiliate if a vilo_ref cookie is set.
  await bindAffiliateReferral(newUserId);

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
  next?: string | null,
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

  // Honour a safe internal ?next (e.g. the Looking For landing sends new posters
  // straight to /portal/looking-for/new). Reject anything not a same-site path
  // so this can never become an open redirect.
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  redirect(safeNext ?? "/portal?welcome=1");
}
