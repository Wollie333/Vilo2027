"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { parseVideoEmbed } from "@/lib/help/embed";
import type {
  HelpAudience,
  HelpCategoryRow,
  HelpStatus,
} from "@/lib/help/types";

import { deleteHelpVideo, saveHelpVideo } from "./actions";

type Defaults = {
  id: string;
  title: string;
  description: string;
  categoryId: string | null;
  audience: HelpAudience;
  embedUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  status: HelpStatus;
  featuredRank: number | null;
  sortOrder: number;
  isNew: boolean;
};

type Props = {
  mode: "create" | "update";
  defaults: Defaults;
  categories: Pick<HelpCategoryRow, "id" | "name" | "slug">[];
};

export function VideoForm({ mode, defaults, categories }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(defaults.title);
  const [description, setDescription] = useState(defaults.description);
  const [categoryId, setCategoryId] = useState(defaults.categoryId ?? "");
  const [audience, setAudience] = useState<HelpAudience>(defaults.audience);
  const [embedUrl, setEmbedUrl] = useState(defaults.embedUrl);
  const [thumbnailUrl, setThumbnailUrl] = useState(defaults.thumbnailUrl ?? "");
  const [durationSeconds, setDurationSeconds] = useState(
    defaults.durationSeconds,
  );
  const [status, setStatus] = useState<HelpStatus>(defaults.status);
  const [featuredRank, setFeaturedRank] = useState<string>(
    defaults.featuredRank?.toString() ?? "",
  );
  const [sortOrder, setSortOrder] = useState(defaults.sortOrder);
  const [isNew, setIsNew] = useState(defaults.isNew);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsedEmbed = parseVideoEmbed(embedUrl);

  function save(nextStatus?: HelpStatus) {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      const res = await saveHelpVideo({
        id: mode === "update" ? defaults.id : undefined,
        title,
        description,
        categoryId: categoryId || null,
        audience,
        embedUrl,
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        durationSeconds,
        status: nextStatus ?? status,
        featuredRank: featuredRank.trim() ? Number(featuredRank) : null,
        sortOrder,
        isNew,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOkMsg("Saved.");
      setStatus(nextStatus ?? status);
      if (mode === "create") router.replace(`/admin/help/videos/${res.id}`);
      else router.refresh();
    });
  }

  function remove() {
    const reason = window.prompt("Reason for deleting (min 5 chars):");
    if (!reason || reason.trim().length < 5) return;
    startTransition(async () => {
      const res = await deleteHelpVideo({ id: defaults.id, reason });
      if (!res.ok) setError(res.error);
      else router.replace("/admin/help/videos");
    });
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/help/videos"
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-mute hover:text-brand-primary"
      >
        <ArrowLeft className="h-3 w-3" /> Back to videos
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            {mode === "create" ? "New video" : "Edit video"}
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            Paste a YouTube or Vimeo URL — we derive the embed and thumbnail.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => save()}
            disabled={pending || !title.trim() || !embedUrl}
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-1.5 text-sm font-medium text-brand-ink hover:bg-brand-light disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> Save draft
          </button>
          <button
            type="button"
            onClick={() => save("published")}
            disabled={pending || !title.trim() || !embedUrl}
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-secondary disabled:opacity-60"
          >
            {status === "published" ? "Update live" : "Publish"}
          </button>
        </div>
      </header>

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
              className="w-full rounded border border-brand-line bg-white px-3 py-2 font-display text-base font-semibold focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </Field>
          <Field
            label="Description"
            hint="Shown below the title on the player."
          >
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </Field>
          <Field label="YouTube or Vimeo URL">
            <input
              value={embedUrl}
              onChange={(e) => setEmbedUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              className="w-full rounded border border-brand-line bg-white px-3 py-2 font-mono text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
            <p className="mt-1 text-[11px] text-brand-mute">
              {parsedEmbed
                ? `Parsed as ${parsedEmbed.provider.toUpperCase()} id ${parsedEmbed.id}.`
                : "We accept youtube.com/watch?v=…, youtu.be/…, youtube.com/embed/…, and vimeo.com/…"}
            </p>
          </Field>
          <Field
            label="Thumbnail URL (optional)"
            hint="Falls back to the provider's default thumbnail."
          >
            <input
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://… (or leave blank)"
              className="w-full rounded border border-brand-line bg-white px-3 py-2 font-mono text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
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
          <SidePanel label="Duration (seconds)">
            <input
              type="number"
              min={0}
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(Number(e.target.value))}
              className="num w-full rounded border border-brand-line bg-white px-3 py-2 font-mono text-sm"
            />
          </SidePanel>
          <SidePanel label="Featured rank" hint="ascending; blank = unpinned">
            <input
              type="number"
              min={1}
              max={100}
              value={featuredRank}
              onChange={(e) => setFeaturedRank(e.target.value)}
              className="num w-full rounded border border-brand-line bg-white px-3 py-2 font-mono text-sm"
            />
          </SidePanel>
          <SidePanel label="Sort order">
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="num w-full rounded border border-brand-line bg-white px-3 py-2 font-mono text-sm"
            />
          </SidePanel>
          <section className="rounded-card border border-brand-line bg-white p-4">
            <label className="inline-flex items-center gap-2 text-sm text-brand-ink">
              <input
                type="checkbox"
                checked={isNew}
                onChange={(e) => setIsNew(e.target.checked)}
                className="rounded border-brand-line"
              />
              Show NEW badge on tile
            </label>
          </section>
          {mode === "update" ? (
            <section className="rounded-card border border-red-200 bg-red-50 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-red-800">
                Danger zone
              </div>
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" /> Soft-delete
              </button>
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
