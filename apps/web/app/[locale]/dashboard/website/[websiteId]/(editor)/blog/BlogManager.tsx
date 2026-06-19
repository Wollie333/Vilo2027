"use client";

import {
  ChevronRight,
  Loader2,
  Newspaper,
  Plus,
  Search,
  Star,
  Tag,
  Trash2,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import {
  createBlogPostAction,
  deleteBlogPostAction,
  saveBlogAuthorsAction,
  saveBlogCategoriesAction,
  setBlogFeaturedAction,
} from "@/app/[locale]/dashboard/website/actions";
import { modal } from "@/components/ui/modal-host";

import type {
  BlogAuthorRow,
  BlogCategoryStat,
  BlogPostRow,
} from "./loadBlogEditor";
import {
  ImageField,
  ItemListEditor,
  TextArea,
  TextField,
} from "../pages/[pageId]/_components/fields";

type Filter = "all" | "published" | "draft" | "scheduled";

export function BlogManager({
  websiteId,
  initialPosts,
  initialCategories,
  initialAuthors,
}: {
  websiteId: string;
  initialPosts: BlogPostRow[];
  initialCategories: BlogCategoryStat[];
  initialAuthors: BlogAuthorRow[];
}) {
  const t = useTranslations("website");
  const router = useRouter();

  const [posts, setPosts] = useState<BlogPostRow[]>(initialPosts);
  const [categories, setCategories] =
    useState<BlogCategoryStat[]>(initialCategories);
  const [authors, setAuthors] = useState<BlogAuthorRow[]>(initialAuthors);
  const [savingAuthors, startSaveAuthors] = useTransition();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, startCreate] = useTransition();
  const [savingCats, startSaveCats] = useTransition();

  const initialCatsJson = useMemo(
    () =>
      JSON.stringify(
        initialCategories.map((c) => ({ id: c.id, name: c.name })),
      ),
    [initialCategories],
  );
  const catsDirty =
    JSON.stringify(categories.map((c) => ({ id: c.id, name: c.name }))) !==
    initialCatsJson;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (filter !== "all" && p.status !== filter) return false;
      if (q && !p.title.toLowerCase().includes(q) && !p.slug.includes(q))
        return false;
      return true;
    });
  }, [posts, query, filter]);

  function onNewPost() {
    startCreate(async () => {
      const res = await createBlogPostAction(websiteId);
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      router.push(`/dashboard/website/${websiteId}/blog/${res.id}`);
    });
  }

  async function onToggleFeatured(post: BlogPostRow) {
    const next = !post.featured;
    setPosts((ps) =>
      ps.map((p) => (p.id === post.id ? { ...p, featured: next } : p)),
    );
    const res = await setBlogFeaturedAction(websiteId, post.id, next);
    if (!res.ok) {
      // revert on failure
      setPosts((ps) =>
        ps.map((p) => (p.id === post.id ? { ...p, featured: !next } : p)),
      );
      toast.error(t("saveError"));
    }
  }

  function onSaveCategories() {
    startSaveCats(async () => {
      const res = await saveBlogCategoriesAction({
        websiteId,
        categories: categories.map((c) => ({
          id: c.id || undefined,
          name: c.name,
        })),
      });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("blogCategoriesSaved"));
      router.refresh();
    });
  }

  const authorsDirty =
    JSON.stringify(authors) !== JSON.stringify(initialAuthors);

  function onSaveAuthors() {
    if (authors.some((a) => !a.name.trim())) {
      toast.error(t("blogAuthorNameRequired"));
      return;
    }
    startSaveAuthors(async () => {
      const res = await saveBlogAuthorsAction({
        websiteId,
        authors: authors.map((a) => ({
          id: a.id || undefined,
          name: a.name,
          avatarPath: a.avatarPath,
          bio: a.bio,
        })),
      });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("blogAuthorsSaved"));
      router.refresh();
    });
  }

  async function onDelete(post: BlogPostRow) {
    const ok = await modal.destructive({
      title: t("blogDeleteTitle"),
      description: t("blogDeleteBody", { title: post.title }),
      confirmLabel: t("blogDeleteConfirm"),
    });
    if (!ok) return;
    const res = await deleteBlogPostAction(websiteId, post.id);
    if (!res.ok) {
      toast.error(t("saveError"));
      return;
    }
    setPosts((ps) => ps.filter((p) => p.id !== post.id));
    toast.success(t("blogPostDeleted"));
    router.refresh();
  }

  const FILTERS: Filter[] = ["all", "published", "scheduled", "draft"];

  return (
    <div className="space-y-8">
      {/* Posts */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-brand-mute">
            {t("blogPostCount", { count: posts.length })}
          </p>
          <button
            type="button"
            onClick={onNewPost}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {t("blogNewPost")}
          </button>
        </div>

        {posts.length > 0 ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-[10px] border border-brand-line bg-white px-3 py-2">
              <Search className="h-4 w-4 text-brand-mute" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("blogSearch")}
                className="min-w-0 flex-1 bg-transparent text-sm text-brand-ink outline-none placeholder:text-brand-mute"
              />
            </div>
            <div className="inline-flex rounded-[10px] border border-brand-line bg-white p-0.5">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-[8px] px-2.5 py-1.5 text-[12.5px] font-semibold capitalize transition ${
                    filter === f
                      ? "bg-brand-primary text-white"
                      : "text-brand-mute hover:text-brand-ink"
                  }`}
                >
                  {t(`blogFilter_${f}`)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {posts.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-brand-light/30 p-8 text-center">
            <Newspaper className="mx-auto h-6 w-6 text-brand-mute/50" />
            <p className="mt-2 text-sm text-brand-mute">{t("blogEmpty")}</p>
          </div>
        ) : shown.length === 0 ? (
          <p className="rounded-card border border-dashed border-brand-line bg-brand-light/30 px-4 py-6 text-center text-sm text-brand-mute">
            {t("blogNoMatches")}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {shown.map((post) => (
              <li
                key={post.id}
                className="flex items-center gap-3 rounded-card border border-brand-line bg-white p-4 transition hover:border-brand-mute hover:shadow-card"
              >
                <button
                  type="button"
                  onClick={() => onToggleFeatured(post)}
                  title={post.featured ? t("blogUnfeature") : t("blogFeature")}
                  className={`shrink-0 rounded p-1 transition ${
                    post.featured
                      ? "text-amber-500"
                      : "text-brand-mute/50 hover:text-brand-mute"
                  }`}
                >
                  <Star
                    className="h-4 w-4"
                    fill={post.featured ? "currentColor" : "none"}
                  />
                </button>
                <Link
                  href={`/dashboard/website/${websiteId}/blog/${post.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-brand-ink">
                        {post.title}
                      </span>
                      <StatusPill status={post.status} t={t} />
                      {!post.hasSeo ? (
                        <span className="rounded-pill bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                          {t("blogNoSeo")}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] text-brand-mute">
                      {post.categoryName
                        ? `${post.categoryName} · /blog/${post.slug}`
                        : `/blog/${post.slug}`}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-brand-mute" />
                </Link>
                <button
                  type="button"
                  onClick={() => onDelete(post)}
                  aria-label={t("blogDeletePost")}
                  className="rounded p-1.5 text-brand-mute transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Categories */}
      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="mb-1 flex items-center gap-2">
          <Tag className="h-4 w-4 text-brand-secondary" />
          <h3 className="font-display text-base font-bold text-brand-ink">
            {t("blogCategoriesTitle")}
          </h3>
        </div>
        <p className="mb-4 text-[13px] text-brand-mute">
          {t("blogCategoriesSub")}
        </p>

        <ItemListEditor<BlogCategoryStat>
          label=""
          items={categories}
          onChange={setCategories}
          blank={() => ({ id: "", name: "", slug: "", count: 0 })}
          addLabel={t("blogAddCategory")}
          max={30}
          renderItem={(item, patch) => (
            <>
              <TextField
                label={t("blogCategoryName")}
                value={item.name}
                onChange={(v) => patch({ name: v })}
                maxLength={60}
              />
              {item.slug ? (
                <p className="text-[11.5px] text-brand-mute">
                  /{item.slug} · {t("blogCategoryCount", { count: item.count })}
                </p>
              ) : null}
            </>
          )}
        />

        <div className="mt-4 flex items-center justify-end gap-3">
          {catsDirty ? (
            <span className="text-[12.5px] text-brand-mute">
              {t("roomsUnsaved")}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onSaveCategories}
            disabled={savingCats || !catsDirty}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {savingCats ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("saveChanges")}
          </button>
        </div>
      </section>

      {/* Authors */}
      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="mb-1 flex items-center gap-2">
          <UserRound className="h-4 w-4 text-brand-secondary" />
          <h3 className="font-display text-base font-bold text-brand-ink">
            {t("blogAuthorsTitle")}
          </h3>
        </div>
        <p className="mb-4 text-[13px] text-brand-mute">
          {t("blogAuthorsSub")}
        </p>

        <ItemListEditor<BlogAuthorRow>
          label=""
          items={authors}
          onChange={setAuthors}
          blank={() => ({ id: "", name: "", avatarPath: "", bio: "" })}
          addLabel={t("blogAddAuthor")}
          max={50}
          renderItem={(item, patch) => (
            <>
              <TextField
                label={t("blogAuthorName")}
                value={item.name}
                onChange={(v) => patch({ name: v })}
                maxLength={120}
              />
              <ImageField
                label={t("blogAuthorAvatar")}
                websiteId={websiteId}
                path={item.avatarPath || undefined}
                onChange={(p) => patch({ avatarPath: p ?? "" })}
              />
              <TextArea
                label={t("blogAuthorBio")}
                value={item.bio}
                onChange={(v) => patch({ bio: v })}
                maxLength={600}
                rows={2}
              />
            </>
          )}
        />

        <div className="mt-4 flex items-center justify-end gap-3">
          {authorsDirty ? (
            <span className="text-[12.5px] text-brand-mute">
              {t("roomsUnsaved")}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onSaveAuthors}
            disabled={savingAuthors || !authorsDirty}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {savingAuthors ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {t("saveChanges")}
          </button>
        </div>
      </section>
    </div>
  );
}

function StatusPill({
  status,
  t,
}: {
  status: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const tone =
    status === "published"
      ? "bg-brand-accent text-brand-secondary"
      : status === "scheduled"
        ? "bg-sky-50 text-sky-700"
        : "bg-brand-light text-brand-mute";
  const label =
    status === "published"
      ? t("publishedBadge")
      : status === "scheduled"
        ? t("blogStatusScheduledBadge")
        : t("draftBadge");
  return (
    <span
      className={`shrink-0 rounded-pill px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {label}
    </span>
  );
}
