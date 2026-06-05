import { redirect } from "next/navigation";

import { BroadcastBanner } from "@/app/_components/BroadcastBanner";
import {
  AdminAccessDenied,
  readImpersonationCookie,
  requireAdmin,
} from "@/lib/admin";
import { createServerClient } from "@/lib/supabase/server";

import {
  SidebarRevealButton,
  SidebarToggleProvider,
} from "@/app/_components/SidebarToggle";

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
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("host_id", hostRow.id);
    listingCount = count ?? 0;
  }
  const hostBlurb = hostRow
    ? `${listingCount} ${listingCount === 1 ? "listing" : "listings"}`
    : null;

  return (
    <SidebarToggleProvider>
      <div className="flex min-h-screen bg-brand-light text-brand-ink">
        <SidebarRevealButton />
        <AdminSidebar
          role={admin.roleId}
          email={admin.email}
          canHost={canHost}
          hostDisplayName={hostRow?.display_name ?? null}
          hostBlurb={hostBlurb}
        />
        <main className="min-w-0 flex-1">
          <AdminTopbar email={admin.email} role={admin.roleId} />
          {impersonation ? (
            <ImpersonationBanner
              targetUserId={impersonation.targetUserId}
              startedAt={impersonation.startedAt}
            />
          ) : null}
          <BroadcastBanner />
          <div className="px-5 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-[1280px]">{children}</div>
          </div>
        </main>
      </div>
    </SidebarToggleProvider>
  );
}
