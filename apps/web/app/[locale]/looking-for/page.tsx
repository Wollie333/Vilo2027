import {
  Search,
  Calendar,
  MapPin,
  Users,
  Clock,
  Eye,
  MessageSquare,
  Zap,
} from "lucide-react";
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

import { createServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { DirectoryFilters } from "./_components/DirectoryFilters";

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
      guest:user_profiles!guest_id(display_name, avatar_url)
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
    <div className="min-h-screen bg-brand-light">
      {/* Hero */}
      <div className="bg-brand-primary text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
              <Search className="h-8 w-8" />
            </div>
            <h1 className="font-display text-3xl font-bold md:text-4xl">
              Guest Requests
            </h1>
            <p className="mt-3 text-lg text-white/80">
              Travelers are looking for unique stays. Can you help?
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters */}
        <DirectoryFilters
          currentCategory={params.category}
          currentRegion={params.region}
          currentSort={params.sort}
        />

        {/* Results */}
        <div className="mt-6">
          {!posts || posts.length === 0 ? (
            <div className="rounded-card border border-dashed border-brand-line bg-white p-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand-mute">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="font-display text-lg font-semibold text-brand-ink">
                No requests found
              </h3>
              <p className="mt-2 text-sm text-brand-mute">
                Try adjusting your filters or check back later.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                  <Link
                    key={post.id}
                    href={`/looking-for/${post.id}`}
                    className="flex flex-col rounded-card border border-brand-line bg-white shadow-card transition-shadow hover:shadow-md"
                  >
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
                    <div className="flex items-center justify-between border-t border-brand-line px-4 py-3">
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
                        <span
                          className="flex items-center gap-1"
                          title="Posted"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          {formatDistanceToNow(new Date(post.created_at))}
                        </span>
                      </div>
                      {daysLeft !== null && daysLeft <= 7 && (
                        <span className="text-xs text-amber-600">
                          {daysLeft <= 0
                            ? "Expires today"
                            : `${daysLeft}d left`}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* CTA for hosts */}
        <div className="mt-12 rounded-card bg-brand-primary p-8 text-center text-white">
          <h2 className="font-display text-xl font-bold">
            Are you a host or property owner?
          </h2>
          <p className="mt-2 text-white/80">
            Sign up to respond to guest requests and grow your direct bookings.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button asChild variant="secondary">
              <Link href="/signup">Get Started Free</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10"
            >
              <Link href="/dashboard/looking-for">Host Dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
