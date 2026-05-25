"use client";

import { ArrowRight, Bookmark, ClockIcon, ThumbsUp, Video } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { HelpArticleListItem } from "@/lib/help/types";

type Props = {
  basePath: string;
  popular: HelpArticleListItem[];
  newest: HelpArticleListItem[];
  updated: HelpArticleListItem[];
  categoryLabel: Record<string, string>;
};

type Tab = "popular" | "newest" | "updated";

export function PopularArticles({
  basePath,
  popular,
  newest,
  updated,
  categoryLabel,
}: Props) {
  const [tab, setTab] = useState<Tab>("popular");
  const rows =
    tab === "popular" ? popular : tab === "newest" ? newest : updated;

  return (
    <div className="overflow-hidden rounded-card border border-brand-line bg-white">
      <div className="flex items-center justify-between border-b border-brand-line p-5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Popular this week
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
            Top articles
          </h3>
        </div>
        <div
          role="tablist"
          aria-label="Sort articles"
          className="inline-flex rounded-pill border border-brand-line bg-brand-light p-1 text-[11px] font-medium"
        >
          <TabButton
            active={tab === "popular"}
            onClick={() => setTab("popular")}
          >
            Popular
          </TabButton>
          <TabButton active={tab === "newest"} onClick={() => setTab("newest")}>
            Newest
          </TabButton>
          <TabButton
            active={tab === "updated"}
            onClick={() => setTab("updated")}
          >
            Updated
          </TabButton>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-brand-mute">
          No articles yet.
        </p>
      ) : (
        <ol className="divide-y divide-brand-line">
          {rows.map((a, i) => (
            <li key={a.id}>
              <Link
                href={`${basePath}/${a.slug}`}
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
                    ) : a.helpful_count + a.not_helpful_count >= 5 ? (
                      <span className="inline-flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />{" "}
                        {Math.round(
                          (a.helpful_count /
                            Math.max(
                              1,
                              a.helpful_count + a.not_helpful_count,
                            )) *
                            100,
                        )}
                        % helpful
                      </span>
                    ) : a.view_count > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Bookmark className="h-3 w-3" /> Viewed {a.view_count}×
                      </span>
                    ) : null}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-brand-mute transition-all group-hover:translate-x-0.5 group-hover:text-brand-ink" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-pill px-3 py-1 transition-colors ${
        active
          ? "bg-white text-brand-ink shadow-card"
          : "text-brand-mute hover:text-brand-ink"
      }`}
    >
      {children}
    </button>
  );
}
