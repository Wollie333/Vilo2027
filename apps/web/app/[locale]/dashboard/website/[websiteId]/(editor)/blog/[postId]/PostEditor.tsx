"use client";

import { ArrowLeft, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import {
  createWebsiteAssetUploadUrl,
  deleteBlogPostAction,
  saveBlogPostAction,
  type MediaItem,
} from "@/app/[locale]/dashboard/website/actions";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { MediaLibrary } from "@/components/website/MediaLibrary";
import { modal } from "@/components/ui/modal-host";
import { slugify } from "@/lib/help/slug";
import { createClient } from "@/lib/supabase/client";
import { websiteAssetUrl } from "@/lib/website/assets";

import type { BlogPostEditorData } from "./loadBlogPost";
import {
  ImageField,
  SelectField,
  TextArea,
  TextField,
  ToggleField,
} from "../../pages/[pageId]/_components/fields";
import { SeoAnalysis } from "../../pages/[pageId]/_components/SeoAnalysis";

type Post = BlogPostEditorData["post"];

/** ISO → the value shape a <input type="datetime-local"> expects (local time). */
function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function readingMinutes(html: string): number {
  const words = html
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function PostEditor({
  websiteId,
  subdomain,
  categories,
  authors,
  initialPost,
}: {
  websiteId: string;
  subdomain: string;
  categories: Array<{ id: string; name: string }>;
  authors: BlogPostEditorData["authors"];
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

  // Media-library image insert for the body editor. Opens the picker and resolves
  // the chosen image (url + its stored alt) back to the editor; null on cancel.
  const [mediaOpen, setMediaOpen] = useState(false);
  const mediaResolver = useRef<
    ((img: { url: string; alt?: string } | null) => void) | null
  >(null);

  function pickFromLibrary() {
    return new Promise<{ url: string; alt?: string } | null>((resolve) => {
      mediaResolver.current = resolve;
      setMediaOpen(true);
    });
  }
  function handleMediaOpenChange(open: boolean) {
    setMediaOpen(open);
    if (!open && mediaResolver.current) {
      mediaResolver.current(null); // closed without choosing
      mediaResolver.current = null;
    }
  }
  function handleSelectItem(item: MediaItem) {
    mediaResolver.current?.({ url: item.url, alt: item.alt ?? undefined });
    mediaResolver.current = null;
  }

  // Upload a body image browser→Storage and return its public URL (for the editor).
  async function uploadBodyImage(file: File): Promise<string | null> {
    if (file.size > 6 * 1024 * 1024) {
      toast.error(t("imageSizeError"));
      return null;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const ticket = await createWebsiteAssetUploadUrl(websiteId, ext);
    if (!ticket.ok) {
      toast.error(t("imageUploadError"));
      return null;
    }
    const supabase = createClient();
    const { error } = await supabase.storage
      .from("website-assets")
      .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
        contentType: file.type || "image/jpeg",
      });
    if (error) {
      toast.error(t("imageUploadError"));
      return null;
    }
    return websiteAssetUrl(ticket.data.path) ?? null;
  }

  function onSave() {
    if (!post.title.trim()) {
      toast.error(t("blogTitleRequired"));
      return;
    }
    startSave(async () => {
      const status =
        post.status === "published"
          ? "published"
          : post.status === "scheduled"
            ? "scheduled"
            : "draft";
      const res = await saveBlogPostAction({
        websiteId,
        postId: post.id,
        title: post.title,
        slug: post.slug,
        categoryId: post.categoryId,
        status,
        featured: post.featured,
        publishAt: post.publishAt,
        coverPath: post.coverPath,
        excerpt: post.excerpt,
        bodyHtml: post.bodyHtml,
        authorId: post.authorId,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        seoFocusKeyword: post.seoFocusKeyword,
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
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-brand-ink">
                {t("blogBody")}
              </span>
              <span className="text-[12px] text-brand-mute">
                {t("blogReadingTime", {
                  minutes: readingMinutes(post.bodyHtml),
                })}
              </span>
            </div>
            <RichTextEditor
              value={post.bodyHtml}
              onChange={(html) => patch({ bodyHtml: html })}
              placeholder={t("blogBodyPlaceholder")}
              onImageUpload={uploadBodyImage}
              onPickFromLibrary={pickFromLibrary}
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
              value={post.status}
              onChange={(v) => patch({ status: v })}
              options={[
                { value: "draft", label: t("blogStatusDraft") },
                { value: "published", label: t("blogStatusPublished") },
                { value: "scheduled", label: t("blogStatusScheduled") },
              ]}
            />
            {post.status === "scheduled" ? (
              <label className="block">
                <span className="block text-[13px] font-semibold text-brand-ink">
                  {t("blogScheduleFor")}
                </span>
                <input
                  type="datetime-local"
                  value={isoToLocalInput(post.publishAt)}
                  onChange={(e) =>
                    patch({
                      publishAt: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : "",
                    })
                  }
                  className="mt-1.5 w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary"
                />
                <span className="mt-1 block text-[12px] text-brand-mute">
                  {t("blogScheduleHint")}
                </span>
              </label>
            ) : null}
            <ToggleField
              label={t("blogFeature")}
              checked={post.featured}
              onChange={(v) => patch({ featured: v })}
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
            <SelectField
              label={t("blogAuthor")}
              value={post.authorId}
              onChange={(v) => patch({ authorId: v })}
              options={[
                { value: "", label: t("blogNoAuthor") },
                ...authors.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
            {authors.length === 0 ? (
              <p className="text-[12px] text-brand-mute">
                {t("blogNoAuthorsHint")}
              </p>
            ) : null}
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
            <SeoAnalysis
              title={post.seoTitle.trim() || post.title}
              description={post.seoDescription.trim() || post.excerpt}
              focusKeyword={post.seoFocusKeyword}
              onFocusKeyword={(v) => patch({ seoFocusKeyword: v })}
              bodyText={post.bodyHtml.replace(/<[^>]+>/g, " ")}
              slug={post.slug || slugPlaceholder}
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

      <MediaLibrary
        open={mediaOpen}
        onOpenChange={handleMediaOpenChange}
        websiteId={websiteId}
        onSelectItem={handleSelectItem}
      />
    </div>
  );
}
