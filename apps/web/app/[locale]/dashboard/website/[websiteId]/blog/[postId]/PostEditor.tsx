"use client";

import { ArrowLeft, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import {
  deleteBlogPostAction,
  saveBlogPostAction,
} from "@/app/[locale]/dashboard/website/actions";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { modal } from "@/components/ui/modal-host";
import { slugify } from "@/lib/help/slug";

import type { BlogPostEditorData } from "./loadBlogPost";
import {
  ImageField,
  SelectField,
  TextArea,
  TextField,
} from "../../pages/[pageId]/_components/fields";

type Post = BlogPostEditorData["post"];

export function PostEditor({
  websiteId,
  subdomain,
  categories,
  initialPost,
}: {
  websiteId: string;
  subdomain: string;
  categories: Array<{ id: string; name: string }>;
  initialPost: Post;
}) {
  const t = useTranslations("website");
  const router = useRouter();

  const [post, setPost] = useState<Post>(initialPost);
  const [savedSlug, setSavedSlug] = useState(initialPost.slug);
  const [saving, startSave] = useTransition();

  const initialJson = useMemo(() => JSON.stringify(initialPost), [initialPost]);
  const dirty = JSON.stringify(post) !== initialJson;

  function patch(next: Partial<Post>) {
    setPost((prev) => ({ ...prev, ...next }));
  }

  const slugPlaceholder = slugify(post.title) || "post";
  const previewHref = `/site/blog/${savedSlug}?site=${subdomain}&preview=1`;

  function onSave() {
    if (!post.title.trim()) {
      toast.error(t("blogTitleRequired"));
      return;
    }
    startSave(async () => {
      const res = await saveBlogPostAction({
        websiteId,
        postId: post.id,
        title: post.title,
        slug: post.slug,
        categoryId: post.categoryId,
        status: post.status === "published" ? "published" : "draft",
        coverPath: post.coverPath,
        excerpt: post.excerpt,
        bodyHtml: post.bodyHtml,
        authorName: post.authorName,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
      });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      setSavedSlug(slugify(post.slug || post.title) || savedSlug);
      toast.success(t("blogPostSaved"));
      router.refresh();
    });
  }

  async function onDelete() {
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
    router.push(`/dashboard/website/${websiteId}/blog`);
  }

  const seoTitle =
    post.seoTitle.trim() || post.title.trim() || t("blogUntitled");
  const seoDesc = post.seoDescription.trim() || post.excerpt.trim();

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/dashboard/website/${websiteId}/blog`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-mute hover:text-brand-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("blogBackToList")}
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={previewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light"
          >
            <ExternalLink className="h-4 w-4" />
            {t("previewCta")}
          </a>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("saveChanges")}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Main column — title + body */}
        <div className="space-y-4">
          <input
            value={post.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder={t("blogTitlePlaceholder")}
            maxLength={200}
            className="w-full rounded-[10px] border border-brand-line bg-white px-4 py-3 font-display text-xl font-bold text-brand-ink outline-none transition focus:border-brand-primary"
          />
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-brand-ink">
              {t("blogBody")}
            </span>
            <RichTextEditor
              value={post.bodyHtml}
              onChange={(html) => patch({ bodyHtml: html })}
              placeholder={t("blogBodyPlaceholder")}
            />
          </div>
        </div>

        {/* Sidebar — publication settings */}
        <aside className="space-y-5">
          <section className="space-y-3 rounded-card border border-brand-line bg-white p-5 shadow-card">
            <h3 className="font-display text-base font-bold text-brand-ink">
              {t("blogPublishSettings")}
            </h3>
            <SelectField
              label={t("blogStatus")}
              value={post.status === "published" ? "published" : "draft"}
              onChange={(v) => patch({ status: v })}
              options={[
                { value: "draft", label: t("blogStatusDraft") },
                { value: "published", label: t("blogStatusPublished") },
              ]}
            />
            <SelectField
              label={t("blogCategory")}
              value={post.categoryId}
              onChange={(v) => patch({ categoryId: v })}
              options={[
                { value: "", label: t("blogNoCategory") },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <TextField
              label={t("blogSlug")}
              value={post.slug}
              onChange={(v) => patch({ slug: v })}
              placeholder={slugPlaceholder}
              maxLength={80}
              hint={t("blogSlugHint")}
            />
            <TextField
              label={t("blogAuthor")}
              value={post.authorName}
              onChange={(v) => patch({ authorName: v })}
              maxLength={120}
            />
          </section>

          <section className="space-y-3 rounded-card border border-brand-line bg-white p-5 shadow-card">
            <h3 className="font-display text-base font-bold text-brand-ink">
              {t("blogCover")}
            </h3>
            <ImageField
              label=""
              websiteId={websiteId}
              path={post.coverPath || undefined}
              onChange={(p) => patch({ coverPath: p ?? "" })}
              hint={t("blogCoverHint")}
            />
            <TextArea
              label={t("blogExcerpt")}
              value={post.excerpt}
              onChange={(v) => patch({ excerpt: v })}
              maxLength={300}
              rows={3}
              hint={t("blogExcerptHint")}
            />
          </section>

          <section className="space-y-3 rounded-card border border-brand-line bg-white p-5 shadow-card">
            <h3 className="font-display text-base font-bold text-brand-ink">
              {t("blogSeoTitle")}
            </h3>
            {/* SERP preview */}
            <div className="rounded-[10px] border border-brand-line bg-brand-light/30 p-3">
              <div className="truncate text-[13px] text-brand-mute">
                {subdomain}/blog/{savedSlug}
              </div>
              <div className="truncate text-[15px] font-medium text-brand-secondary">
                {seoTitle}
              </div>
              <div className="line-clamp-2 text-[12.5px] text-brand-mute">
                {seoDesc || t("blogSeoDescPlaceholder")}
              </div>
            </div>
            <TextField
              label={t("blogSeoMetaTitle")}
              value={post.seoTitle}
              onChange={(v) => patch({ seoTitle: v })}
              placeholder={post.title}
              maxLength={70}
            />
            <TextArea
              label={t("blogSeoMetaDesc")}
              value={post.seoDescription}
              onChange={(v) => patch({ seoDescription: v })}
              maxLength={200}
              rows={2}
            />
          </section>

          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("blogDeletePost")}
          </button>
        </aside>
      </div>
    </div>
  );
}
