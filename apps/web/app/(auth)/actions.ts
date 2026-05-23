"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from "./schemas";

export type AuthActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function loginAction(
  input: LoginInput,
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
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: friendlyAuthError(error.message) };
  }

  redirect("/dashboard");
}

export async function registerAction(
  input: RegisterInput,
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

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    return { ok: false, error: friendlyAuthError(error.message) };
  }

  const needsVerification = !data.session;
  const query = needsVerification ? "?verify=1" : "";
  redirect(`/login${query}`);
}

export async function signOutAction(): Promise<void> {
  const supabase = createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
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
