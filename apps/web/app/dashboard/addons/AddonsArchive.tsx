"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  LayoutTemplate,
  PackagePlus,
  Plus,
  Search,
  SearchX,
} from "lucide-react";
import { toast } from "sonner";

import { createDraftAddonAction } from "./actions";
import {
  ADDON_CATEGORIES,
  ADDON_CATEGORY_LABEL,
  PRICING_MODEL_META,
  type AddonCategory,
  type PricingModel,
} from "./schemas";

export type AddonCard = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  pricingModel: PricingModel;
  unitPrice: number;
  currency: string;
  minQuantity: number;
  maxQuantity: number | null;
  isRequired: boolean;
  isActive: boolean;
  leadTimeDays: number;
  category: AddonCategory | null;
  vatIncluded: boolean;
  dailyCapacity: number | null;
};

type SortKey = "name" | "price_asc" | "price_desc" | "status";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Sort: Name" },
  { value: "price_asc", label: "Sort: Price ↑" },
  { value: "price_desc", label: "Sort: Price ↓" },
  { value: "status", label: "Sort: Status" },
];

const fmtR = (n: number, c: string) =>
  `${c === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;

export function AddonsArchive({ initial }: { initial: AddonCard[] }) {
  const router = useRouter();
  const [isCreating, startCreate] = useTransition();
  const [category, setCategory] = useState<AddonCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");

  // ---- stats ----
  const activeCount = useMemo(
    () => initial.filter((a) => a.isActive).length,
    [initial],
  );
  const draftCount = initial.length - activeCount;
  const categoryCount = useMemo(
    () =>
      new Set(
        initial
          .map((a) => a.category)
          .filter((c): c is AddonCategory => c !== null),
      ).size,
    [initial],
  );

  // ---- which category tabs to show (only ones in use), with counts ----
  const usedCategories = useMemo(() => {
    const counts = new Map<AddonCategory, number>();
    for (const a of initial) {
      if (a.category) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    }
    return ADDON_CATEGORIES.filter((c) =>
      counts.has(c.value as AddonCategory),
    ).map((c) => ({
      value: c.value as AddonCategory,
      label: c.label,
      count: counts.get(c.value as AddonCategory) ?? 0,
    }));
  }, [initial]);

  // ---- filter + search + sort ----
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = initial.filter((a) => {
      const matchCat = category === "all" || a.category === category;
      const matchQ =
        !q ||
        a.name.toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q);
      return matchCat && matchQ;
    });

    const sorted = [...filtered];
    switch (sort) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "price_asc":
        sorted.sort((a, b) => a.unitPrice - b.unitPrice);
        break;
      case "price_desc":
        sorted.sort((a, b) => b.unitPrice - a.unitPrice);
        break;
      case "status":
        sorted.sort(
          (a, b) =>
            Number(b.isActive) - Number(a.isActive) ||
            a.name.localeCompare(b.name),
        );
        break;
    }
    return sorted;
  }, [initial, category, query, sort]);

  const handleCreate = () => {
    startCreate(async () => {
      const result = await createDraftAddonAction();
      if (result.ok && result.data) {
        router.push(`/dashboard/addons/${result.data.id}`);
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  };

  const newAddonBtn = (
    <button
      type="button"
      onClick={handleCreate}
      disabled={isCreating}
      className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-lift transition hover:bg-brand-secondary disabled:opacity-60"
    >
      <Plus className="h-4 w-4" />
      {isCreating ? "Creating…" : "New add-on"}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* ============ PAGE HEADER ============ */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            Add-ons
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-brand-mute">
            Optional extras guests can add to any booking — breakfast baskets,
            firewood, guided hikes and more. Build them once, offer them
            everywhere.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3.5 py-2 text-[12.5px] font-medium text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
          >
            <LayoutTemplate className="h-4 w-4" />
            Browse templates
          </button>
          {newAddonBtn}
        </div>
      </header>

      {/* ============ STAT CARDS ============ */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Active" value={activeCount} hint="live to guests" />
        <StatCard label="Drafts" value={draftCount} hint="hidden" />
        <StatCard label="Categories" value={categoryCount} hint="in use" />
      </div>

      {initial.length === 0 ? (
        <EmptyArchive cta={newAddonBtn} />
      ) : (
        <>
          {/* ============ FILTER BAR ============ */}
          <section className="rounded-card border border-brand-line bg-white shadow-card">
            <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
              {/* category tabs */}
              <div className="hscroll -mx-1 flex items-center gap-1.5 overflow-x-auto px-1">
                <CategoryTab
                  active={category === "all"}
                  label="All"
                  count={initial.length}
                  onClick={() => setCategory("all")}
                />
                {usedCategories.map((c) => (
                  <CategoryTab
                    key={c.value}
                    active={category === c.value}
                    label={c.label}
                    count={c.count}
                    onClick={() => setCategory(c.value)}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2 lg:ml-auto">
                {/* search */}
                <div className="flex flex-1 items-center gap-2 rounded-pill border border-brand-line bg-white px-3 py-2 lg:flex-none">
                  <Search className="h-4 w-4 shrink-0 text-brand-mute" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search add-ons…"
                    className="w-full bg-transparent text-[13px] text-brand-ink outline-none placeholder:text-brand-mute lg:w-44"
                  />
                </div>

                {/* sort */}
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="shrink-0 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12.5px] font-medium text-brand-ink outline-none transition hover:bg-brand-light"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* ============ GRID ============ */}
          {visible.length === 0 ? (
            <EmptyFiltered />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((a) => (
                <AddonGridCard key={a.id} addon={a} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-bold text-brand-ink">
        {value}
      </div>
      <div className="text-[11px] text-brand-mute">{hint}</div>
    </div>
  );
}

function CategoryTab({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-pill px-3 py-1.5 text-[12.5px] transition ${
        active
          ? "bg-brand-accent font-semibold text-brand-secondary"
          : "border border-brand-line font-medium text-brand-mute hover:bg-brand-light hover:text-brand-ink"
      }`}
    >
      {label}
      <span
        className={`rounded-pill px-1.5 text-[10px] ${
          active
            ? "bg-white/70 text-brand-secondary"
            : "bg-brand-line text-brand-mute"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function AddonGridCard({ addon: a }: { addon: AddonCard }) {
  const suffix = PRICING_MODEL_META[a.pricingModel].suffix;
  return (
    <Link
      href={`/dashboard/addons/${a.id}`}
      className={`group flex flex-col overflow-hidden rounded-card border bg-white shadow-card transition hover:shadow-lift ${
        a.isActive ? "border-brand-line" : "border-dashed border-brand-line"
      }`}
    >
      {/* image */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-brand-accent/40">
        {a.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.imageUrl}
            alt={a.name}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-brand-secondary/50">
            <PackagePlus className="h-8 w-8" />
          </div>
        )}
        {/* status pill */}
        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[10.5px] font-semibold ${
            a.isActive
              ? "bg-green-100 text-green-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              a.isActive ? "bg-green-500" : "bg-slate-400"
            }`}
          />
          {a.isActive ? "Active" : "Draft"}
        </span>
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate font-display text-[16px] font-bold text-brand-ink">
          {a.name}
        </h3>
        <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-[12.5px] leading-relaxed text-brand-mute">
          {a.description ?? "No description yet."}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-brand-line pt-3">
          <div className="min-w-0">
            <span className="font-display text-[20px] font-bold text-brand-ink">
              {fmtR(a.unitPrice, a.currency)}
            </span>
            <span className="text-[11.5px] text-brand-mute"> {suffix}</span>
          </div>
          {a.category ? (
            <span className="shrink-0 rounded-pill bg-brand-light px-2.5 py-1 text-[10.5px] font-medium text-brand-secondary">
              {ADDON_CATEGORY_LABEL[a.category]}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function EmptyArchive({ cta }: { cta: React.ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-brand-line bg-white py-16 text-center shadow-card">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent text-brand-secondary">
        <PackagePlus className="h-6 w-6" />
      </div>
      <h2 className="mt-3 font-display text-[16px] font-bold text-brand-ink">
        No add-ons yet — create your first
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-brand-mute">
        Optional extras like breakfast, transfers or activities. Build one once
        and offer it on every listing.
      </p>
      <div className="mt-5 flex justify-center">{cta}</div>
    </div>
  );
}

function EmptyFiltered() {
  return (
    <div className="rounded-card border border-dashed border-brand-line bg-white py-16 text-center shadow-card">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand-mute">
        <SearchX className="h-6 w-6" />
      </div>
      <h2 className="mt-3 font-display text-[15px] font-bold text-brand-ink">
        No add-ons match
      </h2>
      <p className="mt-1 text-[12.5px] text-brand-mute">
        Try a different category or clear your search.
      </p>
    </div>
  );
}
