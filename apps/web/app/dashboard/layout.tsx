import { redirect } from "next/navigation";

import { BroadcastBanner } from "@/app/_components/BroadcastBanner";
import { createServerClient } from "@/lib/supabase/server";

import { MobileBottomNav } from "./_components/MobileBottomNav";
import { QuickNavProvider } from "./_components/QuickNavPalette";
import { Sidebar } from "./_components/Sidebar";
import { Topbar } from "./_components/Topbar";

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

  const { data: host } = await supabase
    .from("hosts")
    .select("id, display_name, handle")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  // Routing priority (highest → lowest):
  //   3. Platform staff           → /admin entry point (allowed through
  //                                  here so they can QA the host surface).
  //   2. Hosts row OR
  //      user_profiles.role='host' → /dashboard (allow through; the page
  //                                  itself renders an onboarding empty
  //                                  state when host is null).
  //   1. Plain guest               → /portal.
  //
  // The dashboard PAGE handles host = null gracefully ("Welcome to Vilo.
  // Finish onboarding to take your first booking."), so we don't bounce
  // hosts mid-onboarding away. We only redirect users who are clearly
  // not hosts at all.
  if (!host) {
    const [{ data: staffRow }, { data: profileRow }] = await Promise.all([
      supabase
        .from("platform_staff")
        .select("is_active")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle(),
    ]);
    const isStaff = staffRow?.is_active === true;
    const role = (profileRow?.role as string | undefined) ?? "guest";
    const isHostByRole = role === "host";
    if (!isStaff && !isHostByRole) {
      redirect("/portal");
    }
  }

  let listingCount = 0;
  let plan: string | null = null;

  if (host) {
    const [{ count }, { data: subscription }] = await Promise.all([
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("host_id", host.id),
      supabase
        .from("subscriptions")
        .select("plan")
        .eq("host_id", host.id)
        .maybeSingle(),
    ]);
    listingCount = count ?? 0;
    plan = subscription?.plan ?? null;
  }

  // If the user is an active Vilo staff member, surface a "Switch to admin"
  // toggle in the topbar. Mirrors the existing "Back to host dashboard" link
  // on the admin sidebar so staff can move both ways.
  const { data: staff } = await supabase
    .from("platform_staff")
    .select("is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  const isPlatformStaff = staff?.is_active === true;

  const initials = (host?.display_name || user.email || "??")
    .slice(0, 2)
    .toUpperCase();

  return (
    <QuickNavProvider>
      <div className="flex min-h-screen bg-brand-light text-brand-ink">
        <Sidebar
          host={host ? { ...host, listingCount } : null}
          plan={plan}
          canAdmin={isPlatformStaff}
        />
        <main className="min-w-0 flex-1 pb-20 lg:pb-0">
          <Topbar
            email={user.email ?? ""}
            initials={initials}
            isPlatformStaff={isPlatformStaff}
          />
          <BroadcastBanner />
          <div className="px-5 py-6 lg:px-8 lg:py-8">{children}</div>
        </main>
        <MobileBottomNav />
      </div>
    </QuickNavProvider>
  );
}
