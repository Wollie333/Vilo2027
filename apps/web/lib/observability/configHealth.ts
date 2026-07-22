import "server-only";

/**
 * Which critical settings are actually present on THIS server.
 *
 * Written because the same question kept being answered by guesswork: reading
 * apps/web/.env.local locally says nothing about Vercel, and reporting a local
 * gap as a production fact wasted real time. This reads the environment the
 * running server actually has, so loading it on production is evidence rather
 * than inference.
 *
 * Reports PRESENCE ONLY — never a value, never a prefix, never a length that
 * could narrow a secret. A page that helps you audit secrets must not become a
 * way to read them.
 *
 * ONE deliberate exception: `NEXT_PUBLIC_*` URL settings also report their
 * VALUE. They are not secrets — Next.js inlines them into the browser bundle,
 * so anyone can already read them from the page source. And presence alone is
 * useless for a URL: it can be set and still be WRONG (a preview deployment
 * URL, a stale domain, a trailing slash), which is exactly the failure that put
 * a dead `wieloplatform.com` on every button in every email. Only keys listed
 * in PUBLIC_URL_KEYS ever expose a value.
 */
export type ConfigCheck = {
  key: string;
  label: string;
  present: boolean;
  /**
   * The configured value — populated ONLY for the non-secret NEXT_PUBLIC_ URL
   * keys. Undefined for every secret, always.
   */
  value?: string;
  /** What breaks while it is missing. */
  impact: string;
  severity: "critical" | "warning";
};

/** The only keys whose value may be shown. Both are already public. */
const PUBLIC_URL_KEYS = new Set([
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
]);

export function configHealth(): ConfigCheck[] {
  const has = (k: string) => !!process.env[k]?.trim();
  const publicValue = (k: string) =>
    PUBLIC_URL_KEYS.has(k) ? (process.env[k]?.trim() ?? undefined) : undefined;

  return [
    {
      key: "RESEND_API_KEY",
      label: "Email sending",
      present: has("RESEND_API_KEY"),
      impact: "No email is sent at all — verification, bookings, payouts.",
      severity: "critical",
    },
    {
      key: "EMAIL_FROM_ADDRESS",
      label: "Email sender address",
      present: has("EMAIL_FROM_ADDRESS"),
      impact:
        "Falls back to Resend's sandbox sender, which delivers only to the Resend account owner.",
      severity: "critical",
    },
    {
      key: "PAYMENT_CIPHER_KEY",
      label: "Gateway secret encryption",
      present: has("PAYMENT_CIPHER_KEY"),
      impact:
        "Host payment-gateway secrets are stored in plain text. Note: setting this does NOT encrypt rows already stored — run scripts/encrypt-secrets-backfill.mjs.",
      severity: "critical",
    },
    {
      key: "BANKING_CIPHER_KEY",
      label: "Bank account encryption",
      present: has("BANKING_CIPHER_KEY"),
      impact:
        "Bank account numbers are stored in plain text. Existing rows need the backfill script.",
      severity: "critical",
    },
    // NO Paystack row here, deliberately — do not add one back.
    //
    // This panel reported a red, critical "Paystack webhooks cannot be verified
    // and are refused" on production, which was false. It checked
    // PAYSTACK_WEBHOOK_SECRET, a name NO code reads: signatures are verified in
    // the paystack-webhook EDGE FUNCTION using PAYSTACK_SECRET_KEY from the
    // SUPABASE environment (falling back to platform_payment_settings). That is
    // a different runtime, so this server can never see it and the check could
    // only ever fail.
    //
    // A monitoring panel that cries wolf is worse than no panel: it sends you
    // chasing a non-problem and teaches you to ignore the red dots that matter.
    // Anything living in Supabase or an Edge Function does not belong here.
    {
      key: "PAYPAL_WEBHOOK_ID",
      label: "PayPal webhook verification",
      present: has("PAYPAL_WEBHOOK_ID"),
      impact:
        "Every PayPal subscription event is rejected. PayPal recurring is deliberately OFF until this is set.",
      severity: "warning",
    },
    {
      key: "TURNSTILE_SECRET_KEY",
      label: "Bot protection",
      present: has("TURNSTILE_SECRET_KEY"),
      impact: "Turnstile is inert — signup forms have no CAPTCHA.",
      severity: "warning",
    },
    {
      key: "NEXT_PUBLIC_SITE_URL",
      label: "Canonical site URL",
      present: has("NEXT_PUBLIC_SITE_URL"),
      value: publicValue("NEXT_PUBLIC_SITE_URL"),
      impact:
        "robots.txt, the sitemap and the canonical/OG tags fall back to https://wielo.co.za. Harmless in production; wrong on a preview deployment.",
      severity: "warning",
    },
    {
      key: "NEXT_PUBLIC_APP_URL",
      label: "App URL used in emails",
      present: has("NEXT_PUBLIC_APP_URL"),
      value: publicValue("NEXT_PUBLIC_APP_URL"),
      impact:
        "Every link and button in every email is built from this. Check the VALUE, not just that it is set — a wrong or stale URL still sends, it just sends people nowhere.",
      severity: "critical",
    },
    {
      key: "EMAIL_VERIFY_SECRET",
      label: "Email-verify signing key",
      present: has("EMAIL_VERIFY_SECRET"),
      impact:
        "Falls back to a key derived from the service-role key. Works, but cannot be rotated independently.",
      severity: "warning",
    },
    {
      key: "RATE_LIMIT_SALT",
      label: "Rate-limit salt",
      present: has("RATE_LIMIT_SALT"),
      impact:
        "Falls back to the service-role key. Works, but rotating database access resets every rate-limit bucket.",
      severity: "warning",
    },
  ];
}
