import {
  ArrowRight,
  BookOpen,
  FileText,
  LifeBuoy,
  MessageSquarePlus,
  ThumbsDown,
  Video,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminHelpOverviewPage() {
  await requirePermission("help.manage");
  const service = createAdminClient();

  const [
    { count: publishedArticles },
    { count: draftArticles },
    { count: archivedArticles },
    { count: publishedVideos },
    { count: faqCount },
    { count: openSuggestions },
    { count: categoryCount },
    { data: recent },
    { data: lowSignal },
  ] = await Promise.all([
    service
      .from("help_articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .is("deleted_at", null),
    service
      .from("help_articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft")
      .is("deleted_at", null),
    service
      .from("help_articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "archived")
      .is("deleted_at", null),
    service
      .from("help_videos")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .is("deleted_at", null),
    service
      .from("help_faqs")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true)
      .is("deleted_at", null),
    service
      .from("help_article_suggestions")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    service
      .from("help_categories")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true)
      .is("deleted_at", null),
    service
      .from("help_articles")
      .select("id, slug, title, status, updated_at")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(8),
    service
      .from("help_articles")
      .select("id, slug, title, helpful_count, not_helpful_count, view_count")
      .eq("status", "published")
      .is("deleted_at", null)
      .gt("not_helpful_count", 0)
      .order("not_helpful_count", { ascending: false })
      .limit(5),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Help &amp; docs
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            Manage articles, video tutorials, FAQs and system status that show
            up on /help and /dashboard/help.
          </p>
        </div>
        <Link
          href="/admin/help/articles/new"
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
        >
          <BookOpen className="h-4 w-4" /> New article
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={BookOpen}
          label="Published articles"
          value={publishedArticles ?? 0}
          href="/admin/help/articles?status=published"
        />
        <StatCard
          icon={FileText}
          label="Drafts"
          value={draftArticles ?? 0}
          tone="warning"
          href="/admin/help/articles?status=draft"
        />
        <StatCard
          icon={Video}
          label="Videos"
          value={publishedVideos ?? 0}
          href="/admin/help/videos"
        />
        <StatCard
          icon={MessageSquarePlus}
          label="Open suggestions"
          value={openSuggestions ?? 0}
          tone={openSuggestions ? "warning" : undefined}
          href="/admin/help/suggestions"
        />
        <StatCard
          icon={LifeBuoy}
          label="FAQs"
          value={faqCount ?? 0}
          href="/admin/help/faqs"
        />
        <StatCard
          icon={FileText}
          label="Categories"
          value={categoryCount ?? 0}
          href="/admin/help/categories"
        />
        <StatCard
          icon={FileText}
          label="Archived"
          value={archivedArticles ?? 0}
          href="/admin/help/articles?status=archived"
        />
        <StatCard
          icon={ThumbsDown}
          label="Need attention"
          value={lowSignal?.length ?? 0}
          tone={(lowSignal?.length ?? 0) > 0 ? "warning" : undefined}
          href="/admin/help/articles?sort=worst"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-card border border-brand-line bg-white shadow-card">
          <header className="flex items-center justify-between border-b border-brand-line p-5">
            <div className="font-display text-base font-semibold text-brand-ink">
              Recently updated
            </div>
            <Link
              href="/admin/help/articles"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
            >
              All articles <ArrowRight className="h-3 w-3" />
            </Link>
          </header>
          {recent && recent.length > 0 ? (
            <ul className="divide-y divide-brand-line">
              {recent.map((a) => {
                const r = a as {
                  id: string;
                  slug: string;
                  title: string;
                  status: string;
                  updated_at: string;
                };
                return (
                  <li key={r.id}>
                    <Link
                      href={`/admin/help/articles/${r.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-brand-light/60"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-brand-ink">
                          {r.title}
                        </div>
                        <div className="font-mono text-[11px] text-brand-mute">
                          {r.slug}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-brand-mute">
                        <StatusPill status={r.status} />
                        <span>
                          {new Date(r.updated_at).toLocaleDateString("en-ZA")}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-brand-mute">
              No articles yet — create your first one.
            </p>
          )}
        </section>

        <section className="rounded-card border border-brand-line bg-white shadow-card">
          <header className="flex items-center justify-between border-b border-brand-line p-5">
            <div className="font-display text-base font-semibold text-brand-ink">
              Needs attention
            </div>
            <span className="text-[11px] text-brand-mute">
              Articles where guests voted &ldquo;not helpful&rdquo;
            </span>
          </header>
          {lowSignal && lowSignal.length > 0 ? (
            <ul className="divide-y divide-brand-line">
              {lowSignal.map((a) => {
                const r = a as {
                  id: string;
                  slug: string;
                  title: string;
                  helpful_count: number;
                  not_helpful_count: number;
                  view_count: number;
                };
                const total = r.helpful_count + r.not_helpful_count;
                const pct =
                  total > 0 ? Math.round((r.helpful_count / total) * 100) : 0;
                return (
                  <li key={r.id}>
                    <Link
                      href={`/admin/help/articles/${r.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-brand-light/60"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-brand-ink">
                          {r.title}
                        </div>
                        <div className="font-mono text-[11px] text-brand-mute">
                          {pct}% helpful · {total} votes · {r.view_count} views
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-brand-mute" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-brand-mute">
              No articles with negative feedback yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  href,
  tone,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
  href: string;
  tone?: "warning";
}) {
  return (
    <Link
      href={href}
      className="block rounded-card border border-brand-line bg-white p-4 transition-shadow hover:shadow-lift"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded ${tone === "warning" ? "bg-amber-100 text-amber-800" : "bg-brand-accent text-brand-secondary"}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            {label}
          </div>
          <div className="num mt-0.5 font-display text-xl font-bold text-brand-ink">
            {value.toLocaleString("en-ZA")}
          </div>
        </div>
      </div>
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    published: "bg-emerald-100 text-emerald-800",
    draft: "bg-amber-100 text-amber-800",
    archived: "bg-brand-light text-brand-mute",
  };
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-semibold capitalize ${cls[status] ?? cls.draft}`}
    >
      {status}
    </span>
  );
}
