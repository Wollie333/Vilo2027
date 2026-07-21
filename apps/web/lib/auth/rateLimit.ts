import "server-only";

import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

// IP-keyed rate limit for public account creation. The guest + host signup
// actions create users through the service-role admin API, which sidesteps
// Supabase's built-in per-IP `sign_in_sign_ups` throttle — so this is the only
// thing standing between the endpoint and a mass-signup script.
//
// Backed by `signup_rate_limits` (migration 20260707190000). We store a SALTED
// HASH of the IP, never the raw address, so the ledger isn't a pile of PII.
//
// Fail-open: if we can't identify the caller (no IP header) or the ledger query
// itself errors, we allow the attempt. Turnstile + the breach check are the
// other layers — a DB blip here should never hard-block a real signup.

const WINDOW_MINUTES = 60;
const MAX_ATTEMPTS_PER_WINDOW = 8;

function hashIp(ip: string, purpose = "signup"): string {
  // Prefer a dedicated salt; fall back to the service-role key (already secret
  // and server-only) so this works without extra env config.
  //
  // `purpose` is folded into the hash so different endpoints get INDEPENDENT
  // buckets out of the same table without a schema change — verifying a password
  // must not eat someone's signup allowance, and vice versa.
  const salt =
    process.env.RATE_LIMIT_SALT ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "wielo-signup";
  return createHash("sha256").update(`${salt}:${purpose}:${ip}`).digest("hex");
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMinutes: number };

/**
 * Record a signup attempt from `ip` and report whether the caller is over the
 * limit (>= MAX_ATTEMPTS_PER_WINDOW in the last WINDOW_MINUTES). Call this once
 * at the top of each account-creation action.
 */
export async function checkSignupRateLimit(
  ip: string | null | undefined,
): Promise<RateLimitResult> {
  return checkRateLimit(ip, "signup", MAX_ATTEMPTS_PER_WINDOW, WINDOW_MINUTES);
}

/**
 * Rate limit any IP-keyed action against its own bucket.
 *
 * Used for re-authentication: verifying a current password is, by construction,
 * an oracle that says "right" or "wrong", so it has to be throttled or it is a
 * brute-force endpoint wearing a different hat. Tighter and shorter than signup
 * — a real person mistypes their own password a handful of times, not fifty.
 */
export async function checkRateLimit(
  ip: string | null | undefined,
  purpose: string,
  maxAttempts: number,
  windowMinutes: number,
): Promise<RateLimitResult> {
  if (!ip) return { ok: true }; // unidentifiable → fail open

  try {
    const admin = createAdminClient();
    const ipHash = hashIp(ip, purpose);
    const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();

    const { count, error } = await admin
      .from("signup_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);

    if (error) return { ok: true }; // DB hiccup → don't block real users

    if ((count ?? 0) >= maxAttempts) {
      return { ok: false, retryAfterMinutes: windowMinutes };
    }

    // Record this attempt. Best-effort — a failed insert just means the next
    // request sees one fewer attempt.
    await admin.from("signup_rate_limits").insert({ ip_hash: ipHash });
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
