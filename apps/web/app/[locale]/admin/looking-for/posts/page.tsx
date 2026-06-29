import { Search, Eye } from "lucide-react";

import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";

import { PostActions } from "./PostActions";

export const dynamic = "force-dynamic";

// Helper for relative time
function formatTimeAgo(date: string) {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return "just now";
}

export default async function LookingForPostsPage() {
  await requirePermission("platform.features");
  const service = createAdminClient();

  const { data: posts } = await service
    .from("looking_for_posts")
    .select(
      `
      id,
      title,
      category,
      location_region,
      status,
      is_public,
      is_urgent,
      view_count,
      quote_count,
      created_at,
      expires_at,
      guest:user_profiles!guest_id(id, full_name, email)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const statusStyles: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    fulfilled: "bg-blue-100 text-blue-700",
    expired: "bg-gray-100 text-gray-700",
    cancelled: "bg-red-100 text-red-700",
    flagged: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <Search className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Looking For Posts
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Review and moderate guest requests. Flag inappropriate content or
            remove spam posts.
          </p>
        </div>
      </header>

      <div className="rounded-card border border-brand-line bg-white">
        <div className="border-b border-brand-line px-6 py-4">
          <h2 className="font-display font-semibold text-brand-ink">
            Recent Posts ({posts?.length ?? 0})
          </h2>
        </div>

        {!posts || posts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-brand-mute">No posts yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-brand-line">
            {posts.map((post) => {
              const guest = post.guest as unknown as {
                id: string;
                full_name: string | null;
                email: string;
              } | null;

              const isExpired =
                post.expires_at && new Date(post.expires_at) < new Date();

              return (
                <div
                  key={post.id}
                  className="flex items-center justify-between p-4 hover:bg-brand-light/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/looking-for/${post.id}`}
                        className="truncate font-medium text-brand-ink hover:text-brand-primary"
                      >
                        {post.title}
                      </Link>
                      {post.is_urgent && (
                        <Badge variant="destructive" className="text-xs">
                          Urgent
                        </Badge>
                      )}
                      {!post.is_public && (
                        <Badge variant="secondary" className="text-xs">
                          Private
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-brand-mute">
                      <span>
                        By{" "}
                        <Link
                          href={`/admin/users/${guest?.id}`}
                          className="underline"
                        >
                          {guest?.full_name ?? guest?.email ?? "Unknown"}
                        </Link>
                      </span>
                      <span>{post.category}</span>
                      {post.location_region && (
                        <span>{post.location_region}</span>
                      )}
                      <span>{formatTimeAgo(post.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right text-xs text-brand-mute">
                      <div className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {post.view_count}
                      </div>
                      <div>{post.quote_count} quotes</div>
                    </div>

                    <Badge
                      variant="secondary"
                      className={`${statusStyles[isExpired ? "expired" : post.status] ?? statusStyles.active}`}
                    >
                      {isExpired ? "Expired" : post.status}
                    </Badge>

                    <PostActions
                      postId={post.id}
                      status={isExpired ? "expired" : post.status}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
