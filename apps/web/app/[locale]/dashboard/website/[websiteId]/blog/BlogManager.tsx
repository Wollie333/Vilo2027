"use client";

import {
  ChevronRight,
  Loader2,
  Newspaper,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import {
  createBlogPostAction,
  deleteBlogPostAction,
  saveBlogCategoriesAction,
} from "@/app/[locale]/dashboard/website/actions";
import { modal } from "@/components/ui/modal-host";

import type { BlogCategoryRow, BlogPostRow } from "./loadBlogEditor";
import {
  ItemListEditor,
  TextField,
} from "../pages/[pageId]/_components/fields";

export function BlogManager({
  websiteId,
  initialPosts,
  initialCategories,
}: {
  websiteId: string;
  initialPosts: BlogPostRow[];
  initialCategories: BlogCategoryRow[];
}) {
  const t = useTranslations("website");
  const router = useRouter();

  const [categories, setCategories] =
    useState<BlogCategoryRow[]>(initialCategories);
  const [creating, startCreate] = useTransition();
  const [savingCats, startSaveCats] = useTransition();

  const initialCatsJson = useMemo(
    () => JSON.stringify(initialCategories),
    [initialCategories],
  );
  const catsDirty = JSON.stringify(categories) !== initialCatsJson;

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
    toast.success(t("blogPostDeleted"));
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* Posts */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[13px] text-brand-mute">
            {t("blogPostCount", { count: initialPosts.length })}
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

        {initialPosts.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-brand-light/30 p-8 text-center">
            <Newspaper className="mx-auto h-6 w-6 text-brand-mute/50" />
            <p className="mt-2 text-sm text-brand-mute">{t("blogEmpty")}</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {initialPosts.map((post) => (
              <li
                key={post.id}
                className="flex items-center gap-3 rounded-card border border-brand-line bg-white p-4 transition hover:border-brand-mute hover:shadow-card"
              >
                <Link
                  href={`/dashboard/website/${websiteId}/blog/${post.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-light text-brand-secondary">
                    <Newspaper className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-brand-ink">
                        {post.title}
                      </span>
                      <StatusPill status={post.status} t={t} />
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] text-brand-mute">
                      {post.categoryName
                        ? `${post.categoryName} · /blog/${post.slug}`
                        : `/blog/${post.slug}`}
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => onDelete(post)}
                  aria-label={t("blogDeletePost")}
                  className="rounded p-1.5 text-brand-mute transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <Link
                  href={`/dashboard/website/${websiteId}/blog/${post.id}`}
                  className="text-brand-mute"
                  aria-hidden
                  tabIndex={-1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
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

        <ItemListEditor<BlogCategoryRow>
          label=""
          items={categories}
          onChange={setCategories}
          blank={() => ({ id: "", name: "" })}
          addLabel={t("blogAddCategory")}
          max={30}
          renderItem={(item, patch) => (
            <TextField
              label={t("blogCategoryName")}
              value={item.name}
              onChange={(v) => patch({ name: v })}
              maxLength={60}
            />
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
  const published = status === "published";
  return (
    <span
      className={`shrink-0 rounded-pill px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
        published
          ? "bg-brand-accent text-brand-secondary"
          : "bg-brand-light text-brand-mute"
      }`}
    >
      {published ? t("publishedBadge") : t("draftBadge")}
    </span>
  );
}
