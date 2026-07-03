import type { Metadata } from "next";
import {
  Calendar,
  Clock,
  Eye,
  MapPin,
  MessageSquare,
  Search,
  Users,
  Zap,
} from "lucide-react";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { getBrandName } from "@/lib/brand";
import { createServerClient } from "@/lib/supabase/server";

import { DirectoryFilters } from "./_components/DirectoryFilters";
import { QuoteButton } from "./_components/QuoteButton";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandName();
  return {
    title: "Guest requests — travellers looking for a stay",
    description: `Browse live guest requests on ${brand} and send a direct quote. No commission, no middle-man.`,
  };
}

// Native date formatting utility
function formatDistanceToNow(date: Date) {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return "just now";
}

interface Props {
  searchParams: Promise<{
    category?: string;
    region?: string;
    sort?: string;
  }>;
}

export default async function LookingForDirectoryPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = createServerClient();

  // Viewer auth state — drives the Quote CTA (signed-in → straight to the
  // respond page; signed-out → the sign-in-to-quote modal). We only need to
  // know *whether* they're signed in here; the respond page does the host +
  // live-listing gating.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authed = Boolean(user);

  // Build query for public posts
  let query = supabase
    .from("looking_for_posts")
    .select(
      `
      id,
      title,
      description,
      category,
      check_in_date,
      check_out_date,
      adults,
      children,
      infants,
      location_text,
      location_region,
      budget_min,
      budget_max,
      budget_currency,
      budget_per,
      is_urgent,
      view_count,
      quote_count,
      created_at,
      expires_at,
      image_url
    `,
    )
    .eq("status", "active")
    .eq("is_public", true)
    .gt("expires_at", new Date().toISOString());

  // Apply filters
  if (params.category && params.category !== "all") {
    query = query.eq("category", params.category);
  }
  if (params.region && params.region !== "all") {
    query = query.eq("location_region", params.region);
  }

  // Apply sorting
  switch (params.sort) {
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "budget_high":
      query = query.order("budget_max", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "expiring":
      query = query.order("expires_at", { ascending: true });
      break;
    default:
      // Default: urgent first, then newest
      query = query
        .order("is_urgent", { ascending: false })
        .order("created_at", { ascending: false });
  }

  query = query.limit(50);

  const { data: posts } = await query;

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      {/* Hero */}
      <section className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
          <div className="flex items-center gap-2 text-brand-primary">
            <Search className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Guest requests
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-brand-ink md:text-3xl">
            Travellers looking for their next stay
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-mute">
            Real guests, real trips. Browse open requests and send a direct
            quote — no commission, no middle-man.
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="sticky top-16 z-20 border-b border-brand-line bg-white">
        <div className="mx-auto max-w-7xl px-5 py-3 lg:px-8">
          <DirectoryFilters
            currentCategory={params.category}
            currentRegion={params.region}
            currentSort={params.sort}
          />
        </div>
      </section>

      {/* Results */}
      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-xl font-bold tracking-tight text-brand-ink">
            Open requests
          </h2>
          <div className="text-sm text-brand-mute">
            {posts?.length ?? 0} request{(posts?.length ?? 0) !== 1 ? "s" : ""}
          </div>
        </div>

        {!posts || posts.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-white p-12 text-center shadow-card">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="font-display text-lg font-bold text-brand-ink">
              No requests found
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
              Try adjusting your filters or check back later — new guest
              requests come in daily.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {posts.map((post) => {
              const totalGuests =
                post.adults + (post.children ?? 0) + (post.infants ?? 0);

              const budgetDisplay =
                post.budget_min || post.budget_max
                  ? post.budget_min && post.budget_max
                    ? `R${post.budget_min.toLocaleString()} – R${post.budget_max.toLocaleString()}`
                    : post.budget_max
                      ? `Up to R${post.budget_max.toLocaleString()}`
                      : `From R${post.budget_min?.toLocaleString()}`
                  : null;

              const daysLeft = post.expires_at
                ? Math.ceil(
                    (new Date(post.expires_at).getTime() - Date.now()) /
                      (1000 * 60 * 60 * 24),
                  )
                : null;

              return (
                <div
                  key={post.id}
                  className="group relative flex flex-col rounded-card border border-brand-line bg-white shadow-card transition-shadow hover:shadow-md"
                >
                  {/* Stretched link — the whole card opens the detail page.
                      Interactive children sit above it with `relative z-10`. */}
                  <Link
                    href={`/looking-for/${post.id}`}
                    aria-label={post.title}
                    className="absolute inset-0 z-0 rounded-card"
                  />

                  {/* Optional guest photo */}
                  {post.image_url && (
                    <div className="aspect-[16/9] w-full overflow-hidden rounded-t-card border-b border-brand-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-brand-line p-4 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {post.category}
                      </Badge>
                      {post.is_urgent && (
                        <Badge variant="destructive" className="gap-1">
                          <Zap className="h-3 w-3" />
                          Urgent
                        </Badge>
                      )}
                    </div>
                    {post.location_region && (
                      <span className="flex items-center gap-1 text-xs text-brand-mute">
                        <MapPin className="h-3 w-3" />
                        {post.location_region}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4">
                    <h3 className="line-clamp-2 font-display text-base font-semibold text-brand-ink">
                      {post.title}
                    </h3>

                    {post.location_text && (
                      <p className="mt-1 flex items-center gap-1 text-sm text-brand-mute">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{post.location_text}</span>
                      </p>
                    )}

                    <div className="mt-3 space-y-1.5 text-sm text-brand-ink">
                      {(post.check_in_date || post.check_out_date) && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-brand-mute" />
                          <span>
                            {post.check_in_date && post.check_out_date
                              ? `${new Date(post.check_in_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} – ${new Date(post.check_out_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`
                              : post.check_in_date
                                ? `From ${new Date(post.check_in_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`
                                : "Flexible"}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-brand-mute" />
                        <span>
                          {totalGuests} guest{totalGuests !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {budgetDisplay && (
                        <div className="flex items-center gap-2">
                          <span className="text-brand-mute">R</span>
                          <span>
                            {budgetDisplay}
                            {post.budget_per && (
                              <span className="text-brand-mute">
                                {" "}
                                /{post.budget_per}
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    {post.description && (
                      <p className="mt-3 line-clamp-2 text-sm text-brand-mute">
                        &ldquo;{post.description}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between gap-2 border-t border-brand-line px-4 py-3">
                    <div className="flex items-center gap-3 text-xs text-brand-mute">
                      <span className="flex items-center gap-1" title="Views">
                        <Eye className="h-3.5 w-3.5" />
                        {post.view_count}
                      </span>
                      <span
                        className="flex items-center gap-1"
                        title="Quotes sent"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        {post.quote_count > 5 ? "5+" : post.quote_count}
                      </span>
                      <span className="flex items-center gap-1" title="Posted">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDistanceToNow(new Date(post.created_at))}
                      </span>
                    </div>
                    {/* Above the stretched link so the button is clickable. */}
                    <QuoteButton
                      postId={post.id}
                      authed={authed}
                      className="relative z-10 shrink-0"
                    />
                  </div>

                  {daysLeft !== null && daysLeft <= 7 && (
                    <span className="pointer-events-none absolute right-3 top-3 rounded-pill bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      {daysLeft <= 0 ? "Expires today" : `${daysLeft}d left`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* CTA for hosts */}
        <div className="mt-12 overflow-hidden rounded-card bg-brand-gradient-dark p-8 text-center text-white">
          <h2 className="font-display text-xl font-bold">
            Are you a host or property owner?
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-white/80">
            Respond to guest requests with a direct quote and grow your bookings
            — one flat subscription, zero commission per booking.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup/host"
              className="rounded-pill bg-white px-5 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-white/90"
            >
              Get started free
            </Link>
            <Link
              href="/dashboard/looking-for"
              className="rounded-pill border border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Host dashboard
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
