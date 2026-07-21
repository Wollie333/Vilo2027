import "server-only";

import { createClient } from "@supabase/supabase-js";

import { createServerClient } from "@/lib/supabase/server";

/**
 * Re-authentication for sensitive account changes.
 *
 * Holding a session is not the same as being the account owner. A borrowed
 * laptop, a stolen cookie or an XSS gets someone a live session — and until now
 * that was enough to change the password and lock the real owner out
 * permanently, with no current password and no email confirmation. Anything that
 * can take an account away from its owner therefore has to re-prove ownership,
 * not just presence.
 *
 * This is also what makes optional 2FA meaningful: an attacker who already holds
 * a session never logs in again, so a login-time second factor alone would never
 * see them.
 */

/** Does the signed-in user have a password at all? (Magic-link users do not.) */
export async function currentUserHasPassword(): Promise<boolean> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase.rpc("current_user_has_password");
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

export type ReauthResult =
  | { ok: true }
  | { ok: false; error: string; needsSetPassword?: boolean };

/**
 * Verify the caller's CURRENT password without touching their session.
 *
 * The check is a sign-in attempt on a throwaway client with session persistence
 * switched off — so a wrong guess cannot disturb the live session, and a correct
 * one does not mint a second one. Using the request-bound client here would
 * rotate the caller's own tokens as a side effect of a validation step.
 *
 * Fails CLOSED: any unexpected error is a refusal, never a pass. A helper whose
 * job is to stand between a stranger and someone's account must not treat "I
 * couldn't tell" as "yes".
 */
export async function verifyCurrentPassword(
  email: string,
  currentPassword: string,
): Promise<ReauthResult> {
  if (!currentPassword) {
    return { ok: false, error: "Enter your current password." };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { ok: false, error: "Could not verify your password. Try again." };
  }

  try {
    const probe = createClient(url, anon, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { data, error } = await probe.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    // Drop the throwaway session — but LOCALLY ONLY. signOut() defaults to
    // scope:"global", which revokes every refresh token the user holds: the
    // caller's own session included. Verifying your password would then sign you
    // out everywhere and the change you were authorising would fail immediately
    // afterwards. The probe token is never persisted or sent anywhere, so
    // dropping it in-process is enough.
    if (data?.session) await probe.auth.signOut({ scope: "local" });

    if (error || !data?.user) {
      return { ok: false, error: "That current password isn't right." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not verify your password. Try again." };
  }
}

/**
 * The full gate for a sensitive change: confirm the caller still is the owner.
 *
 * A passwordless account has nothing to re-prove with here, so it is refused and
 * routed to the emailed set-password link instead — proving control of the inbox
 * is the equivalent step for them, and it is the one thing a session thief does
 * not have.
 */
export async function requireReauth(
  email: string | null | undefined,
  currentPassword: string | undefined | null,
): Promise<ReauthResult> {
  const hasPassword = await currentUserHasPassword();
  if (!hasPassword) {
    return {
      ok: false,
      needsSetPassword: true,
      error:
        "Your account signs in by email link. We'll email you a secure link to set a password.",
    };
  }
  if (!email) {
    return { ok: false, error: "Could not verify your password. Try again." };
  }
  return verifyCurrentPassword(email, currentPassword ?? "");
}
