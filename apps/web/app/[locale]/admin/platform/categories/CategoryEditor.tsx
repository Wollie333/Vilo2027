"use client";

import { AlertCircle, CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useBrandName } from "@/components/brand/BrandProvider";
import type { CategoryKind, ListingCategoryRow } from "@/lib/taxonomy/types";

import { saveCategory } from "./actions";

const ICON_OPTIONS = [
  "home",
  "house",
  "building-2",
  "hotel",
  "tent",
  "coffee",
  "door-open",
  "utensils",
  "sparkles",
  "map",
  "mountain",
  "palette",
  "car",
  "more-horizontal",
];

type Initial = {
  id: string;
  parentId: string | null;
  kind: CategoryKind;
  slug: string;
  label: string;
  description: string;
  icon: string;
  sortOrder: number;
  isPublished: boolean;
  heroImageUrl: string;
  ogImageUrl: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  introMarkdown: string;
  faq: Array<{ q: string; a: string }>;
};

export function CategoryEditor({
  initial,
  isNew,
  parents,
}: {
  initial: Initial;
  isNew: boolean;
  parents: Array<Pick<ListingCategoryRow, "id" | "label" | "kind">>;
}) {
  const router = useRouter();
  const brandName = useBrandName();
  const [state, setState] = useState<Initial>(initial);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof Initial>(key: K, value: Initial[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    setSavedAt(null);
  }

  function updateFaq(index: number, key: "q" | "a", value: string) {
    setState((prev) => ({
      ...prev,
      faq: prev.faq.map((row, i) =>
        i === index ? { ...row, [key]: value } : row,
      ),
    }));
    setSavedAt(null);
  }

  function addFaqRow() {
    setState((prev) => ({ ...prev, faq: [...prev.faq, { q: "", a: "" }] }));
    setSavedAt(null);
  }

  function removeFaqRow(index: number) {
    setState((prev) => ({
      ...prev,
      faq: prev.faq.filter((_, i) => i !== index),
    }));
    setSavedAt(null);
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      const res = await saveCategory({
        id: isNew ? undefined : state.id,
        parentId: state.parentId,
        kind: state.kind,
        slug: state.slug || undefined,
        label: state.label,
        description: state.description || null,
        icon: state.icon,
        sortOrder: state.sortOrder,
        isPublished: state.isPublished,
        heroImageUrl: state.heroImageUrl || null,
        ogImageUrl: state.ogImageUrl || null,
        metaTitle: state.metaTitle || null,
        metaDescription: state.metaDescription || null,
        canonicalUrl: state.canonicalUrl || null,
        introMarkdown: state.introMarkdown || null,
        faq: state.faq.filter((r) => r.q.trim() && r.a.trim()),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSavedAt(Date.now());
      if (isNew) {
        router.push(`/admin/platform/categories/${res.id}`);
      } else {
        router.refresh();
      }
    });
  }

  const filteredParents = parents.filter(
    (p) => p.kind === state.kind && p.id !== state.id,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/admin/platform/categories"
            className="text-[12px] font-medium text-brand-mute hover:text-brand-ink"
          >
            ← Categories
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-brand-ink">
            {isNew ? "New category" : state.label || "Untitled"}
          </h1>
          {!isNew ? (
            <p className="mt-1 text-[13px] text-brand-mute">
              <span className="font-mono">/{state.slug}</span>
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
              placeholder="Villa"
              className="input"
            />
          </Field>
          <Field label="Slug">
            <input
              value={state.slug}
              onChange={(e) => update("slug", e.target.value)}
              placeholder="villa (auto-generated if blank)"
              className="input font-mono text-[12px]"
            />
          </Field>
          <Field label="Parent">
            <select
              value={state.parentId ?? ""}
              onChange={(e) => update("parentId", e.target.value || null)}
              className="input"
            >
              <option value="">— Top-level (root)</option>
              {filteredParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
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
              placeholder="Short tagline shown on the category chip and landing-page hero."
              className="input"
            />
          </Field>
          <Field label="Visibility">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.isPublished}
                onChange={(e) => update("isPublished", e.target.checked)}
                className="rounded border-brand-line"
              />
              Published — visible to hosts and on the public site
            </label>
          </Field>
        </div>
      </Section>

      <Section
        title="SEO & landing page"
        subtitle="Drives meta tags and structured data on /c/[slug]. Fill these to rank for category-level queries (e.g. 'villas in the Western Cape')."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Meta title">
            <input
              value={state.metaTitle}
              onChange={(e) => update("metaTitle", e.target.value)}
              placeholder={`Villas to rent in South Africa · ${brandName}`}
              className="input"
            />
          </Field>
          <Field label="Canonical URL">
            <input
              value={state.canonicalUrl}
              onChange={(e) => update("canonicalUrl", e.target.value)}
              placeholder="https://wieloplatform.com/c/villa"
              className="input"
            />
          </Field>
          <Field label="Meta description" full>
            <textarea
              value={state.metaDescription}
              onChange={(e) => update("metaDescription", e.target.value)}
              rows={2}
              placeholder="Direct-book private villas across South Africa. Pool, full kitchen, sleeps a crowd."
              className="input"
            />
          </Field>
          <Field label="Hero image URL">
            <input
              value={state.heroImageUrl}
              onChange={(e) => update("heroImageUrl", e.target.value)}
              placeholder="https://… (16:9 hero on /c/[slug])"
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
          <Field label="Intro (Markdown)" full>
            <textarea
              value={state.introMarkdown}
              onChange={(e) => update("introMarkdown", e.target.value)}
              rows={6}
              placeholder={
                "Rendered under the hero on the landing page. Supports **bold**, _italic_, links and lists."
              }
              className="input font-mono text-[12px]"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="FAQ"
        subtitle="Renders as an FAQPage JSON-LD block on /c/[slug] — Google can show these as rich results."
      >
        <div className="space-y-3">
          {state.faq.length === 0 ? (
            <p className="text-sm text-brand-mute">
              No FAQ items. Add a few common questions guests ask about this
              category.
            </p>
          ) : null}
          {state.faq.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 rounded-md border border-brand-line bg-brand-light/30 p-3 md:grid-cols-[1fr_auto]"
            >
              <div className="space-y-2">
                <input
                  value={row.q}
                  onChange={(e) => updateFaq(i, "q", e.target.value)}
                  placeholder="Question"
                  className="input font-medium"
                />
                <textarea
                  value={row.a}
                  onChange={(e) => updateFaq(i, "a", e.target.value)}
                  placeholder="Answer (1-3 short sentences)"
                  rows={2}
                  className="input"
                />
              </div>
              <button
                type="button"
                onClick={() => removeFaqRow(i)}
                className="inline-flex items-center gap-1 self-start rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
              >
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addFaqRow}
            className="inline-flex items-center gap-1.5 rounded border border-dashed border-brand-primary px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-accent/40"
          >
            <Plus className="h-4 w-4" /> Add FAQ
          </button>
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
