import type { Metadata } from "next";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

import { getBrandName } from "@/lib/brand";
import { fetchGettingStartedState } from "@/lib/help/queries";
import { createServerClient } from "@/lib/supabase/server";

import {
  MainDashboard,
  type MainDashboardData,
} from "./_components/MainDashboard";
import { OnboardingDashboard } from "./_components/OnboardingDashboard";
import { OnboardingFreshness } from "./_components/OnboardingFreshness";
import { FirstListingTeaser } from "./_components/FirstListingTeaser";
import { buildSetupSteps } from "./_components/setupSteps";
import { WelcomeToast } from "./WelcomeToast";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

const CONFIRMED = new Set(["confirmed", "checked_in", "completed"]);
const DAY = 86_400_000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString("en-ZA");
}
function initialsOf(name: string | null): string {
  if (!name) return "G";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "G"
  );
}
function fmtRange(ci: string | null, co: string | null): string {
  if (!ci) return "—";
  const f = (s: string) =>
    new Date(`${s}T12:00:00Z`).toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
    });
  return co ? `${f(ci)} – ${f(co)}` : f(ci);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { welcome?: string };
}) {
  const supabase = createServerClient();
  const brandName = await getBrandName();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: host } = await supabase
    .from("hosts")
    .select("id, handle, display_name, avg_rating, total_reviews")
    .eq("user_id", user!.id)
    .maybeSingle();

  const firstName = host
    ? host.display_name.split(" ")[0]
    : (user?.email ?? "").split("@")[0];

  const setupState = await fetchGettingStartedState(user!.id).catch(() => null);
  const setupSteps = setupState ? buildSetupSteps(setupState) : [];
  const setupComplete =
    !!host &&
    ((setupState?.listing_published.done ?? false) ||
      (setupSteps.length > 0 && setupSteps.every((s) => s.done)));

  const justOnboarded = searchParams?.welcome === "1";

  // ── No host row yet → keep a simple finish-signup prompt. ──
  if (!host) {
    return (
      <div className="mx-auto max-w-[680px] space-y-5">
        {justOnboarded ? <WelcomeToast /> : null}
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink">
            Welcome to {brandName}.
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Finish onboarding to take your first booking.
          </p>
        </div>
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
              A few quick steps — handle, listing, payouts. Until then your
              guests can&rsquo;t book you.
            </p>
          </div>
          <ArrowRight className="mt-2 h-5 w-5 shrink-0 text-brand-primary" />
        </Link>
      </div>
    );
  }

  // ── Setup not 100% → onboarding view only (dashboard unlocks at 100%). ──
  if (!setupComplete) {
    const { data: anyListing } = await supabase
      .from("listings")
      .select("id")
      .eq("host_id", host.id)
      .is("deleted_at", null)
      .limit(1);
    const hasFirstListing = (anyListing ?? []).length > 0;
    return (
      <div className="space-y-6">
        <OnboardingFreshness />
        {justOnboarded ? <WelcomeToast /> : null}
        <OnboardingDashboard
          brandName={brandName}
          firstName={firstName}
          handle={host.handle}
          steps={setupSteps}
        />
        {!hasFirstListing ? (
          <div className="mx-auto max-w-[1080px]">
            <FirstListingTeaser />
          </div>
        ) : null}
      </div>
    );
  }

  // ── Live host → the full dashboard. ──
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  );
  const prevStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const prevEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0),
  );
  const today = isoDate(now);
  const ninetyAgo = isoDate(new Date(Date.now() - 90 * DAY));

  const [
    { data: monthBookings },
    { data: prevBookings },
    { data: last90 },
    { data: upcoming },
    { data: convos },
    { data: listings },
    { count: pendingCount },
    { count: unreadCount },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, total_amount, status, nights, listing_id")
      .eq("host_id", host.id)
      .gte("check_in", isoDate(monthStart))
      .lte("check_in", isoDate(monthEnd)),
    supabase
      .from("bookings")
      .select("total_amount, status")
      .eq("host_id", host.id)
      .gte("check_in", isoDate(prevStart))
      .lte("check_in", isoDate(prevEnd)),
    supabase
      .from("bookings")
      .select("total_amount, nights, status, check_in, created_at")
      .eq("host_id", host.id)
      .gte("check_in", ninetyAgo),
    supabase
      .from("bookings")
      .select(
        "id, check_in, check_out, nights, guests_count, total_amount, currency, status, guest_name, guest_email, listing:listings!inner ( name ), guest:user_profiles!bookings_guest_id_fkey ( full_name )",
      )
      .eq("host_id", host.id)
      .in("status", ["confirmed", "checked_in"])
      .gte("check_in", today)
      .order("check_in", { ascending: true })
      .limit(4),
    supabase
      .from("conversations")
      .select(
        "id, unread_host, last_message_at, last_message_preview, is_enquiry, guest:user_profiles!conversations_guest_id_fkey ( full_name, email )",
      )
      .eq("host_id", host.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(4),
    supabase
      .from("listings")
      .select("id, name, city, max_guests, is_published")
      .eq("host_id", host.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("host_id", host.id)
      .eq("status", "pending"),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("host_id", host.id)
      .gt("unread_host", 0),
  ]);

  const currency =
    (monthBookings ?? [])[0]?.total_amount != null ? "ZAR" : "ZAR";

  // KPIs.
  const confirmedMonth = (monthBookings ?? []).filter((b) =>
    CONFIRMED.has(b.status as string),
  );
  const revenue = confirmedMonth.reduce(
    (a, b) => a + Number(b.total_amount),
    0,
  );
  const prevRevenue = (prevBookings ?? [])
    .filter((b) => CONFIRMED.has(b.status as string))
    .reduce((a, b) => a + Number(b.total_amount), 0);
  const revenueDeltaPct =
    prevRevenue > 0
      ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100)
      : null;
  const bookingsCount = (monthBookings ?? []).length;
  const confirmedCount = confirmedMonth.length;
  const pendingThisMonth = (monthBookings ?? []).filter(
    (b) => b.status === "pending",
  ).length;

  const publishedListings = (listings ?? []).filter((l) => l.is_published);
  const totalListings = publishedListings.length;
  const daysInMonth = monthEnd.getUTCDate();
  const totalNights = totalListings * daysInMonth;
  const bookedNights = confirmedMonth.reduce(
    (a, b) => a + (Number(b.nights) || 0),
    0,
  );
  const occupancyPct =
    totalNights > 0 ? Math.round((bookedNights / totalNights) * 100) : null;

  // Per-listing occupancy (this month).
  const nightsByListing = new Map<string, number>();
  for (const b of confirmedMonth)
    nightsByListing.set(
      b.listing_id,
      (nightsByListing.get(b.listing_id) ?? 0) + (Number(b.nights) || 0),
    );

  // 90-day revenue series (weekly buckets) + stats.
  const conf90 = (last90 ?? []).filter((b) =>
    CONFIRMED.has(b.status as string),
  );
  const WEEKS = 13;
  const points = new Array(WEEKS).fill(0) as number[];
  const start90 = Date.now() - 90 * DAY;
  for (const b of conf90) {
    const anchor = new Date(
      `${(b.check_in ?? b.created_at).slice(0, 10)}T12:00:00Z`,
    ).getTime();
    const wk = Math.min(
      WEEKS - 1,
      Math.max(0, Math.floor((anchor - start90) / (7 * DAY))),
    );
    points[wk] += Number(b.total_amount);
  }
  const rev90Total = conf90.reduce((a, b) => a + Number(b.total_amount), 0);
  const nights90 = conf90.reduce((a, b) => a + (Number(b.nights) || 0), 0);
  const avgNightly = nights90 > 0 ? Math.round(rev90Total / nights90) : 0;

  // Next check-in.
  const upcomingRows = (upcoming ?? []) as unknown as {
    id: string;
    check_in: string | null;
    check_out: string | null;
    nights: number | null;
    guests_count: number;
    total_amount: number;
    status: string;
    guest_name: string | null;
    guest_email: string | null;
    listing: { name: string } | null;
    guest: { full_name: string | null } | null;
  }[];
  const next = upcomingRows[0];
  const nextInDays = next?.check_in
    ? Math.round(
        (new Date(`${next.check_in}T12:00:00Z`).getTime() -
          new Date(`${today}T12:00:00Z`).getTime()) /
          DAY,
      )
    : null;

  const tagForStatus = (
    s: string,
  ): { label: string; tone: "green" | "sky" | "amber" } =>
    s === "checked_in"
      ? { label: "In-house", tone: "sky" }
      : s === "confirmed"
        ? { label: "Confirmed", tone: "green" }
        : { label: "Pending", tone: "amber" };

  // Needs attention.
  const needs: MainDashboardData["needs"] = [];
  if ((pendingCount ?? 0) > 0)
    needs.push({
      id: "pending",
      tone: "amber",
      icon: "clock",
      title: `Confirm ${pendingCount} pending booking${pendingCount === 1 ? "" : "s"}`,
      sub: "Guests are waiting — confirm to lock the dates",
      tag: { label: "Pending", tone: "amber" },
      href: "/dashboard/bookings?seg=pending",
    });
  if ((unreadCount ?? 0) > 0)
    needs.push({
      id: "unread",
      tone: "red",
      icon: "message",
      title: `${unreadCount} unread guest message${unreadCount === 1 ? "" : "s"}`,
      sub: "Fast replies win bookings",
      tag: { label: "Reply", tone: "red" },
      href: "/dashboard/inbox",
    });

  const data: MainDashboardData = {
    firstName,
    dateLabel: now.toLocaleDateString("en-ZA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    currency,
    stat: {
      revenue,
      revenueDeltaPct,
      monthLabel: now.toLocaleDateString("en-ZA", { month: "short" }),
      bookingsCount,
      confirmedCount,
      pendingThisMonth,
      occupancyPct,
      totalListings,
      avgRating: host.avg_rating ? Number(host.avg_rating) : null,
      totalReviews: host.total_reviews ?? 0,
      nextCheckIn: next
        ? {
            inLabel:
              nextInDays === 0
                ? "Today"
                : nextInDays === 1
                  ? "Tomorrow"
                  : `In ${nextInDays} days`,
            guest:
              next.guest?.full_name ??
              next.guest_name ??
              next.guest_email ??
              "Guest",
            listing: next.listing?.name ?? "Listing",
          }
        : null,
    },
    needs,
    upcoming: upcomingRows.map((b) => {
      const guestName =
        b.guest?.full_name ?? b.guest_name ?? b.guest_email ?? "Guest";
      return {
        id: b.id,
        guest: guestName,
        initials: initialsOf(guestName),
        listing: b.listing?.name ?? "Listing",
        dates: fmtRange(b.check_in, b.check_out),
        meta: `${b.nights ?? 0} night${b.nights === 1 ? "" : "s"} · ${b.guests_count} guest${b.guests_count === 1 ? "" : "s"}`,
        amount: Number(b.total_amount),
        tag: tagForStatus(b.status),
      };
    }),
    revenue90: {
      total: rev90Total,
      points,
      bookings: conf90.length,
      avgNightly,
      commissionSaved: Math.round(rev90Total * 0.18),
    },
    messages: (
      (convos ?? []) as unknown as {
        id: string;
        unread_host: number | null;
        last_message_at: string | null;
        last_message_preview: string | null;
        is_enquiry: boolean;
        guest: { full_name: string | null; email: string | null } | null;
      }[]
    ).map((c) => ({
      id: c.id,
      name: c.guest?.full_name ?? c.guest?.email ?? "Guest",
      initials: initialsOf(c.guest?.full_name ?? c.guest?.email ?? null),
      time: c.last_message_at ? timeAgo(c.last_message_at) : "",
      snippet: c.last_message_preview ?? "",
      unread: (c.unread_host ?? 0) > 0,
      tag: c.is_enquiry ? { label: "Enquiry", tone: "amber" as const } : null,
    })),
    listings: (listings ?? []).map((l) => {
      const occ =
        l.is_published && daysInMonth > 0
          ? Math.min(
              100,
              Math.round(
                ((nightsByListing.get(l.id) ?? 0) / daysInMonth) * 100,
              ),
            )
          : null;
      return {
        id: l.id,
        name: l.name,
        meta: [l.city, l.max_guests ? `sleeps ${l.max_guests}` : null]
          .filter(Boolean)
          .join(" · "),
        occ,
        tag: l.is_published
          ? { label: "Live", tone: "green" as const }
          : { label: "Draft", tone: "amber" as const },
      };
    }),
  };

  return (
    <>
      {justOnboarded ? <WelcomeToast /> : null}
      <MainDashboard data={data} />
    </>
  );
}
