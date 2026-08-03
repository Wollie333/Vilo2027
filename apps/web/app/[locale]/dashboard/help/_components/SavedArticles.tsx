import { ArrowRight, BookmarkCheck, ClockIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

import type { HelpArticleListItem } from "@/lib/help/types";

type Props = {
  basePath: string;
  articles: HelpArticleListItem[];
  categoryLabel: Record<string, string>;
};

// Reader's own bookmarked articles (real help_article_saves rows). Only rendered
// when they have at least one save, so the section never shows up empty.
export function SavedArticles({ basePath, articles, categoryLabel }: Props) {
  if (articles.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-card border border-brand-line bg-white">
      <div className="flex items-center gap-2 border-b border-brand-line p-5">
        <BookmarkCheck className="h-4 w-4 text-brand-primary" />
        <h3 className="font-display text-lg font-bold text-brand-ink">
          Saved articles
        </h3>
        <span className="num ml-auto font-mono text-xs text-brand-mute">
          {articles.length}
        </span>
      </div>
      <ol className="divide-y divide-brand-line">
        {articles.map((a) => (
          <li key={a.id}>
            <Link
              href={`${basePath}/${a.slug}`}
              className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-brand-light/60"
            >
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
                    <ClockIcon className="h-3 w-3" /> {a.read_time_minutes} min
                    read
                  </span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-brand-mute transition-all group-hover:translate-x-0.5 group-hover:text-brand-ink" />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
