import { assertInternalRoute } from "@/lib/security/internalRoutes";

// Internal build harness — staff only in production. Gating here rather than in
// each page means anything added below this directory is covered by default.
export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertInternalRoute();
  return <>{children}</>;
}
