import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BroadcastBanner } from "@/app/_components/BroadcastBanner";
import { isFullBleedRoute } from "@/lib/layout/fullBleed";
import { createServerClient } from "@/lib/supabase/server";

import { MobileBottomNav } from "./_components/MobileBottomNav";
import { QuickNavProvider } from "./_components/QuickNavPalette";
import { Sidebar } from "./_components/Sidebar";
import { Topbar } from "./_components/Topbar";

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

  // canHost for the workspace switcher: true if they have a hosts row OR
  // their user_profiles.role is 'host' (signed up as a host but didn't
  // finish onboarding). Either way they belong on /dashboard.
  const canHost = Boolean(host) || isHostByRole;

  const planLabel =
    plan === "free"
      ? "Free"
      : plan
        ? plan[0].toUpperCase() + plan.slice(1)
        : "—";
  const hostBlurb = host
    ? `${listingCount} ${listingCount === 1 ? "listing" : "listings"} · ${planLabel}`
    : null;

  const initials = (host?.display_name || user.email || "??")
    .slice(0, 2)
    .toUpperCase();

  // Full-bleed pages (inbox) need a viewport-bounded height chain so their
  // internal scroll regions resolve and elements like the chat composer pin
  // to the bottom. Normal pages stay growable (min-h-screen) and scroll the
  // page naturally.
  const fullBleed = isFullBleedRoute(headers().get("x-pathname"));

  return (
    <QuickNavProvider>
      <div
        className={`flex bg-brand-light text-brand-ink ${
          fullBleed ? "h-[100dvh] overflow-hidden" : "min-h-screen"
        }`}
      >
        <Sidebar
          host={host ? { ...host, listingCount } : null}
          plan={plan}
          canHost={canHost}
          canAdmin={isPlatformStaff}
        />
        <main
          className={`flex min-w-0 flex-1 flex-col ${
            fullBleed
              ? "min-h-0 overflow-hidden pb-16 lg:pb-0"
              : "pb-20 lg:pb-0"
          }`}
        >
          <Topbar
            email={user.email ?? ""}
            initials={initials}
            isPlatformStaff={isPlatformStaff}
            canHost={canHost}
            hostDisplayName={host?.display_name ?? null}
            hostBlurb={hostBlurb}
            avatarUrl={
              ((profileRow?.avatar_url as string | null) ||
                ((host as { avatar_url?: string | null } | null)?.avatar_url as
                  | string
                  | null)) ??
              null
            }
          />
          <BroadcastBanner />
          {fullBleed ? (
            // Full-bleed: no padding, no max-w cap. This is a bounded flex
            // column (min-h-0) so the page's own `flex-1` child fills the
            // remaining height and its internal scroll regions / pinned
            // composer resolve correctly.
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          ) : (
            <div className="px-5 py-6 lg:px-8 lg:py-8">
              <div className="mx-auto max-w-[1280px]">{children}</div>
            </div>
          )}
        </main>
        <MobileBottomNav />
      </div>
    </QuickNavProvider>
  );
}
