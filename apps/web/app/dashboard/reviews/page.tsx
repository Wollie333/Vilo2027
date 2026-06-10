import type { Metadata } from "next";
import {
  Clock,
  Hourglass,
  Lightbulb,
  Star,
  Star as StarIcon,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";

import { reviewPhotoUrl } from "@/lib/reviews/photos";
import { createServerClient } from "@/lib/supabase/server";

import { FilterTabs } from "./FilterTabs";
import { ReviewCard, type ReviewCardProps } from "./ReviewCard";
import { StarRow } from "./StarRow";

export const metadata: Metadata = {
  title: "Reviews",
};

export const dynamic = "force-dynamic";

type SearchParams = {
  tab?: string;
  listing?: string;
  rating?: string;
};

const PAGE_SIZE = 50;
const STAR_BAR_COLOURS: Record<number, string> = {
  5: "bg-brand-primary",
  4: "bg-emerald-300",
  3: "bg-status-pending",
  2: "bg-status-cancelled",
  1: "bg-status-cancelled",
};

function monthLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-ZA", { month: "short", year: "numeric" });
}

// Stays under 1 decimal place — matches the design's "4.92" treatment.
function roundOne(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

// First letters of the first two words of a listing name, upper-cased.
// Pulled out of the JSX so TS doesn't lose the parameter type when the
// surrounding Supabase row is inferred loosely.
function listingInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p: string) => p[0]?.toUpperCase() ?? "")
      .join("") || "L"
  );
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <ReviewsEmpty title="Sign in to manage reviews" />;
  }

  const { data: host } = await supabase
    .from("hosts")
    .select("id, display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host) {
    return (
      <ReviewsEmpty
        title="Create your host profile first"
        body="Guest reviews land here once you've got a listing with completed stays."
      />
    );
  }

  const tab = (searchParams?.tab ?? "all").trim();
  const listingFilter = (searchParams?.listing ?? "").trim();
  const ratingRaw = parseInt(searchParams?.rating ?? "", 10);
  const ratingFilter =
    Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5
      ? ratingRaw
      : null;

  // ─── Counts per filter tab (run in parallel, ignore active tab) ──
  const baseCountQuery = () =>
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("host_id", host.id);

  const [
    { count: allCount },
    { count: needsReplyCount },
    { count: repliedCount },
    { count: flaggedCount },
    { data: hostListings },
  ] = await Promise.all([
    baseCountQuery(),
    baseCountQuery().is("host_response", null),
    baseCountQuery().not("host_response", "is", null),
    baseCountQuery().eq("flagged", true),
    supabase
      .from("listings")
      .select("id, name, avg_rating, total_reviews")
      .eq("host_id", host.id)
      .is("deleted_at", null)
      .order("total_reviews", { ascending: false }),
  ]);

  // ─── Stats: overall rating + breakdown across all reviews ────────
  const { data: allRatings } = await supabase
    .from("reviews")
    .select("rating, host_response, host_responded_at, created_at")
    .eq("host_id", host.id);

  const ratings = (allRatings ?? []).map((r) => r.rating);
  const totalReviews = ratings.length;
  const avgRating =
    totalReviews > 0 ? ratings.reduce((a, b) => a + b, 0) / totalReviews : 0;

  const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ratings) {
    if (r >= 1 && r <= 5) breakdown[r] += 1;
  }
  const breakdownMax = Math.max(1, ...Object.values(breakdown));

  // Response rate (across all reviews) and avg reply time in hours
  const replied = (allRatings ?? []).filter(
    (r) => r.host_response != null && r.host_responded_at != null,
  );
  const responseRate =
    totalReviews > 0 ? Math.round((replied.length / totalReviews) * 100) : 0;
  const replyHours =
    replied.length > 0
      ? replied.reduce((acc, r) => {
          const created = new Date(r.created_at).getTime();
          const respondedAt = r.host_responded_at as string;
          const reply = new Date(respondedAt).getTime();
          return acc + Math.max(0, (reply - created) / 3_600_000);
        }, 0) / replied.length
      : 0;

  // ─── Reviews feed query (paginated, filtered) ────────────────────
  let feedQuery = supabase
    .from("reviews")
    .select(
      `
      id, rating, body, host_response, host_responded_at, flagged, created_at,
      listing:listings ( id, name ),
      booking:bookings ( id, check_in, check_out, nights, guest_name ),
      guest:user_profiles!reviews_guest_id_fkey ( full_name ),
      photos:review_photos ( storage_path, sort_order )
    `,
    )
    .eq("host_id", host.id)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (tab === "needs-reply") feedQuery = feedQuery.is("host_response", null);
  else if (tab === "replied")
    feedQuery = feedQuery.not("host_response", "is", null);
  else if (tab === "flagged") feedQuery = feedQuery.eq("flagged", true);

  if (listingFilter) feedQuery = feedQuery.eq("listing_id", listingFilter);
  if (ratingFilter) feedQuery = feedQuery.eq("rating", ratingFilter);

  const { data: feedRaw } = await feedQuery;

  type Row = {
    id: string;
    rating: number;
    body: string | null;
    host_response: string | null;
    host_responded_at: string | null;
    flagged: boolean;
    created_at: string;
    listing:
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
    booking:
      | {
          id: string;
          check_in: string | null;
          check_out: string | null;
          nights: number | null;
          guest_name: string | null;
        }
      | {
          id: string;
          check_in: string | null;
          check_out: string | null;
          nights: number | null;
          guest_name: string | null;
        }[]
      | null;
    guest: { full_name: string | null } | { full_name: string | null }[] | null;
    photos: { storage_path: string; sort_order: number }[] | null;
  };

  const reviews: ReviewCardProps[] = ((feedRaw as Row[] | null) ?? []).map(
    (r) => {
      const listing = Array.isArray(r.listing) ? r.listing[0] : r.listing;
      const booking = Array.isArray(r.booking) ? r.booking[0] : r.booking;
      const guest = Array.isArray(r.guest) ? r.guest[0] : r.guest;
      return {
        id: r.id,
        rating: r.rating,
        body: r.body,
        createdAt: r.created_at,
        hostResponse: r.host_response,
        hostRespondedAt: r.host_responded_at,
        flagged: r.flagged,
        guestName: guest?.full_name ?? booking?.guest_name ?? "Anonymous guest",
        listingName: listing?.name ?? "Listing",
        nights: booking?.nights ?? null,
        stayMonth: monthLabel(booking?.check_in ?? null),
        photos: (r.photos ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((p) => reviewPhotoUrl(p.storage_path)),
      };
    },
  );

  const needsReplyTotal = needsReplyCount ?? 0;
  const allTotal = allCount ?? 0;
  const repliedTotal = repliedCount ?? 0;
  const flaggedTotal = flaggedCount ?? 0;

  return (
    <div className="space-y-7">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            Reviews
          </h1>
          {needsReplyTotal > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-pill border border-status-pending/30 bg-status-pending/10 px-2 py-0.5 text-[11px] font-medium text-status-pending">
              <Hourglass className="h-3 w-3" />
              {needsReplyTotal} awaiting your reply
            </span>
          ) : null}
        </div>
        <p className="text-sm text-brand-mute">
          Verified-stay reviews from guests across all your listings.
        </p>
      </header>

      {/* ─── Summary row ────────────────────────────────────────── */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* Overall rating */}
        <div className="rounded-card border border-brand-line bg-white p-6 shadow-card">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-mute">
            Overall rating
          </div>
          <div className="mt-3 flex items-end gap-2">
            <div className="num font-display text-6xl font-bold leading-none text-brand-ink">
              {totalReviews > 0 ? roundOne(avgRating) : "—"}
            </div>
            <div className="pb-2 text-sm text-brand-mute">/ 5.0</div>
          </div>
          <div className="mt-2">
            <StarRow rating={avgRating} size="md" />
          </div>
          <div className="mt-4 text-[13px] text-brand-mute">
            From{" "}
            <span className="num font-semibold text-brand-ink">
              {totalReviews}
            </span>{" "}
            verified guest {totalReviews === 1 ? "review" : "reviews"}
          </div>
          {totalReviews > 0 ? (
            <div className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-status-confirmed">
              <TrendingUp className="h-3.5 w-3.5" />
              Tracking across all listings
            </div>
          ) : null}
        </div>

        {/* Rating breakdown */}
        <div className="rounded-card border border-brand-line bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-mute">
              Rating breakdown
            </div>
            <span className="text-[11px] text-brand-mute">all time</span>
          </div>
          <div className="mt-5 space-y-2.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = breakdown[star];
              const pct =
                totalReviews > 0
                  ? Math.max(2, Math.round((count / breakdownMax) * 100))
                  : 0;
              return (
                <div
                  key={star}
                  className="flex items-center gap-3 text-[12.5px]"
                >
                  <span className="w-3 font-medium text-brand-mute">
                    {star}
                  </span>
                  <Star
                    className="h-3 w-3 fill-amber-400 text-amber-400"
                    aria-hidden
                  />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-brand-light">
                    {count > 0 ? (
                      <div
                        className={`h-full rounded-pill ${STAR_BAR_COLOURS[star]}`}
                        style={{ width: `${pct}%` }}
                      />
                    ) : null}
                  </div>
                  <span className="num w-10 text-right text-brand-mute">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-brand-line pt-5">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                Response rate
              </div>
              <div className="num mt-1 font-display text-xl font-bold text-brand-ink">
                {responseRate}%
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                Avg. reply time
              </div>
              <div className="num mt-1 font-display text-xl font-bold text-brand-ink">
                {replied.length > 0 ? `${replyHours.toFixed(1)}h` : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Tip / nudge card */}
        <div className="rounded-card border border-brand-line bg-brand-light/60 p-6 shadow-card">
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-brand-line bg-white">
              <Lightbulb className="h-4 w-4 text-brand-primary" />
            </div>
            <div className="flex-1">
              <div className="font-display text-[14px] font-semibold text-brand-ink">
                {needsReplyTotal > 0
                  ? "Reply within 24 hours"
                  : "Up to date — nice work"}
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-brand-mute">
                {needsReplyTotal > 0 ? (
                  <>
                    Hosts who respond to every review see{" "}
                    <span className="font-semibold text-brand-ink">2.4×</span>{" "}
                    more repeat bookings. You have{" "}
                    <span className="font-semibold text-brand-ink">
                      {needsReplyTotal}
                    </span>{" "}
                    waiting.
                  </>
                ) : (
                  "Every review on your account has a reply. Guests notice."
                )}
              </p>
              {needsReplyTotal > 0 ? (
                <Link
                  href="/dashboard/reviews?tab=needs-reply"
                  className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-primary hover:text-brand-secondary"
                >
                  Reply now →
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-5 border-t border-brand-line pt-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
              Reviewing rate
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[13px] text-brand-mute">
              <Users className="h-3.5 w-3.5" />
              <span className="num font-semibold text-brand-ink">
                {repliedTotal}
              </span>{" "}
              of {allTotal} replied
              {flaggedTotal > 0 ? (
                <span className="ml-auto inline-flex items-center gap-1 rounded-pill border border-status-cancelled/30 bg-status-cancelled/10 px-2 py-0.5 text-[10px] font-medium text-status-cancelled">
                  {flaggedTotal} flagged
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Filter bar ─────────────────────────────────────────── */}
      <section className="flex flex-wrap items-center gap-2.5">
        <FilterTabs
          current={tab}
          counts={{
            all: allTotal,
            needsReply: needsReplyTotal,
            replied: repliedTotal,
            flagged: flaggedTotal,
          }}
        />
        {ratingFilter || listingFilter || tab !== "all" ? (
          <Link
            href="/dashboard/reviews"
            className="text-xs font-medium text-brand-primary hover:underline"
          >
            Clear filters
          </Link>
        ) : null}
        <div className="ml-auto inline-flex items-center gap-2 text-[12px] text-brand-mute">
          <Clock className="h-3.5 w-3.5" />
          Newest first
        </div>
      </section>

      {/* ─── Feed + Aside ───────────────────────────────────────── */}
      <section className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* Feed */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
                <StarIcon className="h-6 w-6" />
              </div>
              <h2 className="font-display text-lg font-bold text-brand-ink">
                {tab === "needs-reply"
                  ? "No reviews awaiting your reply"
                  : tab === "replied"
                    ? "No replied reviews match this filter"
                    : tab === "flagged"
                      ? "No flagged reviews"
                      : "No reviews yet"}
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
                {tab === "all"
                  ? "Once a guest completes a stay, they'll be invited to leave a review 24 hours after checkout."
                  : "Try changing the filter to see other reviews."}
              </p>
            </div>
          ) : (
            reviews.map((r) => <ReviewCard key={r.id} {...r} />)
          )}
        </div>

        {/* Aside — per-listing performance */}
        <aside className="space-y-4">
          <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-mute">
              Listing performance
            </div>
            {hostListings && hostListings.length > 0 ? (
              <div className="space-y-3">
                {hostListings.map((l) => {
                  const isActive = listingFilter === l.id;
                  const filterHref = isActive
                    ? "/dashboard/reviews"
                    : `/dashboard/reviews?listing=${l.id}`;
                  return (
                    <Link
                      key={l.id}
                      href={filterHref}
                      className={`-mx-2 flex items-center gap-3 rounded p-2 transition-colors ${
                        isActive
                          ? "bg-brand-accent/40"
                          : "hover:bg-brand-light/60"
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-accent/60 font-mono text-[10px] font-semibold text-brand-secondary">
                        {listingInitials(l.name as string)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-brand-ink">
                          {l.name}
                        </div>
                        <div className="num text-[11px] text-brand-mute">
                          {l.total_reviews ?? 0}{" "}
                          {l.total_reviews === 1 ? "review" : "reviews"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="num inline-flex items-center gap-0.5 font-display text-sm font-bold text-brand-ink">
                          {l.avg_rating != null && (l.avg_rating as number) > 0
                            ? roundOne(l.avg_rating as number)
                            : "—"}
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-brand-mute">
                No listings yet. Reviews land here once you publish your first.
              </p>
            )}
          </div>

          <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-mute">
              Filter by rating
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const isActive = ratingFilter === star;
                const next = new URLSearchParams();
                if (tab !== "all") next.set("tab", tab);
                if (listingFilter) next.set("listing", listingFilter);
                if (!isActive) next.set("rating", String(star));
                const qs = next.toString();
                const href = qs
                  ? `/dashboard/reviews?${qs}`
                  : "/dashboard/reviews";
                return (
                  <Link
                    key={star}
                    href={href}
                    className={`inline-flex items-center gap-1 rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-brand-secondary text-white"
                        : "border border-brand-line bg-white text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                    }`}
                  >
                    {star}
                    <Star
                      className={`h-3 w-3 ${
                        isActive
                          ? "fill-white text-white"
                          : "fill-amber-400 text-amber-400"
                      }`}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function ReviewsEmpty({ title, body }: { title: string; body?: string }) {
  return (
    <div>
      <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <Star className="h-6 w-6" />
        </div>
        <h1 className="font-display text-lg font-bold text-brand-ink">
          {title}
        </h1>
        {body ? (
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            {body}
          </p>
        ) : null}
      </div>
    </div>
  );
}
