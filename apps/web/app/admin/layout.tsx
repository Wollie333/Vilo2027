import { redirect } from "next/navigation";

import {
  AdminAccessDenied,
  AdminMfaRequired,
  readImpersonationCookie,
  requireAdmin,
} from "@/lib/admin";

import { AdminSidebar } from "./_components/AdminSidebar";
import { AdminTopbar } from "./_components/AdminTopbar";
import { ImpersonationBanner } from "./_components/ImpersonationBanner";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AdminAccessDenied) {
      redirect("/login?next=/admin&reason=admin_required");
    }
    if (err instanceof AdminMfaRequired) {
      redirect("/account/mfa-enrol?next=/admin");
    }
    throw err;
  }

  const impersonation = readImpersonationCookie();

  return (
    <div className="flex min-h-screen bg-brand-light text-brand-ink">
      <AdminSidebar role={admin.roleId} email={admin.email} />
      <main className="min-w-0 flex-1">
        <AdminTopbar email={admin.email} role={admin.roleId} />
        {impersonation ? (
          <ImpersonationBanner
            targetUserId={impersonation.targetUserId}
            startedAt={impersonation.startedAt}
          />
        ) : null}
        <div className="px-5 py-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
