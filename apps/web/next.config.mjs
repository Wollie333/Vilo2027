import createNextIntlPlugin from "next-intl/plugin";

// Points the plugin at the request-scoped i18n config (messages per locale).
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Baseline security headers (SECURITY_CHECKLIST §7). Applied to every response.
// These are the "safe" set — they don't depend on per-route allowlists:
//   • X-Frame-Options: SAMEORIGIN — clickjacking guard. NOT `DENY`, because the
//     Brand Studio + Brand Preview iframe the app's OWN pages (same-origin);
//     DENY would break those builder previews. (CSP `frame-ancestors` will
//     refine this in the CSP pass.)
//   • X-Content-Type-Options: nosniff — block MIME sniffing.
//   • Referrer-Policy: strict-origin-when-cross-origin — modern browser default.
//   • Permissions-Policy — the app uses no camera/mic; `geolocation=(self)` keeps
//     the on-page maps working on both the app domain and tenant domains.
//   • Strict-Transport-Security — HSTS WITHOUT `includeSubDomains`/`preload` on
//     purpose: a connected custom domain must not have HTTPS forced onto the
//     host's unrelated subdomains (mail., etc.). Browsers ignore HSTS over plain
//     HTTP, so local dev is unaffected.
// DEFERRED: Content-Security-Policy — it must allow Paystack/PayPal/Supabase/
// OpenStreetMap/YouTube/Turnstile/GA4/Meta and be validated in a real browser,
// so it lands with the Step-1 live-QA pass, not blind.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  experimental: {
    // Photo uploads go through a Server Action and PhotosManager allows up to
    // 8 MB images — the default 1 MB body cap would reject them. Raise it.
    serverActions: { bodySizeLimit: "12mb" },
    // Client Router Cache lifetimes. A short `dynamic` window lets the client
    // reuse a just-visited page for 30s, so bouncing between sidebar items
    // feels instant instead of paying a full server roundtrip every revisit.
    // Mutation flows call router.refresh() (which clears the cache), so edits
    // stay fresh; the one page that can't tolerate a stale render — the
    // /dashboard onboarding checklist — is guarded by <OnboardingFreshness/>,
    // which refetches on mount/focus. See app/dashboard/_components.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default withNextIntl(nextConfig);
