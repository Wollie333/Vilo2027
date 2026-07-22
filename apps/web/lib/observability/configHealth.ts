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
export type ConfigGroup =
  | "Core"
  | "Email"
  | "Money"
  | "Signing keys"
  | "Integrations"
  | "Workers";

export type ConfigCheck = {
  key: string;
  label: string;
  group: ConfigGroup;
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

  const rows: ConfigCheck[] = [
    // ── Core ────────────────────────────────────────────────────────────
    // These three are self-proving: without them this page could not have
    // rendered at all. Listed anyway so the inventory is complete rather than
    // silently assuming the reader knows that.
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      label: "Supabase URL",
      group: "Core",
      present: has("NEXT_PUBLIC_SUPABASE_URL"),
      impact: "Nothing works. If this page loaded, it is set.",
      severity: "critical",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      label: "Supabase anon key",
      group: "Core",
      present: has("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      impact: "No signed-out page can read anything.",
      severity: "critical",
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      label: "Supabase service role key",
      group: "Core",
      present: has("SUPABASE_SERVICE_ROLE_KEY"),
      impact: "Every admin page, worker and server action fails.",
      severity: "critical",
    },
    {
      key: "NEXT_PUBLIC_SITE_URL",
      label: "Canonical site URL",
      group: "Core",
      present: has("NEXT_PUBLIC_SITE_URL"),
      value: publicValue("NEXT_PUBLIC_SITE_URL"),
      impact:
        "robots.txt, the sitemap and the canonical/OG tags fall back to https://wielo.co.za. Harmless in production; wrong on a preview deployment.",
      severity: "warning",
    },
    {
      key: "NEXT_PUBLIC_APP_URL",
      label: "App URL used in emails",
      group: "Core",
      present: has("NEXT_PUBLIC_APP_URL"),
      value: publicValue("NEXT_PUBLIC_APP_URL"),
      impact:
        "Every link and button in every email is built from this. Check the VALUE, not just that it is set — a wrong or stale URL still sends, it just sends people nowhere.",
      severity: "critical",
    },
    {
      key: "NEXT_PUBLIC_ROOT_DOMAIN",
      label: "Root domain for host subdomains",
      group: "Core",
      present: has("NEXT_PUBLIC_ROOT_DOMAIN"),
      impact:
        "Host website subdomains cannot be built or validated. Only matters once hosts publish their own sites.",
      severity: "warning",
    },

    // ── Email ───────────────────────────────────────────────────────────
    {
      key: "RESEND_API_KEY",
      label: "Email sending",
      group: "Email",
      present: has("RESEND_API_KEY"),
      impact: "No email is sent at all — verification, bookings, payouts.",
      severity: "critical",
    },
    {
      key: "EMAIL_FROM_ADDRESS",
      label: "Email sender address",
      group: "Email",
      present: has("EMAIL_FROM_ADDRESS"),
      impact:
        "Falls back to Resend's sandbox sender, which delivers only to the Resend account owner.",
      severity: "critical",
    },

    // ── Money ───────────────────────────────────────────────────────────
    // NO PAYSTACK_SECRET_KEY row, deliberately — the second Paystack row this
    // panel has had to drop, for the same underlying reason.
    //
    // The platform Paystack secret lives in the DATABASE
    // (platform_payment_settings, set from Admin → Payments, mode-aware and
    // encrypted at rest). getPlatformPaystackSecret() reads that FIRST and only
    // falls back to the env var if paystack_enabled is false. So the env var was
    // never read in practice, and the var itself has now been removed from Vercel:
    // an unread fallback is a place a misconfiguration can hide, because
    // disabling Paystack in admin would have silently used a stale env key
    // instead of failing.
    //
    // A row here would therefore report on something that neither exists nor
    // matters, and this panel is only worth trusting if every red dot is real.
    // The check that WOULD be meaningful — "is platform billing configured?" —
    // needs a DB read, and configHealth() is deliberately synchronous and
    // env-only. Surface it on the Payments admin page instead, next to the
    // setting itself.
    {
      key: "PAYMENT_CIPHER_KEY",
      label: "Gateway secret encryption",
      group: "Money",
      present: has("PAYMENT_CIPHER_KEY"),
      impact:
        "Host payment-gateway secrets are stored in plain text. Note: setting this does NOT encrypt rows already stored — run scripts/encrypt-secrets-backfill.mjs.",
      severity: "critical",
    },
    {
      key: "BANKING_CIPHER_KEY",
      label: "Bank account encryption",
      group: "Money",
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
      group: "Money",
      present: has("PAYPAL_WEBHOOK_ID"),
      impact:
        "Every PayPal subscription event is rejected. PayPal recurring is deliberately OFF until this is set.",
      severity: "warning",
    },

    // ── Signing keys ────────────────────────────────────────────────────
    // All of these DERIVE from the service-role key when unset (see
    // lib/auth/tokenSecret.ts), so nothing is broken without them. What you
    // lose is independent rotation: rotating database access invalidates every
    // outstanding link at the same time.
    {
      key: "EMAIL_VERIFY_SECRET",
      label: "Email-verify links",
      group: "Signing keys",
      present: has("EMAIL_VERIFY_SECRET"),
      impact:
        "Derived from the service-role key. Works, but cannot be rotated independently.",
      severity: "warning",
    },
    {
      key: "REVIEW_TOKEN_SECRET",
      label: "Review links",
      group: "Signing keys",
      present: has("REVIEW_TOKEN_SECRET"),
      impact: "Derived from the service-role key. Works; no separate rotation.",
      severity: "warning",
    },
    {
      key: "STATEMENT_TOKEN_SECRET",
      label: "Statement / document links",
      group: "Signing keys",
      present: has("STATEMENT_TOKEN_SECRET"),
      impact: "Derived from the service-role key. Works; no separate rotation.",
      severity: "warning",
    },
    {
      key: "IMPERSONATION_TOKEN_SECRET",
      label: "Admin impersonation",
      group: "Signing keys",
      present: has("IMPERSONATION_TOKEN_SECRET"),
      impact:
        "Derived from the service-role key. This one signs staff-acting-as-user sessions, so it is the most worth isolating.",
      severity: "warning",
    },
    {
      key: "ICAL_TOKEN_SECRET",
      label: "Calendar feed links",
      group: "Signing keys",
      present: has("ICAL_TOKEN_SECRET"),
      impact:
        "Derived from the service-role key. Rotating database access would invalidate every calendar URL hosts have already given to Airbnb and Booking.com.",
      severity: "warning",
    },
    {
      key: "RATE_LIMIT_SALT",
      label: "Rate-limit salt",
      group: "Signing keys",
      present: has("RATE_LIMIT_SALT"),
      impact:
        "Falls back to the service-role key. Works, but rotating database access resets every rate-limit bucket.",
      severity: "warning",
    },

    // ── Integrations ────────────────────────────────────────────────────
    {
      key: "GOOGLE_MAPS_API_KEY",
      label: "Address autocomplete",
      group: "Integrations",
      present: has("GOOGLE_MAPS_API_KEY"),
      impact:
        "Address lookup returns nothing and hosts must type the whole address by hand. Needs both Places API (New) and Geocoding API enabled on the key.",
      severity: "warning",
    },
    {
      key: "TURNSTILE_SECRET_KEY",
      label: "Bot protection (server)",
      group: "Integrations",
      // Either name counts — Cloudflare's own setup flow says TURNSTILE_SECRET.
      present: has("TURNSTILE_SECRET_KEY") || has("TURNSTILE_SECRET"),
      impact:
        "Verification FAILS OPEN: the widget renders and the server accepts any answer, so visitors solve a challenge that stops nobody. Set TURNSTILE_SECRET_KEY (or TURNSTILE_SECRET) and redeploy.",
      severity: "critical",
    },
    {
      key: "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
      label: "Bot protection (widget)",
      group: "Integrations",
      present: has("NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
      impact:
        "No CAPTCHA widget renders. Both this and the secret are needed — one alone does nothing.",
      severity: "warning",
    },
    {
      key: "OAUTH_CIPHER_KEY",
      label: "External-review token encryption",
      group: "Integrations",
      present: has("OAUTH_CIPHER_KEY"),
      impact:
        "Google/Facebook review tokens are stored in plain text. Only matters once external reviews are connected.",
      severity: "warning",
    },
    {
      key: "GOOGLE_REVIEWS_CLIENT_ID",
      label: "Google reviews",
      group: "Integrations",
      present: has("GOOGLE_REVIEWS_CLIENT_ID"),
      impact: "Hosts cannot connect Google reviews. Feature is optional.",
      severity: "warning",
    },
    {
      key: "FACEBOOK_APP_ID",
      label: "Facebook reviews",
      group: "Integrations",
      present: has("FACEBOOK_APP_ID"),
      impact: "Hosts cannot connect Facebook reviews. Feature is optional.",
      severity: "warning",
    },

    // ── Workers ─────────────────────────────────────────────────────────
    // Bearer secrets the cron routes require. A MISSING one does not open the
    // route — the route refuses every call — so the job silently never runs.
    {
      key: "EMAIL_WORKER_SECRET",
      label: "Email queue worker",
      group: "Workers",
      present: has("EMAIL_WORKER_SECRET"),
      impact:
        "The queue drain route refuses every call, so queued email is never sent. Must match the value the cron sends.",
      severity: "critical",
    },
    {
      key: "ICAL_SYNC_WORKER_SECRET",
      label: "Calendar sync worker",
      group: "Workers",
      present: has("ICAL_SYNC_WORKER_SECRET"),
      impact:
        "Calendar imports never run, so external bookings stop blocking dates — a double-booking risk.",
      severity: "critical",
    },
    {
      key: "EXTERNAL_REVIEWS_WORKER_SECRET",
      label: "External reviews worker",
      group: "Workers",
      present: has("EXTERNAL_REVIEWS_WORKER_SECRET"),
      impact: "External reviews are never refreshed. Optional feature.",
      severity: "warning",
    },
  ];

  return rows;
}

/** Stable display order for the groups. */
export const CONFIG_GROUPS: ConfigGroup[] = [
  "Core",
  "Email",
  "Money",
  "Workers",
  "Signing keys",
  "Integrations",
];
