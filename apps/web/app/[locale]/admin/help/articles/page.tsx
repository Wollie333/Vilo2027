import { BookOpen, RotateCcw, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";

import { requirePermission } from "@/lib/admin";
import { sanitizeSearch } from "@/lib/search/sanitizeSearch";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  ArticlesTable,
  type AdminArticleRow,
} from "../_components/ArticlesTable";

export const dynamic = "force-dynamic";

const STATUS_VALUES = [
  "all",
  "draft",
  "published",
  "archived",
  "trash",
] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];

const AUDIENCE_VALUES = ["all", "host", "guest", "both"] as const;
type AudienceFilter = (typeof AUDIENCE_VALUES)[number];

const SORT_VALUES = [
  "recent",
  "published",
  "views",
  "helpful",
  "worst",
  "title",
] as const;
type SortOption = (typeof SORT_VALUES)[number];

const SORT_LABEL: Record<SortOption, string> = {
  recent: "Recently updated",
  published: "Recently published",
  views: "Most viewed",
  helpful: "Most helpful",
  worst: "Most negative feedback",
  title: "Title A–Z",
};

type SearchParams = {
  q?: string;
  status?: string;
  category?: string;
  audience?: string;
  sort?: string;
  page?: string;
};

function pick<T extends readonly string[]>(
  v: string | undefined,
  allowed: T,
  fallback: T[number],
): T[number] {
  return (allowed as readonly string[]).includes(v ?? "")
    ? (v as T[number])
    : fallback;
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
  const status = pick(
    searchParams?.status,
    STATUS_VALUES,
    "all",
  ) as StatusFilter;
  const audience = pick(
    searchParams?.audience,
    AUDIENCE_VALUES,
    "all",
  ) as AudienceFilter;
  const sort = pick(searchParams?.sort, SORT_VALUES, "recent") as SortOption;
  const categoryFilter = searchParams?.category ?? "";
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);

  const { data: categories } = await service
    .from("help_categories")
    .select("id, name, slug")
    .is("deleted_at", null)
    .order("sort_order");

  let query = service
    .from("help_articles")
    .select(
      "id, slug, title, status, audience, view_count, helpful_count, not_helpful_count, saved_count, featured_rank, category_id, updated_at, deleted_at",
      { count: "exact" },
    );

  if (status === "trash") {
    query = query.not("deleted_at", "is", null);
  } else {
    query = query.is("deleted_at", null);
    if (status !== "all") query = query.eq("status", status);
  }
  if (audience !== "all") query = query.eq("audience", audience);

  const qSafe = sanitizeSearch(q);
  if (qSafe) query = query.or(`title.ilike.%${qSafe}%,slug.ilike.%${qSafe}%`);
  if (categoryFilter) query = query.eq("category_id", categoryFilter);

  if (sort === "worst") {
    query = query
      .order("not_helpful_count", { ascending: false })
      .order("updated_at", { ascending: false });
  } else if (sort === "views") {
    query = query.order("view_count", { ascending: false });
  } else if (sort === "helpful") {
    query = query.order("helpful_count", { ascending: false });
  } else if (sort === "published") {
    query = query.order("published_at", {
      ascending: false,
      nullsFirst: false,
    });
  } else if (sort === "title") {
    query = query.order("title", { ascending: true });
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const { data: rows, count } = await query;

  const categoryMap = Object.fromEntries(
    ((categories ?? []) as { id: string; name: string }[]).map((c) => [
      c.id,
      c.name,
    ]),
  );

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters =
    Boolean(q) ||
    status !== "all" ||
    audience !== "all" ||
    Boolean(categoryFilter) ||
    sort !== "recent";

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status !== "all") sp.set("status", status);
    if (audience !== "all") sp.set("audience", audience);
    if (categoryFilter) sp.set("category", categoryFilter);
    if (sort !== "recent") sp.set("sort", sort);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/admin/help/articles${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-brand-ink">
            Help articles
          </h2>
          <p className="mt-1 text-[13px] text-brand-mute">
            Everything under /help/[slug] and /dashboard/help/[slug].
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
        <div className="relative min-w-[16rem] flex-1">
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
          name="audience"
          defaultValue={audience}
          className="rounded border border-brand-line bg-white px-3 py-2 text-sm capitalize text-brand-ink"
        >
          {AUDIENCE_VALUES.map((a) => (
            <option key={a} value={a}>
              {a === "all" ? "All audiences" : a}
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
          {SORT_VALUES.map((s) => (
            <option key={s} value={s}>
              {SORT_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
        >
          Apply
        </button>
        {hasFilters ? (
          <Link
            href="/admin/help/articles"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </Link>
        ) : null}
        <span className="ml-auto text-[12px] text-brand-mute">
          <span className="num font-semibold text-brand-ink">{total}</span>{" "}
          matching
        </span>
      </form>

      <ArticlesTable
        rows={(rows ?? []) as AdminArticleRow[]}
        categoryMap={categoryMap}
        categories={(categories ?? []) as { id: string; name: string }[]}
        isTrash={status === "trash"}
      />

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="rounded border border-brand-line bg-white px-3 py-1.5 font-medium text-brand-ink hover:bg-brand-light"
            >
              ← Prev
            </Link>
          ) : (
            <span className="rounded border border-brand-line px-3 py-1.5 text-brand-mute opacity-50">
              ← Prev
            </span>
          )}
          <span className="text-[12px] text-brand-mute">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="rounded border border-brand-line bg-white px-3 py-1.5 font-medium text-brand-ink hover:bg-brand-light"
            >
              Next →
            </Link>
          ) : (
            <span className="rounded border border-brand-line px-3 py-1.5 text-brand-mute opacity-50">
              Next →
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
