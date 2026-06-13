import { Bell, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";

import { AppHeader } from "@/app/_components/AppHeader";
import { ClassicShellFrame } from "@/app/_components/ClassicShellFrame";
import { AvatarMenu } from "@/app/[locale]/dashboard/_components/AvatarMenu";
import { createServerClient } from "@/lib/supabase/server";

import { PortalSidebar } from "./_components/PortalSidebar";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/portal");
  }

  // Anyone authenticated can use /portal — it's the guest-side
  // experience. Hosts who want to act as guests (browse listings, view
  // their own bookings as a traveller) hop in via the WorkspaceSwitcher
  // at the top of the sidebar. Platform staff get the same toggle.
  const [
    { data: host },
    { data: staff },
    { data: profile },
    { count: unreadNotifications },
  ] = await Promise.all([
    supabase
      .from("hosts")
      .select("id, display_name")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("platform_staff")
      .select("is_active")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("full_name, avatar_url, role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("in_app_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
  ]);

  const displayName = profile?.full_name ?? user.email ?? "Guest";
  // canHost = hosts row OR user_profiles.role='host'. Lets the switcher
  // surface "Host workspace" for mid-signup hosts whose hosts row wasn't
  // created yet.
  const canHost =
    Boolean(host?.id) || (profile?.role as string | undefined) === "host";

  // For the switcher pill: count listings so the host-workspace blurb
  // shows their actual identity ("2 listings") instead of the generic.
  let listingCount = 0;
  if (host?.id) {
    const { count } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("host_id", host.id);
    listingCount = count ?? 0;
  }
  const hostBlurb = host
    ? `${listingCount} ${listingCount === 1 ? "listing" : "listings"}`
    : null;

  const initials = displayName.slice(0, 2).toUpperCase();

  // Full-bleed decision is reactive to the route inside ClassicShellFrame (a
  // server layout can't recompute it on client navigation).
  return (
    <ClassicShellFrame
      header={
        <AppHeader
          brandHref="/portal"
          search={
            <Link
              href="/portal/browse"
              className="flex h-11 w-full items-center gap-2.5 rounded-pill border border-transparent bg-[#F4F8F5] px-4 text-sm text-brand-mute transition-colors hover:border-brand-line hover:bg-white"
            >
              <Search className="h-4 w-4" />
              <span>Search stays…</span>
            </Link>
          }
          actions={
            <>
              <Link
                href="/portal/notifications"
                aria-label="Notifications"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-brand-mute transition-colors hover:bg-brand-light hover:text-brand-ink"
              >
                <Bell className="h-5 w-5" />
                {unreadNotifications && unreadNotifications > 0 ? (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-status-cancelled ring-2 ring-white" />
                ) : null}
              </Link>
              <AvatarMenu
                initials={initials}
                email={user.email ?? ""}
                avatarUrl={profile?.avatar_url ?? null}
                profileHref="/portal/settings"
                settingsHref="/portal/settings"
              />
            </>
          }
        />
      }
      sidebar={
        <PortalSidebar
          displayName={displayName}
          avatarUrl={profile?.avatar_url ?? null}
          email={user.email ?? ""}
          canHost={canHost}
          canAdmin={staff?.is_active === true}
          hostDisplayName={host?.display_name ?? null}
          hostBlurb={hostBlurb}
          unreadNotifications={unreadNotifications ?? 0}
        />
      }
    >
      {children}
    </ClassicShellFrame>
  );
}
