import type { Metadata } from "next";
import { ArrowRight, CalendarDays, MessageSquare, Star } from "lucide-react";
import Link from "next/link";

import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Portal · Vilo",
};

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function PortalOverviewPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Layout already gates auth; this is just for the typed user.id.
  if (!user) return null;

  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: profile },
    { data: nextTrip },
    { count: tripCount },
    { count: unreadCount },
    { count: pendingReviewCount },
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select(
        "id, reference, status, check_in, check_out, session_date, listing:listings(name)",
      )
      .eq("guest_id", user.id)
      .is("deleted_at", null)
      .in("status", ["confirmed", "checked_in", "pending", "pending_eft"])
      .gte("check_in", today)
      .order("check_in", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("guest_id", user.id)
      .is("deleted_at", null),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("guest_id", user.id)
      .gt("unread_guest", 0),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("guest_id", user.id)
      .is("deleted_at", null)
      .eq("status", "completed"),
  ]);

  const firstName = (profile?.full_name ?? "there").split(" ")[0];
  const trip = nextTrip as {
    id: string;
    reference: string;
    status: string;
    check_in: string | null;
    check_out: string | null;
    session_date: string | null;
    listing: { name: string } | { name: string }[] | null;
  } | null;
  const tripListing = Array.isArray(trip?.listing)
    ? trip?.listing[0]
    : trip?.listing;

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-brand-ink sm:text-4xl">
          Welcome back, {firstName}.
        </h1>
        <p className="mt-2 text-sm text-brand-mute">
          Your stays, conversations and reviews in one place.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Total trips"
          value={String(tripCount ?? 0)}
          href="/portal/trips"
        />
        <StatCard
          icon={<MessageSquare className="h-4 w-4" />}
          label="Unread messages"
          value={String(unreadCount ?? 0)}
          href="/portal/inbox"
        />
        <StatCard
          icon={<Star className="h-4 w-4" />}
          label="Reviews to write"
          value={String(pendingReviewCount ?? 0)}
          href="/portal/reviews"
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-brand-ink">
          Up next
        </h2>
        {trip ? (
          <Link
            href={`/my-trips/${trip.id}`}
            className="block rounded-card border border-brand-line bg-white p-5 shadow-card transition hover:border-brand-primary/40 hover:shadow-lift"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-brand-secondary">
                  {trip.status.replace(/_/g, " ")}
                </div>
                <div className="mt-2 font-display text-lg font-semibold text-brand-ink">
                  {tripListing?.name ?? "Your stay"}
                </div>
                <div className="mt-1 text-sm text-brand-mute">
                  {trip.session_date
                    ? `Session: ${fmtDate(trip.session_date)}`
                    : `${fmtDate(trip.check_in)} → ${fmtDate(trip.check_out)}`}
                </div>
                <div className="mt-1 font-mono text-xs text-brand-mute">
                  {trip.reference}
                </div>
              </div>
              <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-brand-mute" />
            </div>
          </Link>
        ) : (
          <div className="rounded-card border border-dashed border-brand-line bg-white p-6 text-center">
            <p className="font-display text-base font-semibold text-brand-ink">
              No upcoming trips yet
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
              Browse the directory to find your next stay.
            </p>
            <Link
              href="/explore"
              className="mt-4 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
            >
              Browse stays
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-card border border-brand-line bg-white p-5 transition hover:border-brand-primary/40 hover:shadow-card"
    >
      <div className="flex items-center gap-2 text-brand-mute">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="mt-3 font-display text-3xl font-bold text-brand-ink">
        {value}
      </div>
    </Link>
  );
}
