import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/app/_components/AppHeader";
import { ClassicShellFrame } from "@/app/_components/ClassicShellFrame";
import { BroadcastBanner } from "@/app/_components/BroadcastBanner";
import { createServerClient } from "@/lib/supabase/server";

import { AvatarMenu } from "./_components/AvatarMenu";
import { EntitySearch } from "./_components/EntitySearch";
import { MobileBottomNav } from "./_components/MobileBottomNav";
import { NotificationBell } from "./_components/notifications/NotificationBell";
import { QuickNavProvider } from "./_components/QuickNavPalette";
import { Sidebar } from "./_components/Sidebar";

// Full-bleed routes (Inbox) come from the shared rule in
// @/lib/layout/fullBleed so host and guest dashboards stay in lockstep.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const [{ data: host }, { data: profileRow }, { data: staffRow }] =
    await Promise.all([
      supabase
        .from("hosts")
        .select("id, display_name, handle, avatar_url")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("user_profiles")
        .select("role, avatar_url")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("platform_staff")
        .select("is_active")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const role = (profileRow?.role as string | undefined) ?? "guest";
  const isPlatformStaff = staffRow?.is_active === true;
  const isHostByRole = role === "host";

  // Routing priority (highest → lowest):
  //   3. Platform staff           → allowed through (so they can QA).
  //   2. Hosts row OR role='host' → /dashboard (the page renders an empty
  //                                  "Finish onboarding" state for hosts
  //                                  mid-signup).
  //   1. Plain guest               → /portal.
  if (!host && !isPlatformStaff && !isHostByRole) {
    redirect("/portal");
  }

  let listingCount = 0;
  let plan: string | null = null;
  let inboxUnread = 0;

  if (host) {
    const [{ count }, { data: subscription }, { count: unread }] =
      await Promise.all([
        supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("host_id", host.id),
        supabase
          .from("subscriptions")
          .select("plan")
          .eq("host_id", host.id)
          .maybeSingle(),
        supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("host_id", host.id)
          .gt("unread_host", 0),
      ]);
    listingCount = count ?? 0;
    plan = subscription?.plan ?? null;
    inboxUnread = unread ?? 0;
  }

  // canHost for the workspace switcher: true if they have a hosts row OR
  // their user_profiles.role is 'host' (signed up as a host but didn't
  // finish onboarding). Either way they belong on /dashboard.
  const canHost = Boolean(host) || isHostByRole;

  const initials = (host?.display_name || user.email || "??")
    .slice(0, 2)
    .toUpperCase();

  // The full-bleed decision is reactive to the route (see ClassicShellFrame) —
  // it must re-evaluate on client navigation, which a server layout does not.
  const avatarUrl =
    ((profileRow?.avatar_url as string | null) ||
      ((host as { avatar_url?: string | null } | null)?.avatar_url as
        | string
        | null)) ??
    null;

  return (
    <QuickNavProvider>
      <ClassicShellFrame
        header={
          <AppHeader
            brandHref="/dashboard"
            search={<EntitySearch />}
            actions={
              <>
                <NotificationBell />
                <Link
                  href="/dashboard/bookings/new"
                  className="hidden items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-secondary sm:inline-flex"
                >
                  <Plus className="h-4 w-4" />
                  New booking
                </Link>
                <AvatarMenu
                  initials={initials}
                  email={user.email ?? ""}
                  avatarUrl={avatarUrl}
                />
              </>
            }
          />
        }
        sidebar={
          <Sidebar
            host={host ? { ...host, listingCount } : null}
            plan={plan}
            canHost={canHost}
            canAdmin={isPlatformStaff}
            inboxUnread={inboxUnread}
          />
        }
        banner={<BroadcastBanner />}
        bottomNav={<MobileBottomNav />}
      >
        {children}
      </ClassicShellFrame>
    </QuickNavProvider>
  );
}
