import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Calendar, ClockIcon, Tag } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveHelpIcon } from "@/lib/help/icon-map";
import {
  fetchHelpArticleBySlug,
  fetchRelatedArticles,
} from "@/lib/help/queries";
import { sanitizeHelpHtml } from "@/lib/help/sanitize";
import { createServerClient } from "@/lib/supabase/server";

import "@/app/help/help-article.css";
import { SiteFooter } from "../../_components/home/SiteFooter";
import { SiteHeader } from "../../_components/home/SiteHeader";
import { ArticleFeedback } from "../../dashboard/help/_components/ArticleFeedback";
import { ArticleView } from "../../dashboard/help/_components/ArticleView";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const article = await fetchHelpArticleBySlug(params.slug);
  if (!article) return { title: "Article not found" };
  return {
    title: `${article.title}`,
    description: article.excerpt || undefined,
    alternates: { canonical: `/help/${article.slug}` },
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function PublicHelpArticlePage({
  params,
}: {
  params: Params;
}) {
  const article = await fetchHelpArticleBySlug(params.slug);
  if (!article) notFound();

  const supabase = createServerClient();
  const [{ data: category }, related] = await Promise.all([
    article.category_id
      ? supabase
          .from("help_categories")
          .select("id, name, slug, icon")
          .eq("id", article.category_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    fetchRelatedArticles(article.id, article.category_id, 4),
  ]);

  const CategoryIcon = resolveHelpIcon(
    (category as { icon?: string } | null)?.icon ?? null,
  );

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8 lg:py-12">
        <ArticleView articleId={article.id} />

        <Link
          href="/help"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-mute hover:text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" /> All help articles
        </Link>

        <article className="mt-4 grid gap-8 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-brand-mute">
              {category ? (
                <Link
                  href={`/help/category/${(category as { slug: string }).slug}`}
                  className="inline-flex items-center gap-1 rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 font-semibold text-brand-secondary hover:bg-brand-accent"
                >
                  <CategoryIcon className="h-3 w-3" />
                  {(category as { name: string }).name}
                </Link>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="h-3 w-3" /> {article.read_time_minutes}{" "}
                min read
              </span>
              {article.published_at ? (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />{" "}
                  {formatDate(article.published_at)}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Tag className="h-3 w-3" />{" "}
                {article.view_count.toLocaleString("en-ZA")} views
              </span>
            </div>

            <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-brand-ink sm:text-4xl">
              {article.title}
            </h1>
            {article.excerpt ? (
              <p className="mt-3 text-base leading-relaxed text-brand-mute">
                {article.excerpt}
              </p>
            ) : null}

            <div
              className="help-article prose prose-emerald mt-6 max-w-none rounded-card border border-brand-line bg-white p-6 text-[15px] leading-relaxed text-brand-ink [&_a]:text-brand-primary [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-4 [&_ul]:list-disc [&_ul]:pl-6"
              dangerouslySetInnerHTML={{
                __html: sanitizeHelpHtml(article.body_html),
              }}
            />

            <div className="mt-6">
              <ArticleFeedback
                articleId={article.id}
                initial={{
                  helpful: article.helpful_count,
                  not_helpful: article.not_helpful_count,
                }}
              />
            </div>
          </div>

          <aside className="space-y-5">
            {related.length > 0 ? (
              <section className="rounded-card border border-brand-line bg-white p-5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                  Related
                </div>
                <ul className="mt-3 space-y-3">
                  {related.map((r) => (
                    <li key={r.id}>
                      <Link href={`/help/${r.slug}`} className="group block">
                        <div className="text-sm font-medium leading-snug text-brand-ink group-hover:text-brand-primary">
                          {r.title}
                        </div>
                        <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-brand-mute">
                          <ClockIcon className="h-3 w-3" />{" "}
                          {r.read_time_minutes} min read
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="rounded-card border border-brand-line bg-brand-dark p-5 text-white">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-accent">
                Still stuck?
              </div>
              <p className="mt-2 text-sm text-white/80">
                Email a human at hello@viloplatform.com or open a chat from the
                help home.
              </p>
              <Link
                href="/help#contact"
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:text-white"
              >
                Open contact options <ArrowRight className="h-3 w-3" />
              </Link>
            </section>
          </aside>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
