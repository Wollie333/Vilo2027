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
const IS_PROD = process.env.NODE_ENV === "production";

// ── Content-Security-Policy ──────────────────────────────────────────────────
// Wielo is MULTI-TENANT: a host's website (served by this same app) can carry
// custom head code, custom CSS and external images. A blind global *enforcing*
// script/style policy would break those sites and the third-party checkout
// widgets. So CSP ships in two parts (the industry-standard safe rollout):
//
//   1. ENFORCED — only the directives that add real protection with ZERO
//      breakage risk for a multi-tenant app: block <base> hijacking, plugins,
//      and cross-origin framing (refines X-Frame-Options), and force https for
//      subresources in prod. None of these touch host custom code.
//   2. REPORT-ONLY — the full allowlist (Paystack/PayPal/Supabase/GA4/Meta/
//      Turnstile/YouTube/Vimeo/Google-Maps/Google-Fonts/OSM). It NEVER blocks;
//      it surfaces violations so the allowlist can be tuned against real traffic
//      (host custom code + live payment flows) before flipping script/style/
//      connect to enforced. Allowlist derived from a full source scan
//      (components/analytics, TurnstileWidget, pay PayButton/PayNowPanel,
//      MapSection, SiteFontLinks, LocationPicker/LocationMap, video embeds).
const CSP_ENFORCE = [
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  ...(IS_PROD ? ["upgrade-insecure-requests"] : []),
].join("; ");

const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // 'unsafe-inline'/'unsafe-eval' reflect today's reality (Next inline bootstrap,
  // pixel snippets, host custom scripts). Tighten to nonces/hashes when host
  // custom-code is sandboxed.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co https://checkout.paystack.com https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://www.paypal.com https://www.paypalobjects.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.paystack.co https://*.google-analytics.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com https://challenges.cloudflare.com https://api-m.paypal.com https://api-m.sandbox.paypal.com",
  "frame-src 'self' https://js.paystack.co https://checkout.paystack.com https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://maps.google.com https://www.google.com https://www.paypal.com",
  "worker-src 'self' blob:",
  "form-action 'self' https://checkout.paystack.com https://www.paypal.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Content-Security-Policy", value: CSP_ENFORCE },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];

// Supabase Storage host (host's uploaded photos/logos) so next/image can
// optimise them. Derived from the public URL when set, with a wildcard
// fallback so it keeps working across environments. `images.unsplash.com`
// covers the design themes' stock photography.
const SUPABASE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname || null;
  } catch {
    return null;
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    // Beta-signup landing → the external Google Form. Covers both the bare path
    // and any locale-prefixed variant (e.g. /en/beta). 302 (permanent: false) so
    // the target can be changed later without browsers caching it forever.
    const BETA_FORM =
      "https://docs.google.com/forms/d/e/1FAIpQLSc46bibCtWXcQi9ybg6oLAWO8DiSqWhNEALzJeXL-IrQ2lLLg/viewform?usp=sharing&ouid=101478690721282291997";
    return [
      { source: "/beta", destination: BETA_FORM, permanent: false },
      { source: "/:locale/beta", destination: BETA_FORM, permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: SUPABASE_HOST ?? "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  experimental: {
    // Photo uploads go through a Server Action and PhotosManager allows up to
    // 8 MB images — the default 1 MB body cap would reject them. Raise it.
    serverActions: { bodySizeLimit: "12mb" },
    // Tree-shake heavy barrel packages so only the icons/charts/primitives a
    // route actually uses are bundled (Next 14.2 modularises these imports).
    // Broadest-reach, lowest-risk bundle win — every page imports from lucide.
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "cmdk",
      "sonner",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-popover",
      "@radix-ui/react-tabs",
    ],
    // Client Router Cache lifetimes. The `dynamic` window lets the client
    // reuse a just-visited page so bouncing between sidebar items feels
    // instant instead of paying a full server roundtrip every revisit.
    // Mutation flows call router.refresh() (which clears the cache), so edits
    // stay fresh; the one page that can't tolerate a stale render — the
    // /dashboard onboarding checklist — is guarded by <OnboardingFreshness/>,
    // which refetches on mount/focus. See app/dashboard/_components.
    staleTimes: { dynamic: 120, static: 300 },
  },
};

export default withNextIntl(nextConfig);
