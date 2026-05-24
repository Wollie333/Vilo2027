/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is only needed for the Docker build; the Dockerfile
  // sets NEXT_OUTPUT=standalone. Disabled by default so local `pnpm build`
  // on Windows doesn't fail on symlink EPERM errors.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

export default nextConfig;
