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
 */
export type ConfigCheck = {
  key: string;
  label: string;
  present: boolean;
  /** What breaks while it is missing. */
  impact: string;
  severity: "critical" | "warning";
};

export function configHealth(): ConfigCheck[] {
  const has = (k: string) => !!process.env[k]?.trim();

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
    {
      key: "PAYSTACK_WEBHOOK_SECRET",
      label: "Paystack webhook signature",
      present: has("PAYSTACK_WEBHOOK_SECRET"),
      impact: "Paystack webhooks cannot be verified and are refused.",
      severity: "critical",
    },
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
      impact: "robots.txt and sitemap fall back to a hardcoded default.",
      severity: "warning",
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
