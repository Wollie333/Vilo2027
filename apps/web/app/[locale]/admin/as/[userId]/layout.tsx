import { redirect } from "next/navigation";

import { readImpersonationCookie, requirePermission } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * Read-only impersonation subtree. Guards:
 *   1. Caller must hold `users.impersonate`.
 *   2. A valid impersonation cookie must exist AND match the URL param.
 *      If they don't match (stale cookie, copy/paste link), redirect to /admin.
 *
 * This subtree contains NO mutation actions by construction — view-only is
 * structural, not a convention.
 */
export default async function ImpersonationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { userId: string };
}) {
  await requirePermission("users.impersonate");

  const ctx = readImpersonationCookie();
  if (!ctx || ctx.targetUserId !== params.userId) {
    redirect("/admin?reason=impersonation_invalid");
  }

  return <>{children}</>;
}
