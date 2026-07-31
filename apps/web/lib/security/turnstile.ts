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

/**
 * The widget secret, under either name.
 *
 * Cloudflare's own setup flow (and its Spin skill) tells you to store it as
 * `TURNSTILE_SECRET`; this codebase has always read `TURNSTILE_SECRET_KEY`.
 * Accepting both removes the single most likely way to lose an afternoon here:
 * setting the variable exactly as Cloudflare instructed, redeploying, and
 * having nothing change — because verification silently kept failing open under
 * a name nothing was reading.
 *
 * `TURNSTILE_SECRET_KEY` wins when both are set; it is the one the config panel
 * and the runbook name.
 */
export function turnstileSecret(): string | undefined {
  return (
    process.env.TURNSTILE_SECRET_KEY?.trim() ||
    process.env.TURNSTILE_SECRET?.trim() ||
    undefined
  );
}

export type TurnstileResult =
  | { ok: true; skipped?: boolean }
  | {
      ok: false;
      reason: "missing-token" | "failed" | "error";
      /** Cloudflare siteverify `error-codes` when reason is "failed". */
      errorCodes?: string[];
    };

/**
 * Cloudflare siteverify `error-codes` that mean the CHECK is broken — the widget
 * pair is misconfigured, the hostname isn't allowed, or the token is stale — NOT
 * that the visitor is a bot. A real bot never obtains a token in the first place,
 * so it fails earlier as "missing-token". Treating these as a bot verdict (the
 * old behaviour) turned a dashboard/env misconfiguration into a total signup
 * outage (pt91 / pt92). See https://developers.cloudflare.com/turnstile/get-started/server-side-validation/#error-codes
 */
const INFRA_ERROR_CODES = new Set([
  "missing-input-secret",
  "invalid-input-secret", // secret wrong, or from a different widget than the sitekey
  "missing-input-response",
  "invalid-input-response", // token invalid/expired, or sitekey/secret are a mismatched pair
  "bad-request",
  "timeout-or-duplicate", // token already redeemed or too old (e.g. a double submit)
  "internal-error",
  "invalid-widget-id",
  "invalid-parity",
  "invalid-input-hostname", // page hostname not in the widget's allow-list
  "hostname-not-allowed",
]);

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
  const secret = turnstileSecret();
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
    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    return data.success === true
      ? { ok: true }
      : { ok: false, reason: "failed", errorCodes: data["error-codes"] ?? [] };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/**
 * Public-form gate with a RESILIENT posture: block only on an explicit bot
 * verdict from Cloudflare, never on an infrastructure/config failure.
 *
 *   • verifyTurnstile ok             → allowed.
 *   • reason "missing-token"|"error" → ALLOWED (soft-pass, logged). The widget
 *                                      never produced a token, or siteverify was
 *                                      unreachable — a problem with the check, not
 *                                      proof of a bot.
 *   • reason "failed" (success:false)→ inspect Cloudflare's error-codes:
 *       – config/infra/token codes (invalid-input-secret, invalid-input-response,
 *         hostname-not-allowed, timeout-or-duplicate, …) → ALLOWED (soft-pass).
 *         These mean the widget PAIR or the allowed-hostnames are misconfigured,
 *         or the token is stale — the founder's problem, never proof of a bot.
 *       – any UNRECOGNISED code (or a code outside the infra set) → BLOCKED, so a
 *         future genuine reject reason still hard-gates.
 *
 * In every soft-pass case the always-on honeypot (lib/security/honeypot.ts) is
 * still the hard gate.
 *
 * Why this exists: a strict fail-closed posture turns any Turnstile outage or key
 * misconfiguration into a TOTAL onboarding outage. That is exactly what happened
 * when the production site key / secret / allowed-hostnames fell out of sync — the
 * widget rendered but siteverify rejected every token with `invalid-input-secret`
 * / `invalid-input-response`, so every real signup was blocked with "Couldn't
 * verify you're human" (pt91/pt92). The earlier fix only soft-passed missing-token
 * and network errors; a key/hostname MISMATCH returns success:false, so it kept
 * blocking. Bot protection should degrade, not lock out every legitimate user,
 * when its own infrastructure is misconfigured.
 */
export async function assertHumanOrInfraFailure(
  token: string | undefined | null,
  remoteIp?: string | null,
  context?: string,
): Promise<{ allowed: boolean; result: TurnstileResult }> {
  const result = await verifyTurnstile(token, remoteIp);
  if (result.ok) return { allowed: true, result };

  const ctx = context ? ` (${context})` : "";

  if (result.reason === "missing-token" || result.reason === "error") {
    console.warn(
      `[turnstile] soft-pass on "${result.reason}"${ctx} — token absent or siteverify unreachable; honeypot still applies`,
    );
    return { allowed: true, result };
  }

  // reason === "failed": Cloudflare returned success:false. Only a code we don't
  // recognise as a config/infra/token problem is treated as a real reject.
  const codes = result.errorCodes ?? [];
  const isInfra =
    codes.length === 0 || codes.every((c) => INFRA_ERROR_CODES.has(c));
  if (isInfra) {
    console.warn(
      `[turnstile] soft-pass on misconfiguration${ctx} — siteverify error-codes: [${codes.join(", ") || "none"}]. Check the Turnstile sitekey/secret are the SAME widget pair and the page hostname is in the widget's allow-list; honeypot still applies`,
    );
    return { allowed: true, result };
  }

  console.warn(
    `[turnstile] BLOCK${ctx} — siteverify rejected the token with error-codes: [${codes.join(", ")}]`,
  );
  return { allowed: false, result };
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
