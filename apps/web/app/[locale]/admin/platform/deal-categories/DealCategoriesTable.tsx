"use client";

import {
  AlertCircle,
  Briefcase,
  Clock,
  ExternalLink,
  Heart,
  Mountain,
  PartyPopper,
  Pencil,
  Search,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useMemo, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { modal } from "@/components/ui/modal-host";

import { deleteDealCategory } from "./actions";

export type DealCategoryRow = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  meta_title: string | null;
  meta_description: string | null;
};

const ICON_MAP: Record<string, LucideIcon> = {
  Heart,
  Users,
  Clock,
  PartyPopper,
  Briefcase,
  Sparkles,
  Mountain,
  Sun,
};

function resolveIcon(name: string | null): LucideIcon {
  return (name && ICON_MAP[name]) || Sparkles;
}

export function DealCategoriesTable({ rows }: { rows: DealCategoryRow[] }) {
  const [list, setList] = useState<DealCategoryRow[]>(rows);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = [...list].sort((a, b) => a.sort_order - b.sort_order);
    if (!q) return base;
    return base.filter(
      (r) =>
        r.label.toLowerCase().includes(q) || r.key.toLowerCase().includes(q),
    );
  }, [list, query]);

  async function removeRow(row: DealCategoryRow) {
    const reason = await modal.prompt({
      title: `Delete "${row.label}"?`,
      description:
        "This removes the deal category from the /deals filter and the host picker.",
      label: "Reason (recorded in the audit log)",
      placeholder: "Why are you deleting this?",
      minLength: 5,
      confirmLabel: "Delete category",
      intent: "destructive",
    });
    if (!reason) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteDealCategory({ id: row.id, reason });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setList((prev) => prev.filter((r) => r.id !== row.id));
    });
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deal categories by label or key…"
            className="pl-9"
          />
        </div>
        <div className="text-[12px] text-brand-mute">
          <span className="num font-semibold text-brand-ink">
            {filtered.length}
          </span>
          {query ? ` of ${list.length}` : ""} categor
          {list.length === 1 ? "y" : "ies"}
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-line bg-brand-light/40 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-accent text-brand-secondary">
              <Tag className="h-4.5 w-4.5" />
            </span>
            <div>
              <div className="font-display text-[15px] font-semibold text-brand-ink">
                Deal categories
              </div>
              <div className="text-[11.5px] text-brand-mute">
                {list.length} categor{list.length === 1 ? "y" : "ies"} hosts can
                assign to specials
              </div>
            </div>
          </div>
        </header>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-brand-mute">
            {query ? "No matches." : "No deal categories yet."}
          </div>
        ) : (
          <div className="divide-y divide-brand-line">
            {filtered.map((row) => {
              const Icon = resolveIcon(row.icon);
              return (
                <div
                  key={row.id}
                  className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-brand-light/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent/60 text-brand-secondary">
                    <Icon className="h-4.5 w-4.5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-medium text-brand-ink">
                        {row.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-brand-mute">
                      <span className="font-mono">{row.key}</span>
                      <span className="num">sort {row.sort_order}</span>
                      {row.meta_title ? (
                        <span className="hidden truncate sm:inline-block sm:max-w-[18ch]">
                          SEO: {row.meta_title}
                        </span>
                      ) : (
                        <span className="hidden italic sm:inline">
                          SEO auto from label
                        </span>
                      )}
                    </div>
                    {row.description ? (
                      <div className="mt-0.5 line-clamp-1 text-[11.5px] text-brand-mute">
                        {row.description}
                      </div>
                    ) : null}
                  </div>

                  {row.is_active ? (
                    <span className="hidden items-center gap-1 rounded-pill bg-status-confirmed/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-status-confirmed sm:inline-flex">
                      <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed" />
                      Active
                    </span>
                  ) : (
                    <span className="hidden items-center rounded-pill bg-brand-line/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-mute sm:inline-flex">
                      Hidden
                    </span>
                  )}

                  <div className="flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                    {row.is_active ? (
                      <Link
                        href={`/deals?category=${row.key}`}
                        target="_blank"
                        className="rounded-md border border-brand-line bg-white p-1.5 text-brand-mute hover:bg-brand-light hover:text-brand-ink"
                        aria-label={`Preview /deals for ${row.label}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                    <Link
                      href={`/admin/platform/deal-categories/${row.id}`}
                      className="rounded-md bg-brand-primary px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-secondary"
                    >
                      <Pencil className="inline h-3.5 w-3.5" />
                      <span className="ml-1 hidden sm:inline">Edit</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeRow(row)}
                      disabled={pending}
                      className="rounded-md border border-red-100 bg-red-50 p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-50"
                      aria-label={`Delete ${row.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
