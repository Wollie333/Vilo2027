import { redirect } from "next/navigation";

import { BroadcastBanner } from "@/app/_components/BroadcastBanner";
import {
  AdminAccessDenied,
  readImpersonationCookie,
  requireAdmin,
} from "@/lib/admin";
import { createServerClient } from "@/lib/supabase/server";

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
    throw err;
  }

  const impersonation = readImpersonationCookie();

  // Does this admin user also have a hosts row? Drives whether the
  // WorkspaceSwitcher offers "Host workspace" as an option.
  const supabase = createServerClient();
  const { data: hostRow } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", admin.userId)
    .is("deleted_at", null)
    .maybeSingle();
  const canHost = Boolean(hostRow?.id);

  return (
    <div className="flex min-h-screen bg-brand-light text-brand-ink">
      <AdminSidebar role={admin.roleId} email={admin.email} canHost={canHost} />
      <main className="min-w-0 flex-1">
        <AdminTopbar email={admin.email} role={admin.roleId} />
        {impersonation ? (
          <ImpersonationBanner
            targetUserId={impersonation.targetUserId}
            startedAt={impersonation.startedAt}
          />
        ) : null}
        <BroadcastBanner />
        <div className="px-5 py-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
