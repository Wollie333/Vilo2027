"use client";

import { AlertCircle, CheckCircle2, Save } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveDealCategory } from "./actions";

// Icon choices for deal categories (kept in sync with DealCategoriesTable).
const ICON_OPTIONS = [
  "Heart",
  "Users",
  "Clock",
  "PartyPopper",
  "Briefcase",
  "Sparkles",
  "Mountain",
  "Sun",
];

type Initial = {
  id: string;
  key: string;
  label: string;
  description: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  introMarkdown: string;
};

export function DealCategoryEditor({
  initial,
  isNew,
}: {
  initial: Initial;
  isNew: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<Initial>(initial);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof Initial>(key: K, value: Initial[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    setSavedAt(null);
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      const res = await saveDealCategory({
        id: isNew ? undefined : state.id,
        key: state.key || undefined,
        label: state.label,
        description: state.description || null,
        icon: state.icon,
        sortOrder: state.sortOrder,
        isActive: state.isActive,
        metaTitle: state.metaTitle || null,
        metaDescription: state.metaDescription || null,
        ogImageUrl: state.ogImageUrl || null,
        introMarkdown: state.introMarkdown || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSavedAt(Date.now());
      if (isNew) {
        router.push(`/admin/platform/deal-categories/${res.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/admin/platform/deal-categories"
            className="text-[12px] font-medium text-brand-mute hover:text-brand-ink"
          >
            ← Deal categories
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-brand-ink">
            {isNew ? "New deal category" : state.label || "Untitled"}
          </h1>
          {!isNew ? (
            <p className="mt-1 text-[13px] text-brand-mute">
              <span className="font-mono">{state.key}</span>
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {savedAt ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-status-confirmed">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
          ) : null}
          <button
            type="button"
            disabled={pending || !state.label.trim()}
            onClick={onSave}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-primary px-4 text-[13px] font-semibold text-white hover:bg-brand-secondary disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <Section title="Basic">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Label">
            <input
              value={state.label}
              onChange={(e) => update("label", e.target.value)}
              placeholder="Romantic getaway"
              className="input"
            />
          </Field>
          <Field label="Key">
            <input
              value={state.key}
              onChange={(e) => update("key", e.target.value)}
              placeholder="romantic (auto-generated if blank)"
              className="input font-mono text-[12px]"
            />
          </Field>
          <Field label="Icon">
            <select
              value={state.icon}
              onChange={(e) => update("icon", e.target.value)}
              className="input"
            >
              {ICON_OPTIONS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sort order">
            <input
              type="number"
              value={state.sortOrder}
              onChange={(e) => update("sortOrder", Number(e.target.value) || 0)}
              className="input font-mono"
            />
          </Field>
          <Field label="Description" full>
            <textarea
              value={state.description}
              onChange={(e) => update("description", e.target.value)}
              rows={2}
              placeholder="Short tagline shown to hosts when they pick this category and on the /deals filter."
              className="input"
            />
          </Field>
          <Field label="Visibility">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.isActive}
                onChange={(e) => update("isActive", e.target.checked)}
                className="rounded border-brand-line"
              />
              Active — hosts can assign it and it shows on the public /deals
              filter
            </label>
          </Field>
        </div>
      </Section>

      <Section
        title="SEO & landing"
        subtitle="Drives meta tags and structured data on the /deals filter for this category. Fill these to rank for deal-level queries (e.g. 'romantic getaway deals in South Africa')."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Meta title">
            <input
              value={state.metaTitle}
              onChange={(e) => update("metaTitle", e.target.value)}
              placeholder="Romantic getaway deals · Wielo"
              className="input"
            />
          </Field>
          <Field label="Open Graph image URL">
            <input
              value={state.ogImageUrl}
              onChange={(e) => update("ogImageUrl", e.target.value)}
              placeholder="https://… (1200×630 share card)"
              className="input"
            />
          </Field>
          <Field label="Meta description" full>
            <textarea
              value={state.metaDescription}
              onChange={(e) => update("metaDescription", e.target.value)}
              rows={2}
              placeholder="Direct-book romantic escapes across South Africa. Book straight with the host, no booking fees."
              className="input"
            />
          </Field>
          <Field label="Intro (Markdown)" full>
            <textarea
              value={state.introMarkdown}
              onChange={(e) => update("introMarkdown", e.target.value)}
              rows={6}
              placeholder={
                "Rendered above the filtered deals. Supports **bold**, _italic_, links and lists."
              }
              className="input font-mono text-[12px]"
            />
          </Field>
        </div>
      </Section>

      <style jsx global>{`
        .input {
          display: block;
          width: 100%;
          padding: 0.5rem 0.625rem;
          background: #fff;
          border: 1px solid var(--brand-line, #e5e7eb);
          border-radius: 0.375rem;
          font-size: 13.5px;
          color: var(--brand-ink, #111827);
        }
        .input:focus {
          outline: 2px solid transparent;
          outline-offset: 2px;
          border-color: var(--brand-primary, #1f2937);
        }
      `}</style>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-brand-line bg-white p-5">
      <div className="mb-4">
        <h2 className="font-display text-[15px] font-semibold text-brand-ink">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-[12.5px] text-brand-mute">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      {children}
    </label>
  );
}
