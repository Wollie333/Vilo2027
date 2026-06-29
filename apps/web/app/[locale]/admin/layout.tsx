import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { AppHeader } from "@/app/_components/AppHeader";
import { BroadcastBanner } from "@/app/_components/BroadcastBanner";
import { ClassicShellFrame } from "@/app/_components/ClassicShellFrame";
import { AvatarMenu } from "@/app/[locale]/dashboard/_components/AvatarMenu";
import {
  AdminAccessDenied,
  readImpersonationCookie,
  requireAdmin,
} from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { AdminSidebar } from "./_components/AdminSidebar";
import { ImpersonationBanner } from "./_components/ImpersonationBanner";

function prettyRole(role: string): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "support_agent":
      return "Support Agent";
    case "finance":
      return "Finance";
    case "content_mod":
      return "Content Moderator";
    case "ops":
      return "Operations";
    default:
      return role;
  }
}

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

  // canHost for the WorkspaceSwitcher: hosts row OR user_profiles.role='host'.
  // Mid-signup hosts get the toggle too. If a hosts row exists, also pass
  // the display_name + listing count so the switcher pill is identity-rich
  // ("Featherstone Guesthouse · 3 listings") instead of generic.
  const supabase = createServerClient();
  const [{ data: hostRow }, { data: profileRow }] = await Promise.all([
    supabase
      .from("hosts")
      .select("id, display_name")
      .eq("user_id", admin.userId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("role")
      .eq("id", admin.userId)
      .maybeSingle(),
  ]);
  const canHost =
    Boolean(hostRow?.id) || (profileRow?.role as string | undefined) === "host";

  let listingCount = 0;
  if (hostRow?.id) {
    const { count } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("host_id", hostRow.id);
    listingCount = count ?? 0;
  }
  const hostBlurb = hostRow
    ? `${listingCount} ${listingCount === 1 ? "listing" : "listings"}`
    : null;

  // The staff member's permission keys (service-role read — admin_role_permissions
  // is super-admin-only under RLS) → the sidebar only shows what their role can open.
  const { data: permRows } = await createAdminClient()
    .from("admin_role_permissions")
    .select("permission_key")
    .eq("role_id", admin.roleId);
  const permissions = (permRows ?? []).map((r) => r.permission_key as string);

  return (
    <ClassicShellFrame
      header={
        <AppHeader
          brandHref="/admin"
          actions={
            <>
              <span className="hidden items-center gap-1.5 rounded-pill border border-brand-line bg-brand-light px-3 py-1.5 text-[12px] font-medium text-brand-mute sm:inline-flex">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-primary" />
                {prettyRole(admin.roleId)} session
              </span>
              <AvatarMenu
                initials={admin.email.slice(0, 2).toUpperCase()}
                email={admin.email}
                avatarUrl={null}
                profileHref="/dashboard/settings"
                settingsHref="/admin/platform/settings"
              />
            </>
          }
        />
      }
      sidebar={
        <AdminSidebar
          role={admin.roleId}
          email={admin.email}
          canHost={canHost}
          hostDisplayName={hostRow?.display_name ?? null}
          hostBlurb={hostBlurb}
          permissions={permissions}
        />
      }
      banner={
        <>
          {impersonation ? (
            <ImpersonationBanner
              targetUserId={impersonation.targetUserId}
              startedAt={impersonation.startedAt}
            />
          ) : null}
          <BroadcastBanner />
        </>
      }
    >
      {children}
    </ClassicShellFrame>
  );
}
