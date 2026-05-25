import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ClockIcon,
  ThumbsUp,
  Video,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  fetchHelpArticles,
  fetchHelpCategoriesWithCounts,
} from "@/lib/help/queries";
import type { HelpAudience } from "@/lib/help/types";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = { as?: string };

export const metadata: Metadata = { title: "All help articles · Vilo" };

function resolveAudience(value: string | undefined): HelpAudience {
  return value === "guest" ? "guest" : "host";
}

export default async function AllHelpArticlesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/help/articles");

  const audience = resolveAudience(searchParams?.as);

  const [articles, categories] = await Promise.all([
    fetchHelpArticles({ audience, sort: "updated", limit: 100 }),
    fetchHelpCategoriesWithCounts(audience),
  ]);

  const categoryLabel = Object.fromEntries(
    categories.map((c) => [c.id, c.name]),
  );

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <Link
        href="/dashboard/help"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-mute hover:text-brand-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to help
      </Link>

      <header>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          Library
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold text-brand-ink sm:text-3xl">
          All articles
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          {articles.length} published article{articles.length === 1 ? "" : "s"},
          sorted by most-recently updated.
        </p>
      </header>

      <div className="overflow-hidden rounded-card border border-brand-line bg-white">
        {articles.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-brand-mute">
            No articles published yet.
          </p>
        ) : (
          <ol className="divide-y divide-brand-line">
            {articles.map((a, i) => (
              <li key={a.id}>
                <Link
                  href={`/dashboard/help/${a.slug}`}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-brand-light/60"
                >
                  <span className="num w-6 shrink-0 font-mono text-xs text-brand-mute">
                    {(i + 1).toString().padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-brand-ink">
                      {a.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-brand-mute">
                      {a.category_id && categoryLabel[a.category_id] ? (
                        <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand-secondary">
                          {categoryLabel[a.category_id]}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon className="h-3 w-3" /> {a.read_time_minutes}{" "}
                        min read
                      </span>
                      {a.has_video ? (
                        <span className="inline-flex items-center gap-1">
                          <Video className="h-3 w-3" /> Includes video
                        </span>
                      ) : a.helpful_count > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" /> {a.helpful_count}{" "}
                          helpful
                        </span>
                      ) : a.view_count > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Bookmark className="h-3 w-3" /> {a.view_count} views
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-brand-mute transition-transform group-hover:translate-x-0.5 group-hover:text-brand-ink" />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
