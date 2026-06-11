import createNextIntlPlugin from "next-intl/plugin";

// Points the plugin at the request-scoped i18n config (messages per locale).
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
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
