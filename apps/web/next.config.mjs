/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Photo uploads go through a Server Action and PhotosManager allows up to
    // 8 MB images — the default 1 MB body cap would reject them. Raise it.
    serverActions: { bodySizeLimit: "12mb" },
    // Never reuse dynamic routes from the client Router Cache — otherwise
    // /dashboard (force-dynamic) can show a stale, pre-completion render of the
    // getting-started checklist after finishing setup. Always refetch.
    staleTimes: { dynamic: 0, static: 180 },
  },
};

export default nextConfig;
