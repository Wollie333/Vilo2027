import { redirect } from "next/navigation";

import { AppShellFrame } from "@/app/_components/AppShellFrame";
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
  const [{ data: host }, { data: staff }, { data: profile }] =
    await Promise.all([
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

  // Full-bleed decision is reactive to the route inside AppShellFrame (a server
  // layout can't recompute it on client navigation — that caused stuck layouts).
  return (
    <AppShellFrame
      sidebar={
        <PortalSidebar
          displayName={displayName}
          avatarUrl={profile?.avatar_url ?? null}
          email={user.email ?? ""}
          canHost={canHost}
          canAdmin={staff?.is_active === true}
          hostDisplayName={host?.display_name ?? null}
          hostBlurb={hostBlurb}
        />
      }
    >
      {children}
    </AppShellFrame>
  );
}
