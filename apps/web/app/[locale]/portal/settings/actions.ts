"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { sendPasswordResetEmail } from "@/lib/auth/passwordReset";
import { checkRateLimit } from "@/lib/auth/rateLimit";
import { requireReauth } from "@/lib/auth/reauth";
import { clientIpFromHeaders } from "@/lib/security/turnstile";
import { createServerClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  bio: z.string().trim().max(240).optional().or(z.literal("")),
  avatar_url: z.string().url().optional().or(z.literal("")),
  languages: z.array(z.string().min(1).max(40)).max(20).default([]),
});

const contactSchema = z.object({
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  country: z.string().trim().max(60).optional().or(z.literal("")),
});

const prefsSchema = z.object({
  preferred_cities: z.array(z.string().min(1).max(80)).max(20).default([]),
  marketing_opt_in: z.boolean().default(false),
});

// Both carry `current_password` for re-authentication. Optional in the schema
// only so a passwordless account reaches the "we'll email you a link" answer
// rather than a validation error about a password it has never had.
const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  current_password: z.string().max(72).optional(),
});

const passwordSchema = z.object({
  password: z.string().min(8, "Use at least 8 characters.").max(72),
  current_password: z.string().max(72).optional(),
});

export async function updateProfileAction(
  input: z.infer<typeof profileSchema>,
): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Some fields look wrong.",
    };
  }
  const d = parsed.data;
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired." };

  const { error } = await supabase
    .from("user_profiles")
    .update({
      full_name: d.full_name,
      bio: d.bio && d.bio.length > 0 ? d.bio : null,
      avatar_url: d.avatar_url && d.avatar_url.length > 0 ? d.avatar_url : null,
      languages: d.languages,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Could not save. Try again." };

  revalidatePath("/portal/settings");
  revalidatePath("/portal");
  return { ok: true };
}

export async function updateContactAction(
  input: z.infer<typeof contactSchema>,
): Promise<ActionResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Some fields look wrong.",
    };
  }
  const d = parsed.data;
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired." };

  const { error } = await supabase
    .from("user_profiles")
    .update({
      phone: d.phone && d.phone.length > 0 ? d.phone : null,
      country: d.country && d.country.length > 0 ? d.country : null,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Could not save. Try again." };

  revalidatePath("/portal/settings");
  return { ok: true };
}

export async function updatePrefsAction(
  input: z.infer<typeof prefsSchema>,
): Promise<ActionResult> {
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Some fields look wrong.",
    };
  }
  const d = parsed.data;
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired." };

  const { error } = await supabase
    .from("user_profiles")
    .update({
      preferred_cities: d.preferred_cities,
      marketing_opt_in: d.marketing_opt_in,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Could not save. Try again." };

  revalidatePath("/portal/settings");
  return { ok: true };
}

// Change the account's sign-in email. Supabase sends a confirmation link to the
// NEW address; the change only takes effect once the guest clicks it.
export async function updateEmailAction(
  input: z.infer<typeof emailSchema>,
): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Enter a valid email.",
    };
  }
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired." };

  if (parsed.data.email.toLowerCase() === (user.email ?? "").toLowerCase()) {
    return { ok: false, error: "That's already your email address." };
  }

  // Moving the sign-in address moves the account. Same re-auth gate as the
  // password change — otherwise a borrowed session can redirect every future
  // recovery email to an address the owner doesn't control.
  const hdrs = headers();
  const limit = await checkRateLimit(
    clientIpFromHeaders(hdrs),
    "reauth",
    10,
    15,
  );
  if (!limit.ok) {
    return {
      ok: false,
      error: "Too many attempts. Please wait a few minutes and try again.",
    };
  }
  const reauth = await requireReauth(user.email, parsed.data.current_password);
  if (!reauth.ok) {
    if (reauth.needsSetPassword) {
      await sendPasswordResetEmail({
        email: user.email ?? "",
        origin: hdrs.get("origin") ?? "",
      });
    }
    return { ok: false, error: reauth.error };
  }

  const { error } = await supabase.auth.updateUser({
    email: parsed.data.email,
  });
  if (error) {
    return {
      ok: false,
      error: "Could not start the email change. Try again.",
    };
  }
  return { ok: true };
}

/**
 * Set a new account password for the signed-in guest — behind re-authentication.
 * See lib/auth/reauth.ts: a live session proves presence, not ownership, and a
 * password change is the one edit that can take an account away from its owner.
 */
export async function updatePasswordAction(
  input: z.infer<typeof passwordSchema>,
): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Choose a stronger password.",
    };
  }
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired." };

  const hdrs = headers();
  const limit = await checkRateLimit(
    clientIpFromHeaders(hdrs),
    "reauth",
    10,
    15,
  );
  if (!limit.ok) {
    return {
      ok: false,
      error: "Too many attempts. Please wait a few minutes and try again.",
    };
  }

  const reauth = await requireReauth(user.email, parsed.data.current_password);
  if (!reauth.ok) {
    if (reauth.needsSetPassword) {
      await sendPasswordResetEmail({
        email: user.email ?? "",
        origin: hdrs.get("origin") ?? "",
      });
    }
    return { ok: false, error: reauth.error };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { ok: false, error: "Could not update your password. Try again." };
  }
  return { ok: true };
}
