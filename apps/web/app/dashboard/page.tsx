import type { Metadata } from "next";
import {
  ArrowRight,
  Banknote,
  BarChart3,
  CalendarCheck,
  CalendarClock,
  Sparkles,
  Star,
} from "lucide-react";
import Link from "next/link";

import { fetchGettingStartedState } from "@/lib/help/queries";
import { createServerClient } from "@/lib/supabase/server";

import { AcademyCards } from "./_components/AcademyCards";
import { DashboardPreview } from "./_components/DashboardPreview";
import { FirstListingTeaser } from "./_components/FirstListingTeaser";
import { FirstLoginHero } from "./_components/FirstLoginHero";
import { CompletedSetupHeader } from "./_components/CompletedSetupHeader";
import { SetupChecklist } from "./_components/SetupChecklist";
import { SetupSidePanel } from "./_components/SetupSidePanel";
import { buildSetupSteps } from "./_components/setupSteps";
import { WelcomeToast } from "./WelcomeToast";

export const metadata: Metadata = {
  title: "Dashboard · Vilo",
};

export const dynamic = "force-dynamic";

function fmtR(n: number, currency = "ZAR"): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

const CONFIRMED_STATUSES = ["confirmed", "checked_in", "completed"] as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { welcome?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pull everything we need in parallel.
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const monthStartIso = isoDate(monthStart);
  const monthEndIso = isoDate(monthEnd);
  const today = isoDate(new Date());
  const sevenDays = isoDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  const [
    { data: host },
    { data: monthBookings },
    { data: upcomingCheckIns },
    { data: recentBookings },
    { data: listings },
    { count: pendingCount },
  ] = await Promise.all([
    supabase
      .from("hosts")
      .select("id, handle, display_name, avg_rating, total_reviews")
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select("id, total_amount, currency, status, nights, check_in")
      .gte("check_in", monthStartIso)
      .lte("check_in", monthEndIso),
    supabase
      .from("bookings")
      .select(
        "id, reference, check_in, guests_count, listing:listings!inner ( name ), guest:user_profiles!inner ( full_name, email )",
      )
      .in("status", ["confirmed", "checked_in"])
      .gte("check_in", today)
      .lte("check_in", sevenDays)
      .order("check_in", { ascending: true })
      .limit(8),
    supabase
      .from("bookings")
      .select(
        "id, reference, status, payment_status, check_in, check_out, total_amount, currency, listing:listings!inner ( name ), guest:user_profiles!inner ( full_name, email )",
      )
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("listings")
      .select(
        "id, name, slug, is_published, booking_mode, listing_rooms ( id )",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  // ── KPIs ──
  const confirmedSet = new Set(CONFIRMED_STATUSES as readonly string[]);
  const confirmedThisMonth = (monthBookings ?? []).filter((b) =>
    confirmedSet.has(b.status as string),
  );

  const revenue = confirmedThisMonth.reduce(
    (acc, b) => acc + Number(b.total_amount),
    0,
  );
  const bookingsCount = (monthBookings ?? []).length;
  const confirmedCount = confirmedThisMonth.length;
  const pendingThisMonth = (monthBookings ?? []).filter(
    (b) => b.status === "pending",
  ).length;

  const totalListings =
    (listings ?? []).filter((l) => l.is_published).length || 0;
  const daysInMonth = monthEnd.getUTCDate() - monthStart.getUTCDate() + 1;
  const totalAvailableNights = totalListings * daysInMonth;
  const bookedNights = confirmedThisMonth.reduce(
    (acc, b) => acc + (Number(b.nights) || 0),
    0,
  );
  const occupancyPct =
    totalAvailableNights > 0
      ? Math.round((bookedNights / totalAvailableNights) * 100)
      : null;

  const avgRating = host?.avg_rating ? Number(host.avg_rating) : null;
  const totalReviews = host?.total_reviews ?? 0;

  const justOnboarded = searchParams?.welcome === "1";
  const needsOnboarding = !host;

  const firstName = host
    ? host.display_name.split(" ")[0]
    : (user?.email ?? "").split("@")[0];

  // Setup state powers the first-login experience (hero + checklist + side
  // panel). Only fetched once the host row exists — without it there's
  // nothing to gate on. Falls back to redirecting back to onboarding.
  const setupState = host ? await fetchGettingStartedState(user!.id) : null;
  const setupSteps = setupState ? buildSetupSteps(setupState) : [];
  // A published listing means setup was 100% (the publish gate enforces
  // profile/banking/photos/rooms/policy), so never nag a host who is already
  // live — even if a sub-check or cache hiccups. Otherwise require every step.
  const setupComplete =
    (setupState?.listing_published.done ?? false) ||
    (setupSteps.length > 0 && setupSteps.every((s) => s.done));
  const hasFirstListing = (listings ?? []).length > 0;

  return (
    <div className="space-y-6 lg:space-y-7">
      {justOnboarded ? <WelcomeToast /> : null}

      {needsOnboarding ? (
        <>
          <section className="-mt-1">
            <h2 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
              Welcome to Vilo.
            </h2>
            <p className="mt-1 text-sm text-brand-mute">
              Finish onboarding to take your first booking.
            </p>
          </section>
          <Link
            href="/signup/host"
            className="flex items-start gap-4 rounded-card border border-brand-primary/40 bg-brand-accent/60 p-5 shadow-card transition-colors hover:bg-brand-accent"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-white text-brand-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-display font-semibold text-brand-dark">
                Finish setting up your host profile
              </div>
              <p className="mt-0.5 text-sm text-brand-mute">
                Five quick steps — handle, listing type, first listing, plan.
                Until then your guests can&rsquo;t book you.
              </p>
            </div>
            <ArrowRight className="mt-2 h-5 w-5 shrink-0 text-brand-primary" />
          </Link>
        </>
      ) : null}

      {host && !setupComplete ? (
        <>
          <FirstLoginHero
            firstName={firstName}
            handle={host.handle}
            steps={setupSteps}
          />

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <SetupChecklist steps={setupSteps} />
            <SetupSidePanel
              firstName={firstName}
              handle={host.handle}
              email={user?.email ?? ""}
              emailVerified={setupState?.email_verified.done ?? false}
              steps={setupSteps}
            />
          </div>

          {!hasFirstListing ? <FirstListingTeaser /> : null}
        </>
      ) : null}

      {host && setupComplete ? (
        <CompletedSetupHeader
          firstName={firstName}
          handle={host.handle}
          pendingCount={pendingCount ?? null}
          checklist={<SetupChecklist steps={setupSteps} />}
          attention={
            <SetupSidePanel
              firstName={firstName}
              handle={host.handle}
              email={user?.email ?? ""}
              emailVerified={setupState?.email_verified.done ?? false}
              steps={setupSteps}
            />
          }
        />
      ) : null}

      {host ? (
        <>
          {/* KPI tiles */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-4">
            <KpiTile
              icon={Banknote}
              label="Revenue · this month"
              value={fmtR(revenue, "ZAR")}
              sub={`${confirmedCount} confirmed booking${confirmedCount === 1 ? "" : "s"}`}
            />
            <KpiTile
              icon={CalendarCheck}
              label="Bookings · this month"
              value={String(bookingsCount)}
              sub={`${confirmedCount} confirmed · ${pendingThisMonth} pending`}
            />
            <KpiTile
              icon={BarChart3}
              label="Occupancy"
              value={occupancyPct == null ? "—" : `${occupancyPct}%`}
              sub={
                totalListings === 0
                  ? "Publish a listing first"
                  : `${bookedNights} of ${totalAvailableNights} nights`
              }
            />
            <KpiTile
              icon={Star}
              label="Avg rating"
              value={avgRating == null ? "—" : avgRating.toFixed(1)}
              sub={
                totalReviews === 0
                  ? "Reviews land after first stay"
                  : `${totalReviews} review${totalReviews === 1 ? "" : "s"}`
              }
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            {/* Recent bookings */}
            <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                    Recent bookings
                  </div>
                  <div className="mt-1 font-display text-base font-semibold text-brand-ink">
                    Latest 5
                  </div>
                </div>
                <Link
                  href="/dashboard/bookings"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
                >
                  See all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {!recentBookings || recentBookings.length === 0 ? (
                <EmptyState
                  icon={CalendarCheck}
                  title="No bookings yet"
                  body="Once a guest reserves, it will land here."
                />
              ) : (
                <ul className="divide-y divide-brand-line">
                  {recentBookings.map((b) => {
                    const listing = b.listing as unknown as { name: string };
                    const guest = b.guest as unknown as {
                      full_name: string | null;
                      email: string | null;
                    };
                    return (
                      <li key={b.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-brand-dark">
                            {guest.full_name || guest.email || "Guest"} ·{" "}
                            {listing.name}
                          </div>
                          <div className="font-mono text-[11px] text-brand-mute">
                            {b.reference} · {b.check_in} → {b.check_out}
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-xs">
                          <div className="font-display font-bold text-brand-ink">
                            {fmtR(Number(b.total_amount), b.currency)}
                          </div>
                          <Link
                            href={`/dashboard/bookings/${b.id}`}
                            className="text-[11px] font-medium text-brand-primary hover:underline"
                          >
                            Open →
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Upcoming check-ins */}
            <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                    Upcoming check-ins
                  </div>
                  <div className="mt-1 font-display text-base font-semibold text-brand-ink">
                    Next 7 days
                  </div>
                </div>
                <Link
                  href="/dashboard/calendar"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
                >
                  Calendar
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {!upcomingCheckIns || upcomingCheckIns.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  title="No arrivals yet"
                  body="When a confirmed booking lands within the next week, you&rsquo;ll see it here."
                />
              ) : (
                <ul className="divide-y divide-brand-line">
                  {upcomingCheckIns.map((b) => {
                    const listing = b.listing as unknown as { name: string };
                    const guest = b.guest as unknown as {
                      full_name: string | null;
                      email: string | null;
                    };
                    return (
                      <li key={b.id} className="flex items-center gap-3 py-3">
                        <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-card border border-brand-line bg-brand-light text-brand-ink">
                          <span className="text-[10px] uppercase">
                            {new Intl.DateTimeFormat("en-ZA", {
                              month: "short",
                            }).format(new Date(b.check_in!))}
                          </span>
                          <span className="font-display text-sm font-bold">
                            {new Date(b.check_in!).getUTCDate()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-brand-dark">
                            {guest.full_name || guest.email || "Guest"}
                          </div>
                          <div className="truncate text-[11px] text-brand-mute">
                            {listing.name} · {b.guests_count}{" "}
                            {b.guests_count === 1 ? "guest" : "guests"}
                          </div>
                        </div>
                        <Link
                          href={`/dashboard/bookings/${b.id}`}
                          className="shrink-0 text-xs font-medium text-brand-primary hover:underline"
                        >
                          Open →
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Listings */}
          {listings && listings.length > 0 ? (
            <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                    Your listings
                  </div>
                  <div className="mt-1 font-display text-base font-semibold text-brand-ink">
                    {listings.length}{" "}
                    {listings.length === 1 ? "listing" : "listings"}
                  </div>
                </div>
                <Link
                  href="/dashboard/listings"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
                >
                  See all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <ul className="divide-y divide-brand-line">
                {listings.map((l) => {
                  const roomCount =
                    (l.listing_rooms as Array<{ id: string }> | null)?.length ??
                    0;
                  return (
                    <li key={l.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-brand-dark">
                          {l.name}
                        </div>
                      </div>
                      {l.booking_mode !== "whole_listing" && roomCount > 0 ? (
                        <span className="rounded-pill bg-brand-accent px-2 py-0.5 text-[10px] font-semibold text-brand-primary">
                          {roomCount} {roomCount === 1 ? "room" : "rooms"}
                        </span>
                      ) : null}
                      <span
                        className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ${
                          l.is_published
                            ? "bg-green-100 text-green-800"
                            : "bg-brand-line text-brand-mute"
                        }`}
                      >
                        {l.is_published ? "Published" : "Draft"}
                      </span>
                      {l.is_published && l.slug ? (
                        <Link
                          href={`/listing/${l.slug}`}
                          target="_blank"
                          className="text-xs font-medium text-brand-mute hover:text-brand-primary"
                        >
                          View
                        </Link>
                      ) : null}
                      <Link
                        href={`/dashboard/listings/${l.id}/edit`}
                        className="text-xs font-medium text-brand-primary hover:underline"
                      >
                        Edit →
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <EmptyListings />
          )}

          {/* While setup is in progress, surface educational content and a
              preview of what the dashboard will look like once they have a
              live listing. Both auto-hide once setup is complete. */}
          {!setupComplete ? (
            <>
              <AcademyCards />
              <DashboardPreview />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-brand-accent text-brand-secondary">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs font-medium text-brand-mute">{label}</span>
      </div>
      <div className="num mt-3 font-display text-3xl font-bold text-brand-ink">
        {value}
      </div>
      <div className="mt-1 text-xs text-brand-mute">{sub}</div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof CalendarCheck;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded border border-dashed border-brand-line bg-brand-light/40 px-4 py-8 text-center">
      <Icon className="h-6 w-6 text-brand-mute" />
      <div className="font-display text-sm font-semibold text-brand-ink">
        {title}
      </div>
      <p className="text-xs text-brand-mute">{body}</p>
    </div>
  );
}

function EmptyListings() {
  return (
    <section className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="font-display text-lg font-bold text-brand-ink">
        No listings yet
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
        Your first listing was created during onboarding. If you removed it, add
        another.
      </p>
      <Link
        href="/dashboard/listings/new"
        className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
      >
        New listing
      </Link>
    </section>
  );
}
