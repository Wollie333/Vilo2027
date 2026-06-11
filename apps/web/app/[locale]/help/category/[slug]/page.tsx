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
import { notFound } from "next/navigation";

import { resolveHelpIcon } from "@/lib/help/icon-map";
import {
  fetchHelpArticles,
  fetchHelpCategoriesWithCounts,
} from "@/lib/help/queries";
import type { HelpAudience } from "@/lib/help/types";
import { createServerClient } from "@/lib/supabase/server";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";

export const dynamic = "force-dynamic";

type Params = { slug: string };
type SearchParams = { as?: string };

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const supabase = createServerClient();
  const { data: cat } = await supabase
    .from("help_categories")
    .select("name, description")
    .eq("slug", params.slug)
    .eq("is_published", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!cat) return { title: "Topic not found" };
  return {
    title: `${(cat as { name: string }).name}`,
    description: (cat as { description?: string }).description || undefined,
    alternates: { canonical: `/help/category/${params.slug}` },
  };
}

function resolveAudience(value: string | undefined): HelpAudience {
  return value === "guest" ? "guest" : "host";
}

export default async function PublicHelpCategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: SearchParams;
}) {
  const audience = resolveAudience(searchParams?.as);
  const supabase = createServerClient();

  const { data: cat } = await supabase
    .from("help_categories")
    .select("id, name, slug, description, icon, audience")
    .eq("slug", params.slug)
    .is("deleted_at", null)
    .eq("is_published", true)
    .maybeSingle();
  if (!cat) notFound();

  const [articles, allCategories] = await Promise.all([
    fetchHelpArticles({
      audience,
      sort: "popular",
      limit: 50,
      categorySlug: params.slug,
    }),
    fetchHelpCategoriesWithCounts(audience),
  ]);

  const Icon = resolveHelpIcon((cat as { icon?: string }).icon ?? null);

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      <main className="mx-auto max-w-[1200px] space-y-6 px-5 py-8 lg:px-8 lg:py-12">
        <Link
          href="/help"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-mute hover:text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" /> All topics
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-secondary">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-brand-ink sm:text-3xl">
                {(cat as { name: string }).name}
              </h1>
              {(cat as { description?: string | null }).description ? (
                <p className="mt-1 text-sm text-brand-mute">
                  {(cat as { description: string }).description}
                </p>
              ) : null}
            </div>
          </div>
          <span className="num inline-flex items-center rounded-pill bg-brand-light px-2 py-0.5 font-mono text-xs text-brand-mute">
            {articles.length} article{articles.length === 1 ? "" : "s"}
          </span>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
          <div className="overflow-hidden rounded-card border border-brand-line bg-white">
            {articles.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-brand-mute">
                No articles in this category yet.
              </p>
            ) : (
              <ol className="divide-y divide-brand-line">
                {articles.map((a, i) => (
                  <li key={a.id}>
                    <Link
                      href={`/help/${a.slug}`}
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
                          <span className="inline-flex items-center gap-1">
                            <ClockIcon className="h-3 w-3" />{" "}
                            {a.read_time_minutes} min read
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
                              <Bookmark className="h-3 w-3" /> {a.view_count}{" "}
                              views
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

          <aside className="space-y-3">
            <div className="rounded-card border border-brand-line bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                Other topics
              </div>
              <ul className="mt-3 space-y-1">
                {allCategories
                  .filter((c) => c.slug !== params.slug)
                  .map((c) => {
                    const I = resolveHelpIcon(c.icon);
                    return (
                      <li key={c.id}>
                        <Link
                          href={`/help/category/${c.slug}`}
                          className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-brand-ink hover:bg-brand-light"
                        >
                          <I className="h-4 w-4 text-brand-mute" />
                          <span className="flex-1 truncate">{c.name}</span>
                          <span className="num font-mono text-[10px] text-brand-mute">
                            {c.article_count}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
