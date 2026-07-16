"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isBreachedPassword } from "@/lib/auth/password";
import { sendPasswordResetEmail } from "@/lib/auth/passwordReset";
import { resolvePostAuthDestination } from "@/lib/auth/postAuth";
import { safeNextPath } from "@/lib/auth/safeNext";
import { sendVerificationEmail } from "@/lib/auth/verifyEmail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  forgotPasswordSchema,
  loginSchema,
  magicLinkSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type MagicLinkInput,
  type RegisterInput,
  type ResetPasswordInput,
} from "./schemas";

export type AuthActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function loginAction(
  input: LoginInput,
  next?: string | null,
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the form and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: friendlyAuthError(error.message) };
  }

  const destination = await resolvePostAuthDestination(
    data.user?.id ?? null,
    next,
  );
  redirect(destination);
}

export async function registerAction(
  input: RegisterInput,
  next?: string | null,
): Promise<AuthActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the form and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Reject known-breached passwords (best-effort; never blocks on outage).
  if (await isBreachedPassword(parsed.data.password)) {
    return {
      ok: false,
      error: "That password has appeared in a data breach.",
      fieldErrors: {
        password: ["Please choose a password that hasn't been in a breach."],
      },
    };
  }

  // Only honour same-origin relative next paths (open-redirect guard).
  const safeNext = safeNextPath(next);

  // Create the account with the admin API + email_confirm, exactly like the
  // public signup wizards. The non-admin `supabase.auth.signUp` returns NO
  // session on this project (GoTrue requires confirmation for that path) — and
  // with no auth SMTP configured, an invitee would be left unconfirmed,
  // session-less, and unable to proceed. Admin-create sidesteps that so the
  // staff-invite handoff completes: guaranteed session → land back on
  // /staff/accept/<token> (carried in `next`) → click Accept → staff row.
  const admin = createAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
    },
  );
  if (createErr || !created?.user) {
    const msg = createErr?.message?.toLowerCase() ?? "";
    if (
      msg.includes("already") ||
      msg.includes("registered") ||
      msg.includes("exists")
    ) {
      return {
        ok: false,
        error:
          "An account with this email already exists. Try signing in instead.",
      };
    }
    return { ok: false, error: "Could not create your account. Try again." };
  }

  const supabase = createServerClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (signInErr) {
    return {
      ok: false,
      error: "Account was created but sign-in failed. Try signing in manually.",
    };
  }

  const dest = await resolvePostAuthDestination(created.user.id, safeNext);
  redirect(dest);
}

export async function signOutAction(): Promise<void> {
  const supabase = createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function forgotPasswordAction(
  input: ForgotPasswordInput,
): Promise<AuthActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please enter a valid email address.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const origin = headers().get("origin") ?? "";

  // Fire-and-forget by design: always redirect to the "check your inbox" state,
  // even if the email isn't registered, to avoid account-enumeration leaks.
  // We mint our OWN recovery link (through /auth/confirm → /reset-password) so
  // the reset always lands on the set-new-password page — not the dashboard.
  await sendPasswordResetEmail({ email: parsed.data.email, origin });

  redirect("/forgot-password?sent=1");
}

export async function magicLinkAction(
  input: MagicLinkInput,
): Promise<AuthActionResult> {
  const parsed = magicLinkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please enter a valid email address.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = createServerClient();
  const origin = headers().get("origin") ?? "";

  // Like forgotPasswordAction, we intentionally swallow Supabase errors here to
  // avoid leaking whether an email exists. The form switches to a sent-state
  // either way.
  await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
      shouldCreateUser: false,
    },
  });

  return { ok: true };
}

export async function resetPasswordAction(
  input: ResetPasswordInput,
): Promise<AuthActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the form and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: "Your reset link has expired. Please request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: friendlyAuthError(error.message) };
  }

  const destination = await resolvePostAuthDestination(user.id, null);
  redirect(destination);
}

/**
 * Resend the email-verification link to the currently signed-in user. Drives
 * the in-app "verify your email" banner. No-ops (returns ok) if they're already
 * confirmed so the button can't be used to spam a confirmed inbox.
 */
export async function resendVerificationEmailAction(): Promise<AuthActionResult> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, error: "Your session expired — sign in again." };
  }

  // Already verified (app-level flag)? No-op so the button can't spam a
  // confirmed inbox.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("email_verified_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.email_verified_at) {
    return { ok: true };
  }

  const origin = headers().get("origin") ?? "";
  const firstName =
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    null;
  const res = await sendVerificationEmail({
    userId: user.id,
    email: user.email,
    origin,
    firstName,
  });
  if (!res.ok) {
    return {
      ok: false,
      error: "Could not send the email right now. Please try again shortly.",
    };
  }
  return { ok: true };
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Email or password is incorrect.";
  if (m.includes("email not confirmed"))
    return "Please verify your email before signing in.";
  if (m.includes("already registered") || m.includes("user already"))
    return "An account with this email already exists. Try signing in instead.";
  if (m.includes("rate limit"))
    return "Too many attempts. Please wait a moment and try again.";
  return "Something went wrong. Please try again.";
}
