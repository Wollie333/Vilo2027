import { CalendarPlus } from "lucide-react";
import { redirect } from "next/navigation";

import { AppHeader } from "@/app/_components/AppHeader";
import { ClassicShellFrame } from "@/app/_components/ClassicShellFrame";
import { BroadcastBanner } from "@/app/_components/BroadcastBanner";
import { VerifyEmailBanner } from "@/components/auth/VerifyEmailBanner";
import { getCreditBalance, getCreditLedger } from "@/lib/credits/wallet";
import { resolveAccountScope } from "@/lib/host/accountScope";
import { hostHasFeature } from "@/lib/products/featureGate";
import { createServerClient } from "@/lib/supabase/server";

import { QuotesOnlyGuard } from "./_components/QuotesOnlyGuard";

import { AvatarMenu } from "./_components/AvatarMenu";
import { CreditPill, type CreditLedgerRow } from "./_components/CreditPill";
import { EntitySearch } from "./_components/EntitySearch";
import { MobileBottomNav } from "./_components/MobileBottomNav";
import { NotificationBell } from "./_components/notifications/NotificationBell";
import { QuickNavProvider } from "./_components/QuickNavPalette";
import { SavingsBadge } from "./_components/SavingsBadge";
import { Sidebar } from "./_components/Sidebar";
import { DashboardTour } from "./_components/tour/DashboardTour";

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
        .select(
          "id, display_name, handle, avatar_url, account_kind, quote_access, platform_access",
        )
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("user_profiles")
        .select("role, avatar_url, email_verified_at")
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

  // Quote-only accounts (or any host an admin bounced off the platform) get a
  // scoped shell — only the quote surfaces, everything else gated off.
  const scope = resolveAccountScope(
    host as {
      account_kind?: string | null;
      quote_access?: boolean | null;
      platform_access?: boolean | null;
    } | null,
  );
  // Platform staff always keep the full shell (so they can QA host surfaces).
  const quotesOnly = scope.quotesOnly && !isPlatformStaff;

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
  let guestCount = 0;
  // W15 — gate the Channels → Website sidebar row on the live entitlement.
  let canWebsite = false;
  // Looking For — gate the Looking For sidebar section on entitlement.
  let canLookingFor = false;
  // Wielo Credits — host quote-credit balance + recent ledger for the header pill.
  let creditBalance = 0;
  let creditLedger: CreditLedgerRow[] = [];

  if (host) {
    const [
      { count },
      { data: subscription },
      { count: unread },
      { data: guestSummary },
      websiteEnabled,
      lookingForEnabled,
    ] = await Promise.all([
      supabase
        .from("properties")
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
      supabase.rpc("fetch_host_guests_summary", { p_host_id: host.id }),
      hostHasFeature(host.id, "website_builder"),
      hostHasFeature(host.id, "looking_for_access"),
    ]);
    listingCount = count ?? 0;
    plan = subscription?.plan ?? null;
    inboxUnread = unread ?? 0;
    guestCount =
      (guestSummary as { total_count?: number } | null)?.total_count ?? 0;
    canWebsite = websiteEnabled;
    canLookingFor = lookingForEnabled;

    creditBalance = await getCreditBalance(supabase, host.id, "quote");
    creditLedger = (
      await getCreditLedger(supabase, host.id, { purpose: "quote", limit: 8 })
    ).map((r) => ({
      id: r.id,
      delta: r.delta,
      balanceAfter: r.balanceAfter,
      kind: r.kind,
      reason: r.reason,
      createdAt: r.createdAt,
    }));
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
                <SavingsBadge />
                {host ? (
                  <CreditPill balance={creditBalance} ledger={creditLedger} />
                ) : null}
                {host?.handle ? (
                  <a
                    href={`/book/${host.handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open your direct booking link"
                    aria-label="Open your direct booking link"
                    className="inline-flex h-9 w-9 items-center justify-center rounded border border-brand-line bg-white text-brand-ink transition-colors hover:bg-brand-light"
                  >
                    <CalendarPlus className="h-4 w-4" />
                  </a>
                ) : null}
                <NotificationBell />
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
            guestCount={guestCount}
            canWebsite={canWebsite}
            canLookingFor={quotesOnly ? true : canLookingFor}
            quotesOnly={quotesOnly}
          />
        }
        banner={
          <>
            {!(profileRow as { email_verified_at?: string | null } | null)
              ?.email_verified_at ? (
              <VerifyEmailBanner email={user.email ?? ""} />
            ) : null}
            <BroadcastBanner />
          </>
        }
        bottomNav={
          <MobileBottomNav
            canLookingFor={quotesOnly ? true : canLookingFor}
            quotesOnly={quotesOnly}
          />
        }
      >
        {children}
      </ClassicShellFrame>
      <QuotesOnlyGuard active={quotesOnly} />
      <DashboardTour />
    </QuickNavProvider>
  );
}
