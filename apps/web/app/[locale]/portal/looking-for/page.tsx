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

import { createServerClient } from "@/lib/supabase/server";
import { guestCan } from "@/lib/guests/permissions";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// Native relative-time helper (kept local — this list has no other date needs).
function formatDistanceToNow(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return "just now";
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "fulfilled", label: "Fulfilled" },
  { key: "expired", label: "Expired" },
  { key: "cancelled", label: "Cancelled" },
] as const;

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function GuestLookingForPage({ searchParams }: Props) {
  const { status: statusFilter = "all" } = await searchParams;
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/portal/looking-for");
  }

  // The guest's own posts — the archive spans every status.
  const { data: posts } = await supabase
    .from("looking_for_posts")
    .select(
      `
      id, title, category, check_in_date, check_out_date, adults, children,
      infants, location_text, status, is_urgent, view_count, quote_count,
      created_at, expires_at
    `,
    )
    .eq("guest_id", user.id)
    .order("created_at", { ascending: false });

  const allPosts = posts ?? [];

  // Per-post unread + last-activity, derived from the response threads. Posts
  // have no direct conversation FK, so map post → response thread_ids →
  // conversations, then fold unread_guest + last_message_at back onto the post.
  const unreadByPost = new Map<string, number>();
  const lastActivityByPost = new Map<string, string>();
  if (allPosts.length > 0) {
    const { data: responses } = await supabase
      .from("looking_for_responses")
      .select("post_id, thread_id")
      .in(
        "post_id",
        allPosts.map((p) => p.id),
      );
    const threadToPost = new Map<string, string>();
    for (const r of responses ?? []) {
      if (r.thread_id) threadToPost.set(r.thread_id, r.post_id);
    }
    const threadIds = Array.from(threadToPost.keys());
    if (threadIds.length > 0) {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, unread_guest, last_message_at")
        .in("id", threadIds);
      for (const c of convs ?? []) {
        const postId = threadToPost.get(c.id);
        if (!postId) continue;
        unreadByPost.set(
          postId,
          (unreadByPost.get(postId) ?? 0) + (c.unread_guest ?? 0),
        );
        if (c.last_message_at) {
          const prev = lastActivityByPost.get(postId);
          if (!prev || c.last_message_at > prev)
            lastActivityByPost.set(postId, c.last_message_at);
        }
      }
    }
  }

  const canPost = await guestCan("looking_for_post");

  const activeCount = allPosts.filter((p) => p.status === "active").length;
  const fulfilledCount = allPosts.filter(
    (p) => p.status === "fulfilled",
  ).length;
  const expiredCount = allPosts.filter((p) => p.status === "expired").length;

  const visible =
    statusFilter === "all"
      ? allPosts
      : allPosts.filter((p) => p.status === statusFilter);

  const countFor = (key: string) =>
    key === "all"
      ? allPosts.length
      : allPosts.filter((p) => p.status === key).length;

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
              Your request archive — manage each post, its quotes and messages
              in one place
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

      {/* Status filter */}
      {allPosts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const isActive = f.key === statusFilter;
            return (
              <Link
                key={f.key}
                href={
                  f.key === "all"
                    ? "/portal/looking-for"
                    : `/portal/looking-for?status=${f.key}`
                }
                className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[13px] font-semibold transition ${
                  isActive
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-brand-line bg-white text-brand-mute hover:bg-brand-light"
                }`}
              >
                {f.label}
                <span
                  className={`rounded-pill px-1.5 text-[11px] tabular-nums ${isActive ? "bg-white/20" : "bg-brand-light text-brand-mute"}`}
                >
                  {countFor(f.key)}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Posts list */}
      {allPosts.length === 0 ? (
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
      ) : visible.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center text-sm text-brand-mute">
          No {statusFilter} requests.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((post) => {
            const unread = unreadByPost.get(post.id) ?? 0;
            const lastActivity =
              lastActivityByPost.get(post.id) ?? post.created_at;
            const guests =
              post.adults + (post.children ?? 0) + (post.infants ?? 0);
            return (
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
                      {unread > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-primary px-1.5 text-[11px] font-semibold text-white">
                          {unread}
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
                                {
                                  day: "numeric",
                                  month: "short",
                                },
                              )}
                            </>
                          )}
                        </span>
                      )}
                      {guests > 0 && (
                        <span>
                          {" "}
                          · {guests} guest{guests !== 1 ? "s" : ""}
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
                      {formatDistanceToNow(new Date(lastActivity))}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
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
