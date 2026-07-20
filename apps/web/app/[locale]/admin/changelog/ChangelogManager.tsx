"use client";

import {
  ExternalLink,
  Loader2,
  Plus,
  Save,
  ScrollText,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/editor/RichTextEditor";

import {
  deleteChangelogEntryAction,
  saveChangelogEntryAction,
} from "./actions";

export type ChangelogItem = {
  id: string;
  slug: string;
  title: string;
  bodyHtml: string | null;
  creditedHostId: string | null;
  creditedName: string | null;
  featureRequestId: string | null;
  shippedAt: string | null;
  isPublished: boolean;
};

type HostOption = { id: string; name: string; email: string | null };
type ShippedOption = { id: string; title: string };

export function ChangelogManager({
  entries,
  hosts,
  shipped,
}: {
  entries: ChangelogItem[];
  hosts: HostOption[];
  shipped: ShippedOption[];
}) {
  return (
    <div className="space-y-6">
      <NewEntryCard existingSlugs={entries.map((e) => e.slug)} />
      {entries.length === 0 ? (
        <p className="text-sm text-brand-mute">
          No entries yet. Create one above — until you publish one, the public
          page shows the repo changelog.
        </p>
      ) : (
        entries.map((e) => (
          <EntryCard key={e.id} entry={e} hosts={hosts} shipped={shipped} />
        ))
      )}
    </div>
  );
}

function NewEntryCard({ existingSlugs }: { existingSlugs: string[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [pending, start] = useTransition();

  const normalisedSlug = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const slugTaken = existingSlugs.includes(normalisedSlug);
  const valid =
    normalisedSlug.length >= 2 && title.trim().length >= 2 && !slugTaken;

  function create() {
    if (!valid || pending) return;
    start(async () => {
      try {
        await saveChangelogEntryAction({
          slug: normalisedSlug,
          title: title.trim(),
          html: "",
          isPublished: false,
        });
        toast.success("Entry created — add its detail below.");
        setTitle("");
        setSlug("");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not create.");
      }
    });
  }

  return (
    <div className="rounded-card border border-dashed border-brand-line bg-brand-light/40 p-5">
      <div className="flex items-center gap-2">
        <Plus className="h-4 w-4 text-brand-primary" />
        <h3 className="font-display text-sm font-bold text-brand-ink">
          New changelog entry
        </h3>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[12px] font-semibold text-brand-mute">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. WhatsApp booking notifications"
            className="mt-1 w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary"
          />
        </div>
        <div>
          <label className="text-[12px] font-semibold text-brand-mute">
            Slug (URL)
          </label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="whatsapp-notifications"
            className="mt-1 w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 font-mono text-[13px] text-brand-ink outline-none focus:border-brand-primary"
          />
          {slugTaken ? (
            <p className="mt-1 text-[11px] text-red-600">
              That slug is already in use.
            </p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={create}
        disabled={!valid || pending}
        className="mt-4 inline-flex h-[40px] items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Create entry
      </button>
    </div>
  );
}

function EntryCard({
  entry,
  hosts,
  shipped,
}: {
  entry: ChangelogItem;
  hosts: HostOption[];
  shipped: ShippedOption[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(entry.title);
  const [html, setHtml] = useState(entry.bodyHtml ?? "");
  const [creditedHostId, setCreditedHostId] = useState(
    entry.creditedHostId ?? "",
  );
  const [featureRequestId, setFeatureRequestId] = useState(
    entry.featureRequestId ?? "",
  );
  const [shippedAt, setShippedAt] = useState(
    entry.shippedAt ? entry.shippedAt.slice(0, 10) : "",
  );
  const [isPublished, setIsPublished] = useState(entry.isPublished);
  const [pending, start] = useTransition();

  function save() {
    if (pending) return;
    if (title.trim().length < 2) {
      toast.error("Enter a title.");
      return;
    }
    start(async () => {
      try {
        await saveChangelogEntryAction({
          id: entry.id,
          slug: entry.slug,
          title: title.trim(),
          html,
          creditedHostId: creditedHostId || null,
          featureRequestId: featureRequestId || null,
          shippedAt: shippedAt || null,
          isPublished,
        });
        toast.success("Saved.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  function remove() {
    if (!confirm(`Delete "${entry.title}"? This cannot be undone.`)) return;
    start(async () => {
      try {
        await deleteChangelogEntryAction({ id: entry.id });
        toast.success("Deleted.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not delete.");
      }
    });
  }

  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ScrollText className="h-4 w-4 shrink-0 text-brand-primary" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-w-0 rounded-[8px] border border-transparent bg-transparent px-1 py-0.5 font-display text-base font-bold text-brand-ink outline-none hover:border-brand-line focus:border-brand-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          {isPublished ? (
            <span className="rounded-pill bg-emerald-100 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700">
              Published
            </span>
          ) : (
            <span className="rounded-pill bg-brand-light px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute">
              Draft
            </span>
          )}
          <a
            href={`/change-log#${entry.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-secondary hover:text-brand-primary"
          >
            /change-log
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="mt-4">
        <RichTextEditor
          value={html}
          onChange={setHtml}
          placeholder="What shipped, in plain language for hosts and guests…"
          disabled={pending}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-[12px] font-semibold text-brand-mute">
            Credit a host
          </label>
          <select
            value={creditedHostId}
            onChange={(e) => setCreditedHostId(e.target.value)}
            disabled={pending}
            className="mt-1 w-full rounded-[10px] border border-brand-line bg-white px-2 py-2 text-sm text-brand-ink"
          >
            <option value="">No credit</option>
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[12px] font-semibold text-brand-mute">
            Links to (shipped)
          </label>
          <select
            value={featureRequestId}
            onChange={(e) => setFeatureRequestId(e.target.value)}
            disabled={pending}
            className="mt-1 w-full rounded-[10px] border border-brand-line bg-white px-2 py-2 text-sm text-brand-ink"
          >
            <option value="">None</option>
            {shipped.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[12px] font-semibold text-brand-mute">
            Shipped date
          </label>
          <input
            type="date"
            value={shippedAt}
            onChange={(e) => setShippedAt(e.target.value)}
            disabled={pending}
            className="mt-1 w-full rounded-[10px] border border-brand-line bg-white px-2 py-2 text-sm text-brand-ink"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-[42px] items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-brand-ink">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            disabled={pending}
            className="h-4 w-4 accent-brand-primary"
          />
          Published (live on /change-log)
        </label>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="ml-auto inline-flex items-center gap-1 text-[13px] font-medium text-brand-mute hover:text-rose-600 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}
