/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is only needed for the Docker build; the Dockerfile
  // sets NEXT_OUTPUT=standalone. Disabled by default so local `pnpm build`
  // on Windows doesn't fail on symlink EPERM errors.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  experimental: {
    // Photo uploads go through a Server Action (uploadListingPhotoAction) and
    // PhotosManager allows up to 8 MB images — the default 1 MB body cap would
    // reject them before the action runs. Raise it with headroom.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
