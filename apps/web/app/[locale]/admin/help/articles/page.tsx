import {
  ArrowRight,
  BookOpen,
  Eye,
  RotateCcw,
  Search,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

import { requirePermission } from "@/lib/admin";
import { sanitizeSearch } from "@/lib/search/sanitizeSearch";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const STATUS_VALUES = [
  "all",
  "draft",
  "published",
  "archived",
  "trash",
] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];

type SearchParams = {
  q?: string;
  status?: string;
  category?: string;
  sort?: string;
};

function isStatus(v: string | undefined): v is StatusFilter {
  return STATUS_VALUES.includes((v ?? "") as StatusFilter);
}

const PAGE_SIZE = 50;

export default async function AdminHelpArticlesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requirePermission("help.manage");
  const service = createAdminClient();

  const q = (searchParams?.q ?? "").trim();
  const status: StatusFilter = isStatus(searchParams?.status)
    ? (searchParams!.status as StatusFilter)
    : "all";
  const sort = searchParams?.sort === "worst" ? "worst" : "recent";
  const categoryFilter = searchParams?.category ?? "";

  const { data: categories } = await service
    .from("help_categories")
    .select("id, name, slug")
    .is("deleted_at", null)
    .order("sort_order");

  let query = service
    .from("help_articles")
    .select(
      "id, slug, title, excerpt, status, audience, view_count, helpful_count, not_helpful_count, featured_rank, category_id, updated_at, deleted_at",
      { count: "exact" },
    )
    .limit(PAGE_SIZE);

  if (status === "trash") {
    query = query.not("deleted_at", "is", null);
  } else {
    query = query.is("deleted_at", null);
    if (status !== "all") query = query.eq("status", status);
  }

  const qSafe = sanitizeSearch(q);
  if (qSafe) query = query.or(`title.ilike.%${qSafe}%,slug.ilike.%${qSafe}%`);
  if (categoryFilter) query = query.eq("category_id", categoryFilter);

  if (sort === "worst") {
    query = query
      .order("not_helpful_count", { ascending: false })
      .order("updated_at", { ascending: false });
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  const { data: rows, count } = await query;

  const categoryMap = new Map(
    ((categories ?? []) as { id: string; name: string }[]).map((c) => [
      c.id,
      c.name,
    ]),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Help articles
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            Everything that surfaces under /help/[slug] and
            /dashboard/help/[slug].
          </p>
        </div>
        <Link
          href="/admin/help/articles/new"
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
        >
          <BookOpen className="h-4 w-4" /> New article
        </Link>
      </header>

      <form
        action="/admin/help/articles"
        method="get"
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative min-w-[18rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by title or slug"
            className="block w-full rounded border border-brand-line bg-white py-2 pl-9 pr-3 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>
        <select
          name="status"
          defaultValue={status}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm capitalize text-brand-ink"
        >
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
        <select
          name="category"
          defaultValue={categoryFilter}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink"
        >
          <option value="">All categories</option>
          {(categories ?? []).map((c) => {
            const r = c as { id: string; name: string };
            return (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            );
          })}
        </select>
        <select
          name="sort"
          defaultValue={sort}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink"
        >
          <option value="recent">Most recent</option>
          <option value="worst">Most negative feedback</option>
        </select>
        <button
          type="submit"
          className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
        >
          Apply
        </button>
        {q || status !== "all" || categoryFilter || sort !== "recent" ? (
          <Link
            href="/admin/help/articles"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </Link>
        ) : null}
        <span className="ml-auto text-[12px] text-brand-mute">
          <span className="num font-semibold text-brand-ink">{count ?? 0}</span>{" "}
          matching
        </span>
      </form>

      <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        {rows && rows.length > 0 ? (
          <ul className="divide-y divide-brand-line">
            {rows.map((row) => {
              const a = row as {
                id: string;
                slug: string;
                title: string;
                status: string;
                audience: string;
                view_count: number;
                helpful_count: number;
                not_helpful_count: number;
                featured_rank: number | null;
                category_id: string | null;
                updated_at: string;
                deleted_at: string | null;
              };
              return (
                <li key={a.id}>
                  <Link
                    href={`/admin/help/articles/${a.id}`}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-brand-light/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-brand-ink">
                          {a.title}
                        </span>
                        <StatusPill
                          status={a.deleted_at ? "trash" : a.status}
                        />
                        <AudiencePill audience={a.audience} />
                        {a.featured_rank ? (
                          <span className="inline-flex items-center rounded-pill bg-brand-accent px-2 py-0.5 text-[10px] font-bold text-brand-secondary">
                            #{a.featured_rank}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-brand-mute">
                        <span>/help/{a.slug}</span>
                        {a.category_id && categoryMap.get(a.category_id) ? (
                          <span>· {categoryMap.get(a.category_id)}</span>
                        ) : null}
                        <span>
                          · Updated{" "}
                          {new Date(a.updated_at).toLocaleDateString("en-ZA")}
                        </span>
                      </div>
                    </div>
                    <div className="hidden items-center gap-4 sm:flex">
                      <Stat icon={Eye} label="views" value={a.view_count} />
                      <Stat
                        icon={ThumbsUp}
                        label="up"
                        value={a.helpful_count}
                        tone={a.helpful_count > 0 ? "positive" : undefined}
                      />
                      <Stat
                        icon={ThumbsDown}
                        label="down"
                        value={a.not_helpful_count}
                        tone={a.not_helpful_count > 0 ? "negative" : undefined}
                      />
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-brand-mute" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-brand-mute">
            No articles match this filter.
          </p>
        )}
      </div>

      {count != null && count > PAGE_SIZE ? (
        <p className="text-center text-[12px] text-brand-mute">
          Showing first {PAGE_SIZE} of {count}. Narrow your search to see more.
        </p>
      ) : null}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
  tone?: "positive" | "negative";
}) {
  return (
    <div
      title={label}
      className={`inline-flex items-center gap-1 font-mono text-[12px] ${tone === "negative" ? "text-red-700" : tone === "positive" ? "text-emerald-700" : "text-brand-mute"}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {value}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    published: "bg-emerald-100 text-emerald-800",
    draft: "bg-amber-100 text-amber-800",
    archived: "bg-brand-light text-brand-mute",
    trash: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-semibold capitalize ${cls[status] ?? cls.draft}`}
    >
      {status}
    </span>
  );
}

function AudiencePill({ audience }: { audience: string }) {
  return (
    <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-semibold capitalize text-brand-mute">
      {audience}
    </span>
  );
}
