import type { Metadata } from "next";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";

import { getBrandName } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import { fetchGettingStartedState } from "@/lib/help/queries";
import { throwOnError, throwOnErrorWithCount } from "@/lib/supabase/query";
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
  // Brand name doesn't depend on the user, so resolve it alongside auth.
  const [
    brandName,
    {
      data: { user },
    },
  ] = await Promise.all([getBrandName(), supabase.auth.getUser()]);

  // The host row and the getting-started state both depend only on user.id
  // and are independent of each other — fetch them in one wave.
  const [{ data: host }, setupState] = await Promise.all([
    supabase
      .from("hosts")
      .select("id, handle, display_name, avg_rating, total_reviews")
      .eq("user_id", user!.id)
      .maybeSingle(),
    fetchGettingStartedState(user!.id).catch(() => null),
  ]);

  const firstName = host
    ? host.display_name.split(" ")[0]
    : (user?.email ?? "").split("@")[0];
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
      .from("properties")
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
  // Recent-activity window for the "needs attention" event feed (new bookings +
  // payments received in the last few days).
  const threeDaysAgo = new Date(Date.now() - 3 * DAY).toISOString();

  // Wrapped in throwOnError so a broken embed / schema drift surfaces (server
  // log + error boundary) instead of silently rendering zero KPIs.
  const [
    monthBookings,
    prevBookings,
    last90,
    upcoming,
    convos,
    listings,
    pending,
    unread,
    opsToday,
    eftOutstanding,
    next7,
    reviewsToReply,
    recentActivity,
  ] = await Promise.all([
    throwOnError(
      supabase
        .from("bookings")
        .select("id, total_amount, currency, status, nights, property_id")
        .eq("host_id", host.id)
        .gte("check_in", isoDate(monthStart))
        .lte("check_in", isoDate(monthEnd)),
      "dashboard/month-bookings",
    ),
    throwOnError(
      supabase
        .from("bookings")
        .select("total_amount, status")
        .eq("host_id", host.id)
        .gte("check_in", isoDate(prevStart))
        .lte("check_in", isoDate(prevEnd)),
      "dashboard/prev-bookings",
    ),
    throwOnError(
      supabase
        .from("bookings")
        .select("total_amount, nights, status, check_in, created_at")
        .eq("host_id", host.id)
        .gte("check_in", ninetyAgo),
      "dashboard/last90",
    ),
    throwOnError(
      supabase
        .from("bookings")
        .select(
          "id, check_in, check_out, nights, guests_count, total_amount, currency, status, guest_name, guest_email, listing:properties!inner ( name ), guest:user_profiles!bookings_guest_id_fkey ( full_name )",
        )
        .eq("host_id", host.id)
        .in("status", ["confirmed", "checked_in"])
        .gte("check_in", today)
        .order("check_in", { ascending: true })
        .limit(4),
      "dashboard/upcoming",
    ),
    throwOnError(
      supabase
        .from("conversations")
        .select(
          "id, unread_host, last_message_at, last_message_preview, is_enquiry, guest:user_profiles!conversations_guest_id_fkey ( full_name, email )",
        )
        .eq("host_id", host.id)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(4),
      "dashboard/conversations",
    ),
    throwOnError(
      supabase
        .from("properties")
        .select("id, name, city, max_guests, is_published")
        .eq("host_id", host.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(4),
      "dashboard/properties",
    ),
    throwOnErrorWithCount(
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("host_id", host.id)
        .eq("status", "pending"),
      "dashboard/pending-count",
    ),
    throwOnErrorWithCount(
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("host_id", host.id)
        .gt("unread_host", 0),
      "dashboard/unread-count",
    ),
    // Today's operations — arrivals/departures/in-house in one pull (the daily
    // heartbeat a host manages by). Active bookings touching today, or in-house.
    throwOnError(
      supabase
        .from("bookings")
        .select(
          "id, status, check_in, check_out, guest_name, guest_email, guest:user_profiles!bookings_guest_id_fkey ( full_name )",
        )
        .eq("host_id", host.id)
        .in("status", ["confirmed", "checked_in"])
        .or(`check_in.eq.${today},check_out.eq.${today},status.eq.checked_in`),
      "dashboard/ops-today",
    ),
    // Money to collect — bookings awaiting a manual EFT the host must confirm.
    throwOnError(
      supabase
        .from("bookings")
        .select("id, total_amount, balance_due, currency")
        .eq("host_id", host.id)
        .in("status", ["pending_eft", "pending_eft_review"]),
      "dashboard/eft-outstanding",
    ),
    // Next-7-days window — any active stay overlapping the coming week (drives the
    // week-at-a-glance strip). Overlap: starts on/before day 7 AND ends after today.
    throwOnError(
      supabase
        .from("bookings")
        .select("check_in, check_out")
        .eq("host_id", host.id)
        .in("status", ["confirmed", "checked_in"])
        .lte("check_in", isoDate(new Date(Date.now() + 6 * DAY)))
        .gt("check_out", today),
      "dashboard/next7",
    ),
    // Published reviews still awaiting the host's reply (reputation management).
    throwOnErrorWithCount(
      supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("host_id", host.id)
        .eq("is_published", true)
        .is("host_response", null),
      "dashboard/reviews-to-reply",
    ),
    // Recent activity — bookings just created OR just paid (last 3 days) → the
    // "needs attention" event feed. Cancelled/declined filtered out in JS.
    throwOnError(
      supabase
        .from("bookings")
        .select(
          "id, guest_name, guest_email, total_amount, currency, check_in, check_out, status, payment_status, created_at, confirmed_at, listing:properties!inner ( name ), guest:user_profiles!bookings_guest_id_fkey ( full_name )",
        )
        .eq("host_id", host.id)
        .or(`created_at.gte.${threeDaysAgo},confirmed_at.gte.${threeDaysAgo}`)
        .order("created_at", { ascending: false })
        .limit(12),
      "dashboard/recent-activity",
    ),
  ]);
  const pendingCount = pending.count;
  const unreadCount = unread.count;

  // Host's display currency from their most recent booking this month.
  const currency = monthBookings?.[0]?.currency ?? "ZAR";

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
    totalNights > 0
      ? Math.min(100, Math.round((bookedNights / totalNights) * 100))
      : null;

  // Per-listing occupancy (this month).
  const nightsByListing = new Map<string, number>();
  for (const b of confirmedMonth)
    nightsByListing.set(
      b.property_id,
      (nightsByListing.get(b.property_id) ?? 0) + (Number(b.nights) || 0),
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

  // Today's operations — split the single pull into arrivals / departures /
  // in-house (the daily heartbeat a host runs their day by).
  type OpsRow = {
    id: string;
    status: string;
    check_in: string | null;
    check_out: string | null;
    guest_name: string | null;
    guest_email: string | null;
    guest: { full_name: string | null } | null;
  };
  const opsRows = (opsToday ?? []) as unknown as OpsRow[];
  const opsName = (r: OpsRow) =>
    r.guest?.full_name ?? r.guest_name ?? r.guest_email ?? "Guest";
  const firstNames = (rows: OpsRow[]) => rows.slice(0, 3).map(opsName);
  const arrivals = opsRows.filter((r) => r.check_in === today);
  const departures = opsRows.filter((r) => r.check_out === today);
  const inHouse = opsRows.filter((r) => r.status === "checked_in");
  const todayOps = {
    arrivals: { count: arrivals.length, names: firstNames(arrivals) },
    departures: { count: departures.length, names: firstNames(departures) },
    inHouse: { count: inHouse.length, names: firstNames(inHouse) },
  };

  // Money to collect — manual-EFT bookings awaiting confirmation.
  const eftRows = (eftOutstanding ?? []) as unknown as {
    total_amount: number;
    balance_due: number | null;
    currency: string;
  }[];
  const eftCount = eftRows.length;
  const eftToCollect = eftRows.reduce(
    (a, b) => a + Number(b.balance_due ?? b.total_amount),
    0,
  );

  // Week-at-a-glance — arrivals / departures / occupied per day for the next 7.
  const winRows = (next7 ?? []) as unknown as {
    check_in: string | null;
    check_out: string | null;
  }[];
  const week7 = Array.from({ length: 7 }, (_, i) => {
    const dStr = isoDate(new Date(Date.now() + i * DAY));
    const dd = new Date(`${dStr}T12:00:00Z`);
    let arrivals = 0;
    let departures = 0;
    let occupied = 0;
    for (const b of winRows) {
      if (b.check_in === dStr) arrivals++;
      if (b.check_out === dStr) departures++;
      if (b.check_in && b.check_out && b.check_in <= dStr && dStr < b.check_out)
        occupied++;
    }
    return {
      weekday: dd.toLocaleDateString("en-ZA", { weekday: "short" }),
      day: Number(dStr.slice(8, 10)),
      arrivals,
      departures,
      occupied,
      isToday: i === 0,
    };
  });

  // Needs attention.
  const needs: MainDashboardData["needs"] = [];
  const reviewsCount = reviewsToReply.count ?? 0;
  if (reviewsCount > 0)
    needs.push({
      id: "reviews",
      tone: "accent",
      icon: "review",
      title: `Reply to ${reviewsCount} guest review${reviewsCount === 1 ? "" : "s"}`,
      sub: "A thoughtful reply builds trust with future guests",
      tag: { label: "Reply", tone: "indigo" },
      href: "/dashboard/reviews",
    });
  if (eftCount > 0)
    needs.push({
      id: "eft",
      tone: "amber",
      icon: "money",
      title: `Collect ${formatMoney(eftToCollect, currency)} from ${eftCount} EFT booking${eftCount === 1 ? "" : "s"}`,
      sub: "Confirm the transfer to lock these stays",
      tag: { label: "Collect", tone: "amber" },
      href: "/dashboard/bookings?seg=pending",
    });
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

  // Recent-event feed — blended in AFTER the action items (urgent-first), then
  // the freshest events. Each booking yields at most one event: a payment-just-
  // received wins over a just-created row (the money event is the headline).
  const CANCELLED_STATUSES = new Set([
    "cancelled",
    "cancelled_host",
    "cancelled_guest",
    "declined",
    "expired",
    "no_show",
  ]);
  type ActivityRow = {
    id: string;
    guest_name: string | null;
    guest_email: string | null;
    total_amount: number;
    check_in: string | null;
    check_out: string | null;
    status: string;
    payment_status: string | null;
    created_at: string;
    confirmed_at: string | null;
    listing: { name: string } | null;
    guest: { full_name: string | null } | null;
  };
  // A recent booking only counts as a "new booking" event when it's a confirmed
  // reservation — pending / pending_eft are already covered by the aggregate
  // action items above, so they must not double-surface here.
  const EVENT_BOOKING_STATUSES = new Set([
    "confirmed",
    "checked_in",
    "completed",
  ]);
  const activityRows = (
    (recentActivity ?? []) as unknown as ActivityRow[]
  ).filter((r) => !CANCELLED_STATUSES.has(r.status));
  const events: { at: string; need: (typeof needs)[number] }[] = [];
  for (const r of activityRows) {
    const guest =
      r.guest?.full_name ?? r.guest_name ?? r.guest_email ?? "Guest";
    const paidRecently =
      r.payment_status === "completed" &&
      r.confirmed_at != null &&
      r.confirmed_at >= threeDaysAgo;
    if (paidRecently) {
      events.push({
        at: r.confirmed_at as string,
        need: {
          id: `pay-${r.id}`,
          tone: "accent",
          icon: "money",
          title: `Payment received · ${formatMoney(Number(r.total_amount), currency)}`,
          sub: `${guest} · ${r.listing?.name ?? "Listing"}`,
          tag: { label: "Paid", tone: "green" },
          href: `/dashboard/bookings/${r.id}`,
        },
      });
    } else if (
      r.created_at >= threeDaysAgo &&
      EVENT_BOOKING_STATUSES.has(r.status)
    ) {
      events.push({
        at: r.created_at,
        need: {
          id: `new-${r.id}`,
          tone: "accent",
          icon: "booking",
          title: `New booking · ${guest} · ${formatMoney(Number(r.total_amount), currency)}`,
          sub: `${r.listing?.name ?? "Listing"} · ${fmtRange(r.check_in, r.check_out)}`,
          tag: { label: "New", tone: "green" },
          href: `/dashboard/bookings/${r.id}`,
        },
      });
    }
  }
  events.sort((a, b) => (a.at < b.at ? 1 : -1));
  for (const e of events.slice(0, 4)) needs.push(e.need);

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
    todayOps,
    week7,
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
