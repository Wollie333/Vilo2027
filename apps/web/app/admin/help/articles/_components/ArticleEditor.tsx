"use client";

import {
  AlertCircle,
  ArchiveRestore,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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
import { HelpTiptap } from "./HelpTiptap";

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
  isDeleted: boolean;
};

type Props = {
  mode: Mode;
  defaults: Defaults;
  categories: Pick<HelpCategoryRow, "id" | "name" | "slug">[];
};

export function ArticleEditor({ mode, defaults, categories }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(defaults.title);
  const [slugInput, setSlugInput] = useState(defaults.slug);
  const [slugDirty, setSlugDirty] = useState(false);
  const [excerpt, setExcerpt] = useState(defaults.excerpt);
  const [bodyHtml, setBodyHtml] = useState(defaults.bodyHtml);
  const [bodyJson, setBodyJson] = useState<unknown>(defaults.bodyJson);
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
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const autoSlug = useMemo(() => slugify(title || "untitled"), [title]);
  const effectiveSlug = slugDirty ? slugInput : autoSlug;

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
      bodyJson,
      categoryId: categoryId || null,
      audience,
      status: nextStatus ?? status,
      featuredRank: featuredRank.trim() ? Number(featuredRank) : null,
      readTimeMinutes,
      hasVideo,
    };
    startTransition(async () => {
      const res = await saveHelpArticle(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOkMsg(
        nextStatus === "published"
          ? "Published — live on /help and /dashboard/help."
          : "Saved.",
      );
      setStatus(payload.status);
      if (mode === "create") {
        router.replace(`/admin/help/articles/${res.id}`);
      } else {
        router.refresh();
      }
    });
  }

  function archive() {
    const reason = window.prompt("Reason for archiving (min 5 chars):");
    if (!reason || reason.trim().length < 5) return;
    startTransition(async () => {
      const res = await archiveHelpArticle({ id: defaults.id, reason });
      if (!res.ok) setError(res.error);
      else {
        setOkMsg("Archived.");
        setStatus("archived");
        router.refresh();
      }
    });
  }

  function softDelete() {
    const reason = window.prompt("Reason for soft-deleting (min 5 chars):");
    if (!reason || reason.trim().length < 5) return;
    startTransition(async () => {
      const res = await softDeleteHelpArticle({ id: defaults.id, reason });
      if (!res.ok) setError(res.error);
      else router.replace("/admin/help/articles");
    });
  }

  function restore() {
    const reason = window.prompt("Reason for restoring (min 5 chars):");
    if (!reason || reason.trim().length < 5) return;
    startTransition(async () => {
      const res = await restoreHelpArticle({ id: defaults.id, reason });
      if (!res.ok) setError(res.error);
      else {
        setOkMsg("Restored as draft.");
        setStatus("draft");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/admin/help/articles"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-mute hover:text-brand-primary"
          >
            <ArrowLeft className="h-3 w-3" /> Back to articles
          </Link>
          <h1 className="mt-2 font-display text-2xl font-bold text-brand-ink">
            {mode === "create" ? "New article" : "Edit article"}
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            Slug:{" "}
            <code className="rounded bg-brand-light px-1.5 py-0.5 font-mono text-[11px] text-brand-ink">
              /help/{effectiveSlug}
            </code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mode === "update" ? (
            <Link
              href={`/help/${defaults.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
            >
              Preview <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => save()}
            disabled={pending || !title.trim()}
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-1.5 text-sm font-medium text-brand-ink hover:bg-brand-light disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> Save draft
          </button>
          <button
            type="button"
            onClick={() => save("published")}
            disabled={pending || !title.trim()}
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
          >
            <BookOpen className="h-4 w-4" />{" "}
            {status === "published" ? "Update live" : "Publish"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {okMsg ? (
        <div className="flex items-start gap-2 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{okMsg}</span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="How to issue a partial refund without cancelling a booking"
              className="w-full rounded border border-brand-line bg-white px-3 py-2 font-display text-base font-semibold text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </Field>

          <Field label="Slug" hint="URL path under /help/…">
            <input
              value={slugInput || autoSlug}
              onChange={(e) => {
                setSlugInput(slugify(e.target.value));
                setSlugDirty(true);
              }}
              placeholder={autoSlug}
              className="w-full rounded border border-brand-line bg-white px-3 py-2 font-mono text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
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
              className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </Field>

          <Field label="Body">
            <HelpTiptap
              initialHtml={defaults.bodyHtml}
              onChange={({ html, json }) => {
                setBodyHtml(html);
                setBodyJson(json);
              }}
            />
          </Field>
        </div>

        <aside className="space-y-5">
          <SidePanel label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as HelpStatus)}
              className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm capitalize"
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
              className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
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
              className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm capitalize"
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
              className="num w-full rounded border border-brand-line bg-white px-3 py-2 font-mono text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </SidePanel>

          <SidePanel label="Read time (minutes)">
            <input
              type="number"
              min={1}
              max={60}
              value={readTimeMinutes}
              onChange={(e) => setReadTimeMinutes(Number(e.target.value))}
              className="num w-full rounded border border-brand-line bg-white px-3 py-2 font-mono text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
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
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
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
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      onClick={softDelete}
                      disabled={pending}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
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
