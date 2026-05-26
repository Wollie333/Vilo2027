import { redirect } from "next/navigation";

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
        .select("id")
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
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  const displayName = profile?.full_name ?? user.email ?? "Guest";

  return (
    <div className="flex min-h-screen bg-brand-light text-brand-ink">
      <PortalSidebar
        displayName={displayName}
        avatarUrl={profile?.avatar_url ?? null}
        email={user.email ?? ""}
        canHost={Boolean(host?.id)}
        canAdmin={staff?.is_active === true}
      />
      <main className="min-w-0 flex-1 pb-20 lg:pb-0">
        <div className="px-5 py-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
