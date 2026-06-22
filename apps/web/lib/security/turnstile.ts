import "server-only";

// Cloudflare Turnstile server-side verification (bot-hardening for the public,
// session-less write endpoints: website form submit + on-site checkout). The
// client widget (components/site/TurnstileWidget.tsx) produces a one-time token
// which the browser sends in the request body as `ts`; we verify it here before
// any DB write.
//
// INERT until configured: when `TURNSTILE_SECRET_KEY` is unset (today — the
// founder adds the keys at Step 2 of the production-readiness lane) every call
// passes, so the existing honeypot is the only gate and nothing breaks in dev or
// the current deploy. Mirrors the fail-safe pattern used elsewhere (the
// host-routing middleware is opt-in via NEXT_PUBLIC_ROOT_DOMAIN; the feature
// gates short-circuit pre-MVP). The moment the secret is set, verification turns
// on with no further code change.

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; reason: "missing-token" | "failed" | "error" };

/**
 * Verify a Turnstile token. Returns `{ ok: true, skipped: true }` when Turnstile
 * is not configured (no secret) so callers stay functional until the keys land.
 *
 * Fail-closed: once the secret is set, a missing token, a `success: false`
 * response, or a verification error all reject. This is deliberate — the whole
 * point of enabling Turnstile is to drop traffic that can't prove it's human.
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Not configured → inert (honeypot still applies upstream).
  if (!secret) return { ok: true, skipped: true };

  if (!token || token.trim().length === 0) {
    return { ok: false, reason: "missing-token" };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (remoteIp) body.set("remoteip", remoteIp);

    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      // Don't let a slow Cloudflare hang the request indefinitely.
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true
      ? { ok: true }
      : { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * Best-effort client IP from the request headers, for the optional `remoteip`
 * siteverify param. Cloudflare-fronted custom domains set `CF-Connecting-IP`;
 * Vercel/most proxies set `x-forwarded-for` (first hop is the client).
 */
export function clientIpFromHeaders(headers: Headers): string | undefined {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || undefined;
  return headers.get("x-real-ip")?.trim() || undefined;
}
