"use client";

import {
  ArrowLeft,
  Check,
  Clock,
  Eye,
  ImagePlus,
  Loader2,
  Rocket,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import {
  createWebsiteMediaUploadUrl,
  deleteBlogPostAction,
  registerWebsiteMediaAction,
  saveBlogPostAction,
  type MediaItem,
} from "@/app/[locale]/dashboard/website/actions";
import { PAGE_PIXEL_EVENTS } from "@/app/[locale]/dashboard/website/schemas";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { MediaLibrary } from "@/components/website/MediaLibrary";
import { modal } from "@/components/ui/modal-host";
import { slugify } from "@/lib/help/slug";
import { createClient } from "@/lib/supabase/client";
import { websiteAssetUrl } from "@/lib/website/assets";

import type { BlogAuthorRow, BlogPostEditorData } from "./loadBlogPost";

type Post = BlogPostEditorData["post"];

function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function readImageDims(
  file: File,
): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !file.type.startsWith("image/")) {
      resolve({});
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({});
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

function wordCount(html: string): number {
  return html
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/** Borderless textarea that grows with its content (title + standfirst). */
function AutoGrow({
  value,
  onChange,
  className,
  placeholder,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  className: string;
  placeholder: string;
  maxLength?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={className}
    />
  );
}

export function PostEditor({
  websiteId,
  subdomain,
  categories,
  authors,
  allTags,
  initialPost,
}: {
  websiteId: string;
  subdomain: string;
  categories: Array<{ id: string; name: string }>;
  authors: BlogAuthorRow[];
  allTags: string[];
  initialPost: Post;
}) {
  const t = useTranslations("website");
  const router = useRouter();

  const [post, setPost] = useState<Post>(initialPost);
  const [savedSlug, setSavedSlug] = useState(initialPost.slug);
  const [saving, startSave] = useTransition();
  const [preview, setPreview] = useState(false);
  const [tagDraft, setTagDraft] = useState("");

  const initialJson = useMemo(() => JSON.stringify(initialPost), [initialPost]);
  const dirty = JSON.stringify(post) !== initialJson;

  function patch(next: Partial<Post>) {
    setPost((prev) => ({ ...prev, ...next }));
  }

  const slugPlaceholder = slugify(post.title) || "post";
  const coverUrl = websiteAssetUrl(post.coverPath);
  const category = categories.find((c) => c.id === post.categoryId);
  const author = authors.find((a) => a.id === post.authorId);
  const authorAvatar = websiteAssetUrl(author?.avatarPath || "");
  const authorInitials =
    (author?.name || "")
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "·";

  // ── Media (cover + body image) ─────────────────────────────
  const [mediaOpen, setMediaOpen] = useState(false);
  const mediaMode = useRef<"body" | "cover">("body");
  const mediaResolver = useRef<
    ((img: { url: string; alt?: string } | null) => void) | null
  >(null);

  function pickFromLibrary() {
    return new Promise<{ url: string; alt?: string } | null>((resolve) => {
      mediaMode.current = "body";
      mediaResolver.current = resolve;
      setMediaOpen(true);
    });
  }
  function pickCover() {
    mediaMode.current = "cover";
    setMediaOpen(true);
  }
  function handleMediaOpenChange(open: boolean) {
    setMediaOpen(open);
    if (!open && mediaResolver.current) {
      mediaResolver.current(null);
      mediaResolver.current = null;
    }
  }
  function handleSelectItem(item: MediaItem) {
    if (mediaMode.current === "cover") {
      patch({ coverPath: item.path });
      return;
    }
    mediaResolver.current?.({ url: item.url, alt: item.alt ?? undefined });
    mediaResolver.current = null;
  }

  async function uploadBodyImage(
    file: File,
  ): Promise<{ url: string; alt?: string } | null> {
    if (file.size > 6 * 1024 * 1024) {
      toast.error(t("imageSizeError"));
      return null;
    }
    const alt = window.prompt(t("imageAltPrompt"))?.trim() || "";
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const ticket = await createWebsiteMediaUploadUrl(websiteId, ext);
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
    const dims = await readImageDims(file);
    await registerWebsiteMediaAction(websiteId, ticket.data.path, {
      alt,
      ...dims,
      size: file.size,
      mime: file.type,
    });
    const url = websiteAssetUrl(ticket.data.path);
    if (!url) return null;
    return { url, alt: alt || undefined };
  }

  // ── Tags ───────────────────────────────────────────────────
  function addTag(name: string) {
    const tag = name.trim();
    setTagDraft("");
    if (!tag) return;
    if (post.tags.some((v) => v.toLowerCase() === tag.toLowerCase())) return;
    if (post.tags.length >= 20) return;
    patch({ tags: [...post.tags, tag] });
  }
  function removeTag(i: number) {
    patch({ tags: post.tags.filter((_, idx) => idx !== i) });
  }

  // ── Save / delete ──────────────────────────────────────────
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
        tags: post.tags,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        seoFocusKeyword: post.seoFocusKeyword,
        headCode: post.headCode,
        pixelEvent: post.pixelEvent as (typeof PAGE_PIXEL_EVENTS)[number],
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
      description: t("blogDeleteBody", {
        title: post.title || t("blogUntitled"),
      }),
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

  // ── Derived display ────────────────────────────────────────
  const pill =
    post.status === "published"
      ? { cls: "green", label: t("publishedBadge") }
      : post.status === "scheduled"
        ? { cls: "sky", label: t("blogStatusScheduledBadge") }
        : { cls: "amber", label: t("draftBadge") };
  const pubLabel =
    post.status === "published"
      ? t("blogUpdate")
      : post.status === "scheduled"
        ? t("blogSchedule")
        : t("blogPublish");
  const PubIcon =
    post.status === "published"
      ? Check
      : post.status === "scheduled"
        ? Clock
        : Rocket;
  const dateLabel =
    post.status === "published"
      ? fmtDate(post.publishAt) || t("publishedBadge")
      : post.status === "scheduled"
        ? t("blogDateScheduled", { date: fmtDate(post.publishAt) })
        : t("draftBadge");
  const seoTitle =
    post.seoTitle.trim() || post.title.trim() || t("blogUntitled");
  const seoDesc = post.seoDescription.trim() || post.excerpt.trim();

  const STATUSES: Array<{ key: Post["status"]; label: string }> = [
    { key: "draft", label: t("blogStatusDraft") },
    { key: "scheduled", label: t("blogStatusScheduled") },
    { key: "published", label: t("blogStatusPublished") },
  ];

  return (
    <div
      className={`vilo-builder${preview ? "previewing" : ""}`}
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* top bar */}
      <header className="etop">
        <Link
          href={`/dashboard/website/${websiteId}/blog`}
          className="eback editor-only"
        >
          <ArrowLeft style={{ width: 16, height: 16 }} />
          {t("tabBlog")}
        </Link>
        <div className="epage">
          <span className="pico">
            <Settings2 style={{ width: 16, height: 16 }} />
          </span>
          <div>
            <div className="ptit">{post.title.trim() || t("blogUntitled")}</div>
            <div className="psub">
              {subdomain}/blog/{savedSlug || slugPlaceholder}
            </div>
          </div>
        </div>
        <span
          className={`tag ${pill.cls} editor-only`}
          style={{ marginLeft: 4 }}
        >
          <span className="d" />
          {pill.label}
        </span>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span className="savedot editor-only">
            <i />
            {t("blogWordCount", { count: wordCount(post.bodyHtml) })}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setPreview(true)}
          >
            <Eye style={{ width: 15, height: 15 }} />
            {t("previewCta")}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onSave}
            disabled={saving || !dirty}
          >
            {saving ? (
              <Loader2
                className="animate-spin"
                style={{ width: 15, height: 15 }}
              />
            ) : (
              <PubIcon style={{ width: 15, height: 15 }} />
            )}
            {pubLabel}
          </button>
        </div>
      </header>

      <div className="ebody">
        {/* document */}
        <div className="post-wrap thin">
          <article className="post-doc">
            <div
              className={`post-cover${coverUrl ? "" : "empty"}`}
              style={
                coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined
              }
              onClick={pickCover}
            >
              <div className="cv-ov">
                <ImagePlus style={{ width: 18, height: 18 }} />
                {t("blogReplaceCover")}
              </div>
            </div>
            <div className="post-inner">
              {category ? (
                <span className="post-cat">{category.name}</span>
              ) : null}
              <AutoGrow
                className="post-title"
                value={post.title}
                onChange={(v) => patch({ title: v })}
                placeholder={t("blogTitlePlaceholder")}
                maxLength={200}
              />
              <AutoGrow
                className="post-stand"
                value={post.excerpt}
                onChange={(v) => patch({ excerpt: v })}
                placeholder={t("blogStandfirstPlaceholder")}
                maxLength={300}
              />
              <div className="post-meta">
                <span className="pav">
                  {authorAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={authorAvatar} alt="" />
                  ) : (
                    authorInitials
                  )}
                </span>
                <div>
                  <div className="pn">{author?.name || t("blogNoAuthor")}</div>
                  <div className="pd">
                    {dateLabel} ·{" "}
                    {t("blogReadingTime", {
                      minutes: Math.max(
                        1,
                        Math.round(wordCount(post.bodyHtml) / 200),
                      ),
                    })}
                  </div>
                </div>
              </div>
              <div className="post-body-wrap">
                <RichTextEditor
                  value={post.bodyHtml}
                  onChange={(html) => patch({ bodyHtml: html })}
                  placeholder={t("blogBodyPlaceholder")}
                  onImageUpload={uploadBodyImage}
                  onPickFromLibrary={pickFromLibrary}
                />
              </div>
            </div>
          </article>
        </div>

        {/* settings rail */}
        <aside className="epanel r editor-only">
          <div className="epanel-h">
            <Settings2 style={{ width: 16, height: 16, color: "#10B981" }} />
            <h3>{t("blogSettingsTitle")}</h3>
          </div>
          <div className="epanel-b thin">
            <div className="insp-sec">
              <div className="isec-t">{t("blogStatus")}</div>
              <div className="fld">
                <div className="choice">
                  {STATUSES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      className={post.status === s.key ? "on" : ""}
                      onClick={() => patch({ status: s.key })}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              {post.status === "scheduled" ? (
                <div className="fld">
                  <label>{t("blogScheduleFor")}</label>
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
                  />
                </div>
              ) : null}
              <div className="fld">
                <div className="fld-row">
                  <label style={{ margin: 0 }}>{t("blogFeature")}</label>
                  <button
                    type="button"
                    className={`sw${post.featured ? "on" : ""}`}
                    onClick={() => patch({ featured: !post.featured })}
                    aria-pressed={post.featured}
                  />
                </div>
              </div>
            </div>

            <div className="insp-sec">
              <div className="isec-t">{t("blogOrganise")}</div>
              <div className="fld">
                <label>{t("blogCategory")}</label>
                <select
                  value={post.categoryId}
                  onChange={(e) => patch({ categoryId: e.target.value })}
                >
                  <option value="">{t("blogNoCategory")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld">
                <label>{t("blogTags")}</label>
                {post.tags.length > 0 ? (
                  <div className="chiprow" style={{ marginBottom: 7 }}>
                    {post.tags.map((tag, i) => (
                      <span className="chip-t" key={tag}>
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(i)}
                          aria-label={`Remove ${tag}`}
                        >
                          <X style={{ width: 12, height: 12 }} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <input
                  type="text"
                  list="post-tag-suggestions"
                  value={tagDraft}
                  placeholder={t("blogAddTag")}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag(tagDraft);
                    } else if (
                      e.key === "Backspace" &&
                      !tagDraft &&
                      post.tags.length > 0
                    ) {
                      removeTag(post.tags.length - 1);
                    }
                  }}
                  onBlur={() => addTag(tagDraft)}
                />
                <datalist id="post-tag-suggestions">
                  {allTags.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div className="fld">
                <label>{t("blogAuthor")}</label>
                <select
                  value={post.authorId}
                  onChange={(e) => patch({ authorId: e.target.value })}
                >
                  <option value="">{t("blogNoAuthor")}</option>
                  {authors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="insp-sec">
              <div className="isec-t">{t("blogFeaturedImage")}</div>
              <div className="imgpick" onClick={pickCover}>
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverUrl} alt="" />
                ) : null}
                <div className="ip-ov">
                  <ImagePlus style={{ width: 16, height: 16 }} />
                  {t("blogReplace")}
                </div>
              </div>
            </div>

            <div className="insp-sec">
              <div className="isec-t">{t("blogLinkSeo")}</div>
              <div className="fld">
                <label>{t("blogSlug")}</label>
                <input
                  type="text"
                  value={post.slug}
                  placeholder={slugPlaceholder}
                  maxLength={80}
                  onChange={(e) => patch({ slug: e.target.value })}
                />
              </div>
              <div className="fld">
                <label>{t("blogSeoMetaTitle")}</label>
                <input
                  type="text"
                  value={post.seoTitle}
                  placeholder={post.title}
                  maxLength={70}
                  onChange={(e) => patch({ seoTitle: e.target.value })}
                />
              </div>
              <div className="fld">
                <label>{t("blogSeoMetaDesc")}</label>
                <textarea
                  value={post.seoDescription}
                  maxLength={200}
                  onChange={(e) => patch({ seoDescription: e.target.value })}
                />
              </div>
              <div className="seo-prev">
                <div className="su">
                  {subdomain}/blog/{savedSlug || slugPlaceholder}
                </div>
                <div className="st">{seoTitle}</div>
                <div className="sd">
                  {seoDesc || t("blogSeoDescPlaceholder")}
                </div>
              </div>
            </div>

            <div className="insp-sec">
              <div className="isec-t">{t("blogMarketingTitle")}</div>
              <div className="fld">
                <label>{t("blogPixelEvent")}</label>
                <select
                  value={post.pixelEvent}
                  onChange={(e) => patch({ pixelEvent: e.target.value })}
                >
                  {PAGE_PIXEL_EVENTS.map((ev) => (
                    <option key={ev} value={ev}>
                      {ev === "none" ? t("blogPixelEventNone") : ev}
                    </option>
                  ))}
                </select>
                <span className="fld-hint">{t("blogPixelEventHint")}</span>
              </div>
              <div className="fld">
                <label>{t("blogHeadCode")}</label>
                <textarea
                  value={post.headCode}
                  maxLength={4000}
                  rows={4}
                  spellCheck={false}
                  placeholder="<meta ... />"
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 12,
                  }}
                  onChange={(e) => patch({ headCode: e.target.value })}
                />
                <span className="fld-hint">{t("blogHeadCodeHint")}</span>
              </div>
            </div>

            <div className="insp-sec">
              <button
                type="button"
                onClick={onDelete}
                className="btn btn-ghost btn-sm"
                style={{ width: "100%", color: "#B91C1C" }}
              >
                <Trash2 style={{ width: 14, height: 14 }} />
                {t("blogDeletePost")}
              </button>
            </div>
          </div>
        </aside>
      </div>

      <button
        type="button"
        className="btn btn-dark exitpv"
        onClick={() => setPreview(false)}
      >
        <X style={{ width: 15, height: 15 }} />
        {t("blogExitPreview")}
      </button>

      <MediaLibrary
        open={mediaOpen}
        onOpenChange={handleMediaOpenChange}
        websiteId={websiteId}
        onSelectItem={handleSelectItem}
      />
    </div>
  );
}
