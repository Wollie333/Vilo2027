"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { resolvePostAuthDestination } from "@/lib/auth/postAuth";
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

  const supabase = createServerClient();
  const origin = headers().get("origin") ?? "";

  // Only honour relative next paths (open-redirect guard).
  const safeNext = next && next.startsWith("/") ? next : null;
  const confirmUrl = safeNext
    ? `${origin}/auth/confirm?next=${encodeURIComponent(safeNext)}`
    : `${origin}/auth/confirm`;

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: confirmUrl,
    },
  });

  if (error) {
    return { ok: false, error: friendlyAuthError(error.message) };
  }

  const needsVerification = !data.session;
  const params = new URLSearchParams();
  if (needsVerification) params.set("verify", "1");
  if (safeNext) params.set("next", safeNext);
  const qs = params.toString();
  redirect(`/login${qs ? `?${qs}` : ""}`);
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

  const supabase = createServerClient();
  const origin = headers().get("origin") ?? "";

  // Fire-and-forget by design: always redirect to the "check your inbox" state,
  // even if the email isn't registered, to avoid account-enumeration leaks.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

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
