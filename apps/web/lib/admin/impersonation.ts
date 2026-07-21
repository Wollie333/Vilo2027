import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { tokenSecret } from "@/lib/auth/tokenSecret";
import { createAdminClient } from "@/lib/supabase/admin";

export const IMPERSONATION_COOKIE = "vilo_impersonation";
const IMPERSONATION_MAX_AGE_SECONDS = 30 * 60;

export type ImpersonationContext = {
  sessionId: string;
  targetUserId: string;
  startedAt: string;
};

/**
 * Reads the impersonation cookie and verifies signature + expiry. Returns the
 * session context or null. Does NOT swap auth — all impersonation reads happen
 * via service-role client scoped by the returned targetUserId.
 */
export function readImpersonationCookie(): ImpersonationContext | null {
  const raw = cookies().get(IMPERSONATION_COOKIE)?.value;
  if (!raw) return null;
  return verifyToken(raw);
}

export function getActiveImpersonationTargetId(): string | null {
  return readImpersonationCookie()?.targetUserId ?? null;
}

/**
 * Create an impersonation_sessions row and set the signed cookie. Caller is
 * responsible for permission-checking via requirePermission('users.impersonate').
 */
export async function openImpersonationSession(
  adminId: string,
  targetUserId: string,
): Promise<ImpersonationContext> {
  const service = createAdminClient();
  const { data, error } = await service
    .from("impersonation_sessions")
    .insert({ admin_id: adminId, target_user_id: targetUserId })
    .select("id, target_user_id, started_at")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to open impersonation session: ${error?.message ?? "unknown"}`,
    );
  }

  const ctx: ImpersonationContext = {
    sessionId: data.id,
    targetUserId: data.target_user_id,
    startedAt: data.started_at,
  };

  cookies().set(IMPERSONATION_COOKIE, signToken(ctx), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: IMPERSONATION_MAX_AGE_SECONDS,
  });

  return ctx;
}

/**
 * End the active impersonation session (if any). Clears the cookie and stamps
 * ended_at on the DB row. Safe to call when no session is open.
 */
export async function closeImpersonationSession(): Promise<string | null> {
  const ctx = readImpersonationCookie();
  cookies().delete(IMPERSONATION_COOKIE);
  if (!ctx) return null;

  const service = createAdminClient();
  await service
    .from("impersonation_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", ctx.sessionId)
    .is("ended_at", null);

  return ctx.sessionId;
}

// ─── cookie signing ──────────────────────────────────────────
// HMAC-SHA256 over JSON, keyed per-purpose (lib/auth/tokenSecret.ts) rather than
// with the raw service-role credential — so an impersonation cookie can never be
// replayed as another kind of signed token, and the key can be rotated without
// rotating database access. Rotating it invalidates all open impersonation
// sessions, which is the correct behaviour.

function getSecret(): Buffer {
  return tokenSecret("impersonation");
}

function signToken(ctx: ImpersonationContext): string {
  const payload = Buffer.from(JSON.stringify(ctx)).toString("base64url");
  const sig = createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token: string): ImpersonationContext | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let ctx: ImpersonationContext;
  try {
    ctx = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf-8"),
    ) as ImpersonationContext;
  } catch {
    return null;
  }

  // Enforce expiry server-side: the cookie `maxAge` is only a client hint, and
  // the HMAC payload itself carries no expiry, so a copied/retained cookie would
  // otherwise verify forever. Reject sessions older than the max age.
  const startedMs = Date.parse(ctx.startedAt);
  if (
    !Number.isFinite(startedMs) ||
    Date.now() - startedMs > IMPERSONATION_MAX_AGE_SECONDS * 1000
  ) {
    return null;
  }

  return ctx;
}
