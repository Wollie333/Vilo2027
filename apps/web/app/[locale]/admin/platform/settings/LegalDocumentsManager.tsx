"use client";

import {
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Save,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { modal } from "@/components/ui/modal-host";
import { COMPETITION_RULES_TEMPLATE_HTML } from "@/lib/legal/competitionRulesTemplate";
import type { LegalDocumentVersion } from "@/lib/legalDocuments";

import {
  restoreLegalDocumentVersionAction,
  saveLegalDocumentAction,
} from "./actions";

export type LegalDocInput = {
  slug: string;
  title: string;
  bodyHtml: string | null;
  version: number;
  isPublished: boolean;
};

export function LegalDocumentsManager({
  docs,
  versionsBySlug = {},
}: {
  docs: LegalDocInput[];
  versionsBySlug?: Record<string, LegalDocumentVersion[]>;
}) {
  return (
    <div className="space-y-6">
      <NewDocumentCard existingSlugs={docs.map((d) => d.slug)} />
      {docs.length === 0 ? (
        <p className="text-sm text-brand-mute">
          No documents yet. Create one above.
        </p>
      ) : (
        docs.map((doc) => (
          <DocumentCard
            key={doc.slug}
            doc={doc}
            versions={versionsBySlug[doc.slug] ?? []}
          />
        ))
      )}
    </div>
  );
}

function NewDocumentCard({ existingSlugs }: { existingSlugs: string[] }) {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [useTemplate, setUseTemplate] = useState(false);
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
        await saveLegalDocumentAction({
          slug: normalisedSlug,
          title: title.trim(),
          html: useTemplate ? COMPETITION_RULES_TEMPLATE_HTML : "",
          is_published: false,
        });
        toast.success(
          useTemplate
            ? "Document created from the CPA template — fill the [brackets] below, then publish."
            : "Document created — add its text below.",
        );
        setSlug("");
        setTitle("");
        setUseTemplate(false);
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
          New legal document
        </h3>
      </div>
      <p className="mt-1 text-sm text-brand-mute">
        Creates a page at{" "}
        <code className="rounded bg-white px-1 py-0.5 text-[12px]">
          /legal/{normalisedSlug || "your-slug"}
        </code>
        . Add the text after it&apos;s created, then publish.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[12px] font-semibold text-brand-mute">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Founding Race — Competition Rules"
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
            placeholder="founding-race-rules"
            className="mt-1 w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 font-mono text-[13px] text-brand-ink outline-none focus:border-brand-primary"
          />
          {slugTaken ? (
            <p className="mt-1 text-[11px] text-red-600">
              That slug is already in use.
            </p>
          ) : null}
        </div>
      </div>
      <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px] text-brand-ink">
        <input
          type="checkbox"
          checked={useTemplate}
          onChange={(e) => setUseTemplate(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-brand-primary"
        />
        <span>
          Start from the <strong>CPA competition-rules template</strong>
          <span className="block text-[11.5px] text-brand-mute">
            Pre-fills a Consumer Protection Act §36–compliant rules skeleton to
            fill in — for a competition&apos;s rules that you then bind on the
            campaign&apos;s Rules tab.
          </span>
        </span>
      </label>
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
        Create document
      </button>
    </div>
  );
}

function DocumentCard({
  doc,
  versions,
}: {
  doc: LegalDocInput;
  versions: LegalDocumentVersion[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(doc.title);
  const [html, setHtml] = useState(doc.bodyHtml ?? "");
  const [isPublished, setIsPublished] = useState(doc.isPublished);
  const [pending, start] = useTransition();
  const [viewing, setViewing] = useState<number | null>(null);

  async function restore(version: number) {
    if (pending) return;
    const ok = await modal.confirm({
      title: `Restore version ${version}?`,
      description:
        "This publishes its text as a new version — it doesn't overwrite history.",
      confirmLabel: "Restore",
    });
    if (!ok) return;
    start(async () => {
      try {
        const res = await restoreLegalDocumentVersionAction({
          slug: doc.slug,
          version,
        });
        toast.success(`Restored — now version ${res.version}`);
        setViewing(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not restore.");
      }
    });
  }

  const dirty =
    title.trim() !== doc.title.trim() ||
    html.trim() !== (doc.bodyHtml ?? "").trim() ||
    isPublished !== doc.isPublished;

  function save() {
    if (pending || !dirty) return;
    if (title.trim().length < 2) {
      toast.error("Enter a title.");
      return;
    }
    start(async () => {
      try {
        const res = await saveLegalDocumentAction({
          slug: doc.slug,
          title: title.trim(),
          html: html.trim(),
          is_published: isPublished,
        });
        toast.success(`Saved — now version ${res.version}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  return (
    <div
      id={`doc-${doc.slug}`}
      className="scroll-mt-24 rounded-card border border-brand-line bg-white p-5 shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-brand-primary" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-w-0 rounded-[8px] border border-transparent bg-transparent px-1 py-0.5 font-display text-base font-bold text-brand-ink outline-none hover:border-brand-line focus:border-brand-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-pill bg-brand-light px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-brand-mute">
            v{doc.version}
          </span>
          <a
            href={`/legal/${doc.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-secondary hover:text-brand-primary"
          >
            /legal/{doc.slug}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="mt-4">
        <RichTextEditor
          value={html}
          onChange={setHtml}
          placeholder="Paste the final legal text…"
          disabled={pending}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="inline-flex h-[42px] items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {pending ? "Publishing…" : "Publish"}
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-brand-ink">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="h-4 w-4 accent-brand-primary"
          />
          Published (live at{" "}
          <code className="rounded bg-brand-light px-1 text-[11px]">
            /legal/{doc.slug}
          </code>
          )
        </label>
        <span className="text-[11px] text-brand-mute">
          Publishing bumps the version when the text changes.
        </span>
      </div>

      {versions.length > 1 ? (
        <details className="mt-4 border-t border-brand-line pt-3">
          <summary className="cursor-pointer select-none text-[13px] font-semibold text-brand-mute">
            Version history ({versions.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {versions.map((v) => (
              <li key={v.version} className="text-[12.5px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-pill bg-brand-light px-2 py-0.5 font-semibold text-brand-ink">
                    v{v.version}
                  </span>
                  <span className="text-brand-mute">
                    {v.publishedAt ? v.publishedAt.slice(0, 10) : "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setViewing(viewing === v.version ? null : v.version)
                    }
                    className="font-medium text-brand-secondary hover:text-brand-primary"
                  >
                    {viewing === v.version ? "Hide" : "View"}
                  </button>
                  {v.version === doc.version ? (
                    <span className="text-brand-mute">· current</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => restore(v.version)}
                      disabled={pending}
                      className="inline-flex items-center gap-1 font-medium text-brand-primary hover:underline disabled:opacity-50"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restore
                    </button>
                  )}
                </div>
                {viewing === v.version ? (
                  <div
                    className="mt-2 max-h-[320px] overflow-y-auto rounded-card border border-brand-line bg-brand-light/40 p-3 text-[12.5px] leading-relaxed text-brand-mute [&_h2]:mt-3 [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-brand-ink [&_h3]:mt-2 [&_h3]:font-semibold [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_strong]:font-semibold [&_strong]:text-brand-ink [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5"
                    dangerouslySetInnerHTML={{
                      __html:
                        v.bodyHtml && v.bodyHtml.trim().length > 0
                          ? v.bodyHtml
                          : "<p><em>(no text)</em></p>",
                    }}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
