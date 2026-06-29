import { redirect } from "next/navigation";
import { Bookmark } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";
import { hostHasFeature } from "@/lib/products/featureGate";
import { LookingForLocked } from "../_components/LookingForLocked";

export default async function SavedRequestsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/looking-for/saved");
  }

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!host) {
    redirect("/dashboard");
  }

  const canLookingFor = await hostHasFeature(host.id, "looking_for_access");

  if (!canLookingFor) {
    return (
      <div className="space-y-6">
        <SavedHeader />
        <LookingForLocked />
      </div>
    );
  }

  // Fetch bookmarked posts
  const { data: bookmarks } = await supabase
    .from("looking_for_bookmarks")
    .select(
      `
      id,
      saved_at,
      post:looking_for_posts(
        id,
        title,
        category,
        check_in_date,
        check_out_date,
        location_text,
        budget_max,
        budget_currency,
        status,
        quote_count
      )
    `,
    )
    .eq("host_id", host.id)
    .order("saved_at", { ascending: false });

  return (
    <div className="space-y-6">
      <SavedHeader />

      {!bookmarks || bookmarks.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand-mute">
            <Bookmark className="h-6 w-6" />
          </div>
          <h3 className="font-display text-lg font-semibold text-brand-ink">
            No saved requests
          </h3>
          <p className="mt-2 text-sm text-brand-mute">
            Bookmark requests you want to respond to later.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookmarks.map((bookmark) => {
            const post = bookmark.post as unknown as {
              id: string;
              title: string;
              category: string;
              check_in_date: string | null;
              location_text: string | null;
              budget_max: number | null;
              status: string;
              quote_count: number;
            } | null;

            if (!post) return null;

            return (
              <div
                key={bookmark.id}
                className="flex items-center justify-between rounded-card border border-brand-line bg-white p-4"
              >
                <div>
                  <h3 className="font-medium text-brand-ink">{post.title}</h3>
                  <p className="text-sm text-brand-mute">
                    {post.location_text ?? post.category}
                    {post.check_in_date && (
                      <span>
                        {" "}
                        ·{" "}
                        {new Date(post.check_in_date).toLocaleDateString(
                          "en-ZA",
                          { day: "numeric", month: "short" },
                        )}
                      </span>
                    )}
                    {post.budget_max && (
                      <span> · Up to R{post.budget_max.toLocaleString()}</span>
                    )}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <span
                    className={`${post.status === "active" ? "text-green-600" : "text-brand-mute"}`}
                  >
                    {post.status === "active" ? "Active" : post.status}
                  </span>
                  <p className="text-xs text-brand-mute">
                    {post.quote_count} quotes
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SavedHeader() {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
        <Bookmark className="h-6 w-6" />
      </div>
      <div>
        <h1 className="font-display text-xl font-bold text-brand-ink">
          Saved Requests
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Requests you&apos;ve bookmarked to respond to later
        </p>
      </div>
    </div>
  );
}
