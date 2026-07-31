"use client";

import {
  AlertCircle,
  ArchiveRestore,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  ImageIcon,
  Save,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { modal } from "@/components/ui/modal-host";
import { SITE_DOMAIN, SITE_URL } from "@/lib/contact";
import { slugify } from "@/lib/help/slug";
import type {
  HelpAudience,
  HelpCategoryRow,
  HelpStatus,
} from "@/lib/help/types";

import {
  archiveHelpArticle,
  restoreHelpArticle,
  saveHelpArticle,
  softDeleteHelpArticle,
} from "../actions";

type Mode = "create" | "update";

type Defaults = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  bodyJson: unknown;
  categoryId: string | null;
  audience: HelpAudience;
  status: HelpStatus;
  featuredRank: number | null;
  readTimeMinutes: number;
  hasVideo: boolean;
  seoTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  isDeleted: boolean;
};

type Props = {
  mode: Mode;
  defaults: Defaults;
  categories: Pick<HelpCategoryRow, "id" | "name" | "slug">[];
};

const STATUS_STYLES: Record<HelpStatus, string> = {
  draft: "border-amber-200 bg-amber-50 text-amber-700",
  published: "border-emerald-200 bg-emerald-50 text-emerald-700",
  archived: "border-brand-line bg-brand-light text-brand-mute",
};

const SEO_TITLE_REC = 60;
const SEO_DESC_REC = 160;

function wordCount(html: string): number {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

export function ArticleEditor({ mode, defaults, categories }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(defaults.title);
  const [slugInput, setSlugInput] = useState(defaults.slug);
  const [slugDirty, setSlugDirty] = useState(Boolean(defaults.slug));
  const [excerpt, setExcerpt] = useState(defaults.excerpt);
  const [bodyHtml, setBodyHtml] = useState(defaults.bodyHtml);
  const [categoryId, setCategoryId] = useState<string>(
    defaults.categoryId ?? "",
  );
  const [audience, setAudience] = useState<HelpAudience>(defaults.audience);
  const [status, setStatus] = useState<HelpStatus>(defaults.status);
  const [readTimeMinutes, setReadTimeMinutes] = useState(
    defaults.readTimeMinutes,
  );
  const [featuredRank, setFeaturedRank] = useState<string>(
    defaults.featuredRank?.toString() ?? "",
  );
  const [hasVideo, setHasVideo] = useState(defaults.hasVideo);
  const [seoTitle, setSeoTitle] = useState(defaults.seoTitle);
  const [metaDescription, setMetaDescription] = useState(
    defaults.metaDescription,
  );
  const [ogImageUrl, setOgImageUrl] = useState(defaults.ogImageUrl);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  // The slug/status actually persisted — drives the live URL banner so it never
  // points at an unsaved edit. The server may adjust the slug for uniqueness.
  const [savedSlug, setSavedSlug] = useState(defaults.slug);
  const [savedStatus, setSavedStatus] = useState<HelpStatus>(defaults.status);

  const autoSlug = useMemo(() => slugify(title || "untitled"), [title]);
  const effectiveSlug = slugDirty ? slugInput : autoSlug;

  const words = useMemo(() => wordCount(bodyHtml), [bodyHtml]);
  const suggestedMinutes = Math.max(1, Math.round(words / 200) || 1);

  // Dirty tracking — a compact snapshot of everything that gets persisted.
  const snapshot = useMemo(
    () =>
      JSON.stringify({
        title,
        slug: effectiveSlug,
        excerpt,
        bodyHtml,
        categoryId,
        audience,
        status,
        featuredRank,
        readTimeMinutes,
        hasVideo,
        seoTitle,
        metaDescription,
        ogImageUrl,
      }),
    [
      title,
      effectiveSlug,
      excerpt,
      bodyHtml,
      categoryId,
      audience,
      status,
      featuredRank,
      readTimeMinutes,
      hasVideo,
      seoTitle,
      metaDescription,
      ogImageUrl,
    ],
  );
  const savedSnapshotRef = useRef(snapshot);
  const [dirty, setDirty] = useState(mode === "create");
  useEffect(() => {
    setDirty(snapshot !== savedSnapshotRef.current);
  }, [snapshot]);

  const liveUrl = `${SITE_URL}/help/${savedSlug}`;
  const isPublishedLive = savedStatus === "published" && !defaults.isDeleted;

  // Live SEO preview values (mirror the public generateMetadata fallbacks).
  const previewTitle = seoTitle.trim() || title.trim() || "Untitled article";
  const previewDesc =
    metaDescription.trim() ||
    excerpt.trim() ||
    "Add a meta description so search engines show a helpful summary.";

  async function copyLiveUrl() {
    try {
      await navigator.clipboard.writeText(liveUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy to clipboard.");
    }
  }

  // Body-image insertion for the shared RichTextEditor. Help has no media
  // library, so we accept an image URL (sanitiser + <img> render allow https
  // sources) — matching how the featured image is set.
  async function pickBodyImage(): Promise<{
    url: string;
    alt?: string;
  } | null> {
    const url = await modal.prompt({
      title: "Insert image",
      label: "Image URL",
      placeholder: "https://…/screenshot.png",
      confirmLabel: "Next",
    });
    if (!url || url.trim() === "") return null;
    const alt = await modal.prompt({
      title: "Describe the image",
      description:
        "Alt text is read by screen readers and shown if the image fails to load.",
      label: "Alt text",
      placeholder: "Refund button in the booking sidebar",
      confirmLabel: "Insert image",
    });
    return { url: url.trim(), alt: (alt ?? "").trim() || undefined };
  }

  function save(nextStatus?: HelpStatus) {
    setError(null);
    setOkMsg(null);
    const payload = {
      mode,
      id: defaults.id,
      title,
      slug: effectiveSlug,
      excerpt,
      bodyHtml,
      bodyJson: defaults.bodyJson ?? {},
      categoryId: categoryId || null,
      audience,
      status: nextStatus ?? status,
      featuredRank: featuredRank.trim() ? Number(featuredRank) : null,
      readTimeMinutes,
      hasVideo,
      seoTitle,
      metaDescription,
      ogImageUrl,
    };
    startTransition(async () => {
      const res = await saveHelpArticle(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStatus(payload.status);
      setSavedStatus(payload.status);
      setSavedSlug(res.slug);
      setSlugInput(res.slug);
      setSlugDirty(true);
      savedSnapshotRef.current = JSON.stringify({
        title,
        slug: res.slug,
        excerpt,
        bodyHtml,
        categoryId,
        audience,
        status: payload.status,
        featuredRank,
        readTimeMinutes,
        hasVideo,
        seoTitle,
        metaDescription,
        ogImageUrl,
      });
      setDirty(false);
      setOkMsg(
        payload.status === "published"
          ? "Published — live on /help and /dashboard/help."
          : "Saved as draft.",
      );
      if (mode === "create") {
        router.replace(`/admin/help/articles/${res.id}`);
      } else {
        router.refresh();
      }
    });
  }

  async function archive() {
    const reason = await modal.prompt({
      title: "Archive this article?",
      label: "Reason (recorded in the audit log)",
      placeholder: "Why are you archiving this?",
      minLength: 5,
      confirmLabel: "Archive",
    });
    if (!reason) return;
    startTransition(async () => {
      const res = await archiveHelpArticle({ id: defaults.id, reason });
      if (!res.ok) setError(res.error);
      else {
        setOkMsg("Archived.");
        setStatus("archived");
        setSavedStatus("archived");
        router.refresh();
      }
    });
  }

  async function softDelete() {
    const reason = await modal.prompt({
      title: "Delete this article?",
      description: "It's soft-deleted and can be restored later.",
      label: "Reason (recorded in the audit log)",
      placeholder: "Why are you deleting this?",
      minLength: 5,
      confirmLabel: "Delete article",
      intent: "destructive",
    });
    if (!reason) return;
    startTransition(async () => {
      const res = await softDeleteHelpArticle({ id: defaults.id, reason });
      if (!res.ok) setError(res.error);
      else router.replace("/admin/help/articles");
    });
  }

  async function restore() {
    const reason = await modal.prompt({
      title: "Restore this article?",
      description: "It comes back as a draft.",
      label: "Reason (recorded in the audit log)",
      placeholder: "Why are you restoring this?",
      minLength: 5,
      confirmLabel: "Restore",
    });
    if (!reason) return;
    startTransition(async () => {
      const res = await restoreHelpArticle({ id: defaults.id, reason });
      if (!res.ok) setError(res.error);
      else {
        setOkMsg("Restored as draft.");
        setStatus("draft");
        setSavedStatus("draft");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-brand-line bg-white/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/admin/help/articles"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-mute hover:text-brand-primary"
            >
              <ArrowLeft className="h-3 w-3" /> Back to articles
            </Link>
            <div className="mt-1.5 flex items-center gap-2">
              <h1 className="truncate font-display text-xl font-bold text-brand-ink">
                {title.trim() ||
                  (mode === "create" ? "New article" : "Untitled")}
              </h1>
              <span
                className={`shrink-0 rounded-pill border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLES[status]}`}
              >
                {status}
              </span>
              {dirty ? (
                <span className="shrink-0 text-[11px] font-medium text-amber-600">
                  ● Unsaved changes
                </span>
              ) : mode === "update" ? (
                <span className="shrink-0 text-[11px] font-medium text-brand-mute">
                  All changes saved
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isPublishedLive ? (
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-brand-line bg-white px-3 py-2 text-xs font-medium text-brand-ink hover:bg-brand-light"
              >
                <Eye className="h-3.5 w-3.5" /> View live
              </a>
            ) : mode === "update" ? (
              <a
                href={`/help/${effectiveSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-brand-line bg-white px-3 py-2 text-xs font-medium text-brand-ink hover:bg-brand-light"
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => save()}
              disabled={pending || !title.trim()}
              className="inline-flex items-center gap-1.5 rounded-md border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-light disabled:opacity-60"
            >
              <Save className="h-4 w-4" />{" "}
              {savedStatus === "published" ? "Save" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => save("published")}
              disabled={pending || !title.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-secondary disabled:opacity-60"
            >
              <BookOpen className="h-4 w-4" />{" "}
              {savedStatus === "published" ? "Update live" : "Publish"}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {okMsg ? (
        <div className="flex items-start gap-2 rounded-card border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{okMsg}</span>
        </div>
      ) : null}

      {/* Live URL banner — only once the article is actually published */}
      {isPublishedLive ? (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                Live URL
              </div>
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate font-mono text-sm text-brand-ink hover:text-brand-primary hover:underline"
              >
                {liveUrl}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyLiveUrl}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </>
              )}
            </button>
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Open <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          {dirty ? (
            <p className="w-full text-[11px] text-amber-600">
              You have unsaved edits — publish again to push them live.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="How to issue a partial refund without cancelling a booking"
              className="w-full rounded-md border border-brand-line bg-white px-3 py-2.5 font-display text-base font-semibold text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </Field>

          <Field
            label="Excerpt"
            hint="1–2 sentences shown on the list and at the top of the article."
          >
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Goodwill refunds keep the reservation intact…"
              className="w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
            <div className="mt-1 text-right text-[11px] text-brand-mute">
              {excerpt.length}/500
            </div>
          </Field>

          <Field label="Body">
            <RichTextEditor
              value={bodyHtml}
              onChange={setBodyHtml}
              placeholder="Write the article… use the toolbar for headings, lists, links and images."
              onPickFromLibrary={pickBodyImage}
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-brand-mute">
              <span>
                {words.toLocaleString("en-ZA")} {words === 1 ? "word" : "words"}
              </span>
              <span>≈ {suggestedMinutes} min read</span>
            </div>
          </Field>

          {/* SEO box — modelled on the website blog editor. Help articles are
              Wielo's public SEO source, so this controls how each appears on
              Google and when shared. */}
          <section className="overflow-hidden rounded-card border border-brand-line bg-white">
            <div className="flex items-center gap-2 border-b border-brand-line bg-brand-light/50 px-4 py-2.5">
              <Search className="h-4 w-4 text-brand-primary" />
              <div>
                <div className="text-sm font-semibold text-brand-ink">
                  Search engine &amp; social (SEO)
                </div>
                <div className="text-[11px] text-brand-mute">
                  How this article appears on Google and when shared. This is
                  Wielo&apos;s SEO source.
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-4 md:grid-cols-2">
              <div className="space-y-3">
                <Field label="Slug" hint="URL path under /help/…">
                  <div className="flex items-stretch overflow-hidden rounded-md border border-brand-line bg-white focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20">
                    <span className="flex items-center border-r border-brand-line bg-brand-light px-3 font-mono text-xs text-brand-mute">
                      /help/
                    </span>
                    <input
                      value={slugInput || autoSlug}
                      onChange={(e) => {
                        setSlugInput(slugify(e.target.value));
                        setSlugDirty(true);
                      }}
                      placeholder={autoSlug}
                      className="min-w-0 flex-1 bg-white px-3 py-2 font-mono text-sm text-brand-ink focus:outline-none"
                    />
                  </div>
                </Field>

                <Field label="SEO title">
                  <input
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    maxLength={70}
                    placeholder={title || "Falls back to the article title"}
                    className="w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                  <CharMeter len={seoTitle.length} rec={SEO_TITLE_REC} />
                </Field>

                <Field label="Meta description">
                  <textarea
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    rows={3}
                    maxLength={200}
                    placeholder={
                      excerpt ||
                      "Falls back to the excerpt. ~160 chars is ideal."
                    }
                    className="w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                  <CharMeter len={metaDescription.length} rec={SEO_DESC_REC} />
                </Field>

                <Field
                  label="Featured / share image"
                  hint="og:image · 1200×630 works best"
                >
                  <input
                    value={ogImageUrl}
                    onChange={(e) => setOgImageUrl(e.target.value)}
                    placeholder="https://…/cover.jpg"
                    className="w-full rounded-md border border-brand-line bg-white px-3 py-2 font-mono text-xs text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                </Field>
              </div>

              {/* Live preview: Google result + social share card */}
              <div className="space-y-4">
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                    <Search className="h-3 w-3" /> Google preview
                  </div>
                  <div className="rounded-md border border-brand-line bg-white p-3">
                    <div className="truncate text-[12px] text-brand-mute">
                      {SITE_DOMAIN} › help › {effectiveSlug}
                    </div>
                    <div className="mt-0.5 truncate text-[15px] font-medium text-[#1a0dab]">
                      {previewTitle}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-brand-ink/70">
                      {previewDesc}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                    <Globe className="h-3 w-3" /> Social share
                  </div>
                  <div className="overflow-hidden rounded-md border border-brand-line bg-white">
                    <div className="relative aspect-[1200/630] w-full bg-brand-light">
                      {ogImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ogImageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-brand-mute">
                          <ImageIcon className="h-6 w-6" />
                          <span className="text-[11px]">
                            Add a featured image
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-brand-line px-3 py-2">
                      <div className="truncate text-[10px] uppercase tracking-wide text-brand-mute">
                        {SITE_DOMAIN}
                      </div>
                      <div className="mt-0.5 truncate text-[13px] font-semibold text-brand-ink">
                        {previewTitle}
                      </div>
                      <div className="line-clamp-1 text-[11px] text-brand-mute">
                        {previewDesc}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <SidePanel label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as HelpStatus)}
              className="w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm capitalize focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
          </SidePanel>

          <SidePanel label="Category">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="">— uncategorised —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </SidePanel>

          <SidePanel label="Audience">
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as HelpAudience)}
              className="w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm capitalize focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="host">host</option>
              <option value="guest">guest</option>
              <option value="both">both</option>
            </select>
          </SidePanel>

          <SidePanel label="Featured rank" hint="ascending; blank = unpinned">
            <input
              type="number"
              min={1}
              max={100}
              value={featuredRank}
              onChange={(e) => setFeaturedRank(e.target.value)}
              className="num w-full rounded-md border border-brand-line bg-white px-3 py-2 font-mono text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </SidePanel>

          <SidePanel label="Read time (minutes)">
            <input
              type="number"
              min={1}
              max={60}
              value={readTimeMinutes}
              onChange={(e) => setReadTimeMinutes(Number(e.target.value))}
              className="num w-full rounded-md border border-brand-line bg-white px-3 py-2 font-mono text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
            {suggestedMinutes !== readTimeMinutes ? (
              <button
                type="button"
                onClick={() => setReadTimeMinutes(suggestedMinutes)}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-brand-primary hover:underline"
              >
                <Sparkles className="h-3 w-3" /> Use {suggestedMinutes} min from
                word count
              </button>
            ) : null}
          </SidePanel>

          <section className="rounded-card border border-brand-line bg-white p-4">
            <label className="inline-flex items-center gap-2 text-sm text-brand-ink">
              <input
                type="checkbox"
                checked={hasVideo}
                onChange={(e) => setHasVideo(e.target.checked)}
                className="rounded border-brand-line"
              />
              Article includes a video
            </label>
          </section>

          {mode === "update" ? (
            <section className="rounded-card border border-brand-line bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                Danger zone
              </div>
              <div className="mt-3 space-y-2">
                {defaults.isDeleted ? (
                  <button
                    type="button"
                    onClick={restore}
                    disabled={pending}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" /> Restore from
                    trash
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={archive}
                      disabled={pending || status === "archived"}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      onClick={softDelete}
                      disabled={pending}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Soft-delete
                    </button>
                  </>
                )}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function CharMeter({ len, rec }: { len: number; rec: number }) {
  const over = len > rec;
  return (
    <div
      className={`mt-1 text-right text-[11px] ${
        over ? "font-medium text-amber-600" : "text-brand-mute"
      }`}
    >
      {len}/{rec}
      {over ? " · a bit long" : ""}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          {label}
        </span>
        {hint ? (
          <span className="text-[11px] text-brand-mute">{hint}</span>
        ) : null}
      </div>
      {children}
    </label>
  );
}

function SidePanel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-brand-line bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
        {hint ? (
          <span className="ml-1 normal-case text-brand-mute">({hint})</span>
        ) : null}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}
