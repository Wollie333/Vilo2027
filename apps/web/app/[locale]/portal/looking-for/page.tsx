import { redirect } from "next/navigation";
import {
  Search,
  Plus,
  Eye,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
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
import { guestCan } from "@/lib/guests/permissions";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function GuestLookingForPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/portal/looking-for");
  }

  // Fetch guest's own posts
  const { data: posts } = await supabase
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
      budget_min,
      budget_max,
      budget_currency,
      status,
      is_urgent,
      view_count,
      quote_count,
      created_at,
      expires_at
    `,
    )
    .eq("guest_id", user.id)
    .order("created_at", { ascending: false });

  // Global guest permission (admin: Feature permissions → Guests). When off,
  // hide the post CTAs — the action is gated too, so this is UX only.
  const canPost = await guestCan("looking_for_post");

  // Get counts by status
  const activeCount = posts?.filter((p) => p.status === "active").length ?? 0;
  const fulfilledCount =
    posts?.filter((p) => p.status === "fulfilled").length ?? 0;
  const expiredCount = posts?.filter((p) => p.status === "expired").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <Search className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-brand-ink">
              Looking For
            </h1>
            <p className="mt-1 text-sm text-brand-mute">
              Post what you&apos;re looking for and receive quotes from hosts
            </p>
          </div>
        </div>
        {canPost ? (
          <Button asChild className="gap-1.5">
            <Link href="/portal/looking-for/new">
              <Plus className="h-4 w-4" />
              Post a Request
            </Link>
          </Button>
        ) : null}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-card border border-brand-line bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-brand-mute">
            <Clock className="h-4 w-4" />
            Active
          </div>
          <p className="mt-1 text-2xl font-bold text-brand-ink">
            {activeCount}
          </p>
        </div>
        <div className="rounded-card border border-brand-line bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-brand-mute">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Fulfilled
          </div>
          <p className="mt-1 text-2xl font-bold text-brand-ink">
            {fulfilledCount}
          </p>
        </div>
        <div className="rounded-card border border-brand-line bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-brand-mute">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            Expired
          </div>
          <p className="mt-1 text-2xl font-bold text-brand-ink">
            {expiredCount}
          </p>
        </div>
      </div>

      {/* Posts list */}
      {!posts || posts.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand-mute">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="font-display text-lg font-semibold text-brand-ink">
            No requests yet
          </h3>
          <p className="mt-2 text-sm text-brand-mute">
            Post what you&apos;re looking for and hosts will send you quotes.
          </p>
          {canPost ? (
            <Button asChild className="mt-4 gap-1.5">
              <Link href="/portal/looking-for/new">
                <Plus className="h-4 w-4" />
                Post Your First Request
              </Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/portal/looking-for/${post.id}`}
              className="block rounded-card border border-brand-line bg-white p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-medium text-brand-ink">
                      {post.title}
                    </h3>
                    <StatusBadge status={post.status} />
                    {post.is_urgent && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                        Urgent
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-brand-mute">
                    {post.location_text ?? post.category}
                    {post.check_in_date && (
                      <span>
                        {" "}
                        ·{" "}
                        {new Date(post.check_in_date).toLocaleDateString(
                          "en-ZA",
                          { day: "numeric", month: "short" },
                        )}
                        {post.check_out_date && (
                          <>
                            {" "}
                            –{" "}
                            {new Date(post.check_out_date).toLocaleDateString(
                              "en-ZA",
                              { day: "numeric", month: "short" },
                            )}
                          </>
                        )}
                      </span>
                    )}
                    {post.adults && (
                      <span>
                        {" "}
                        ·{" "}
                        {post.adults +
                          (post.children ?? 0) +
                          (post.infants ?? 0)}{" "}
                        guest
                        {post.adults +
                          (post.children ?? 0) +
                          (post.infants ?? 0) !==
                        1
                          ? "s"
                          : ""}
                      </span>
                    )}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <div className="flex items-center justify-end gap-3 text-sm text-brand-mute">
                    <span className="flex items-center gap-1" title="Views">
                      <Eye className="h-3.5 w-3.5" />
                      {post.view_count}
                    </span>
                    <span
                      className="flex items-center gap-1"
                      title="Quotes received"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {post.quote_count}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-brand-mute">
                    {formatDistanceToNow(new Date(post.created_at))}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    draft: "bg-gray-100 text-gray-600",
    expired: "bg-amber-100 text-amber-700",
    fulfilled: "bg-blue-100 text-blue-700",
    cancelled: "bg-red-100 text-red-700",
  };

  const labels: Record<string, string> = {
    active: "Active",
    draft: "Draft",
    expired: "Expired",
    fulfilled: "Fulfilled",
    cancelled: "Cancelled",
  };

  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${styles[status] ?? styles.draft}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
