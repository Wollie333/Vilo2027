import { CalendarPlus } from "lucide-react";
import { redirect } from "next/navigation";

import { AppHeader } from "@/app/_components/AppHeader";
import { ClassicShellFrame } from "@/app/_components/ClassicShellFrame";
import { BroadcastBanner } from "@/app/_components/BroadcastBanner";
import { PublishListingReminder } from "./_components/PublishListingReminder";
import { TwoFactorNudge } from "@/components/auth/TwoFactorNudge";
import { EmailVerifyGate } from "@/components/auth/EmailVerifyGate";
import { VerifyEmailBanner } from "@/components/auth/VerifyEmailBanner";
import {
  getHostTrialWidget,
  type HostTrialWidget,
} from "@/lib/affiliate/hostTrialWidget";
import { getCreditBalance, getCreditLedger } from "@/lib/credits/wallet";
import { resolveAccountScope } from "@/lib/host/accountScope";
import { hostHasFeature } from "@/lib/products/featureGate";
import { createServerClient } from "@/lib/supabase/server";

import { QuotesOnlyGate } from "./_components/QuotesOnlyGate";

import { AvatarMenu } from "./_components/AvatarMenu";
import { CreditPill, type CreditLedgerRow } from "./_components/CreditPill";
import { EntitySearch } from "./_components/EntitySearch";
import { MobileBottomNav } from "./_components/MobileBottomNav";
import { NotificationBell } from "./_components/notifications/NotificationBell";
import { QuickNavProvider } from "./_components/QuickNavPalette";
import { SavingsBadge } from "./_components/SavingsBadge";
import { Sidebar } from "./_components/Sidebar";
import { TrialBadge } from "./_components/TrialBadge";
import { TrialCountdownPill } from "./_components/TrialCountdownPill";
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
        .select("role, avatar_url, email_verified_at, is_active")
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

  // Suspended (admin "blocked from all features") → wall the whole app behind the
  // suspended notice. Platform staff are never walled. Server actions are blocked
  // independently in requireHost/assertFullHost, so this is the UI half.
  if (
    (profileRow as { is_active?: boolean | null } | null)?.is_active ===
      false &&
    !isPlatformStaff
  ) {
    redirect("/suspended");
  }

  // Email-verification GATE. Every signed-in non-staff user must confirm their
  // inbox before operating (founder directive — it's where booking/payment/
  // notification mail goes and the identity the affiliate programme is built on).
  // Rather than redirect away, we land them on the dashboard behind a BLOCKING
  // modal (EmailVerifyGate, rendered below): the app stays visible/blurred and
  // the modal auto-dismisses the moment they confirm. Host Server Actions are
  // blocked independently in requireHost/assertFullHost, so this UI half can't
  // be skipped to actually DO anything before verifying.
  const emailUnverified =
    !isPlatformStaff &&
    !(profileRow as { email_verified_at?: string | null } | null)
      ?.email_verified_at;

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
  // Draft-only nudge: the host has listing(s) but none published yet.
  let hasLiveListing = false;
  let draftListing: { id: string; name: string } | null = null;
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
  // Competition free-trial widget — non-null only for competition-referred hosts
  // currently on a trial (drives the header chip left of the savings badge).
  let trialWidget: HostTrialWidget | null = null;
  // Host's active free-trial end (status 'trialing') — drives the header
  // countdown pill. Null when the host isn't on a trial.
  let hostTrialEndsAt: string | null = null;

  if (host) {
    const [
      { data: listingRows },
      { data: subscription },
      { count: unread },
      { data: guestSummary },
      websiteEnabled,
      lookingForEnabled,
      { data: trialRow },
    ] = await Promise.all([
      supabase
        .from("properties")
        .select("id, name, is_published")
        .eq("host_id", host.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
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
      // The host's live trial (if any) — soonest-ending trialing subscription.
      supabase
        .from("subscriptions")
        .select("trial_ends_at")
        .eq("host_id", host.id)
        .eq("status", "trialing")
        .not("trial_ends_at", "is", null)
        .order("trial_ends_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    const rows = (listingRows ?? []) as Array<{
      id: string;
      name: string | null;
      is_published: boolean | null;
    }>;
    listingCount = rows.length;
    hasLiveListing = rows.some((l) => l.is_published);
    const firstDraft = rows.find((l) => !l.is_published);
    draftListing = firstDraft
      ? { id: firstDraft.id, name: firstDraft.name ?? "Your listing" }
      : null;
    plan = subscription?.plan ?? null;
    inboxUnread = unread ?? 0;
    guestCount =
      (guestSummary as { total_count?: number } | null)?.total_count ?? 0;
    canWebsite = websiteEnabled;
    canLookingFor = lookingForEnabled;
    hostTrialEndsAt =
      (trialRow as { trial_ends_at: string | null } | null)?.trial_ends_at ??
      null;

    trialWidget = await getHostTrialWidget(user.id, host.id);

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
                {/* Trial countdown pill (left of the header buttons). Shown for
                    any host on a trial; suppressed when the richer competition
                    TrialBadge is present so there's only one trial chip. */}
                {host && hostTrialEndsAt && !trialWidget ? (
                  <TrialCountdownPill trialEndsAt={hostTrialEndsAt} />
                ) : null}
                {trialWidget ? <TrialBadge trial={trialWidget} /> : null}
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
                  current="host"
                  canAdmin={isPlatformStaff}
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
            <TwoFactorNudge />
            <BroadcastBanner />
            {/* Draft nudge: the host has a listing but none live yet. The
                banner itself only surfaces from the SECOND login onward (client
                session count) so a brand-new host isn't nagged mid first-time
                setup, and its button routes into the finish-setup wizard. */}
            <PublishListingReminder
              needsPublish={
                Boolean(host) && listingCount > 0 && !hasLiveListing
              }
              draft={draftListing}
            />
          </>
        }
        bottomNav={
          <MobileBottomNav
            canLookingFor={quotesOnly ? true : canLookingFor}
            quotesOnly={quotesOnly}
          />
        }
      >
        <QuotesOnlyGate active={quotesOnly}>{children}</QuotesOnlyGate>
      </ClassicShellFrame>
      <DashboardTour />
      {emailUnverified ? <EmailVerifyGate email={user.email ?? null} /> : null}
    </QuickNavProvider>
  );
}
