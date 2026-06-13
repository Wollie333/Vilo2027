"use client";

import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  CalendarClock,
  Car,
  ChevronDown,
  Flame,
  Footprints,
  Heart,
  LayoutTemplate,
  Layers,
  Megaphone,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  SearchX,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";

import { createDraftAddonAction, toggleAddonActiveAction } from "./actions";
import { AddonTemplatesModal } from "./AddonTemplatesModal";
import {
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
  listingCount: number;
};

type SortKey = "name" | "price_asc" | "price_desc" | "status";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name (A–Z)" },
  { value: "price_asc", label: "Price (low → high)" },
  { value: "price_desc", label: "Price (high → low)" },
  { value: "status", label: "Status" },
];

// Per-category icon for the filter chips (mirrors the guest extras list).
const CATEGORY_ICON: Record<AddonCategory, LucideIcon> = {
  food_drink: Utensils,
  comfort: Flame,
  experiences: Footprints,
  transport: Car,
  romance: Heart,
  flexibility: CalendarClock,
};

export function AddonsArchive({ initial }: { initial: AddonCard[] }) {
  const router = useRouter();
  const [isCreating, startCreate] = useTransition();
  const [cards, setCards] = useState<AddonCard[]>(initial);
  const [category, setCategory] = useState<AddonCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // ---- stats ----
  const activeCount = useMemo(
    () => cards.filter((a) => a.isActive).length,
    [cards],
  );
  const draftCount = cards.length - activeCount;
  const categoryCount = useMemo(
    () =>
      new Set(
        cards
          .map((a) => a.category)
          .filter((c): c is AddonCategory => c !== null),
      ).size,
    [cards],
  );
  const currency = cards[0]?.currency ?? "ZAR";
  const priceRange = useMemo(() => {
    if (cards.length === 0) return null;
    const prices = cards.map((a) => a.unitPrice);
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    return lo === hi
      ? formatMoney(lo, currency)
      : `${formatMoney(lo, currency)} – ${formatMoney(hi, currency)}`;
  }, [cards, currency]);

  // ---- which category tabs to show (only ones in use), with counts ----
  const usedCategories = useMemo(() => {
    const counts = new Map<AddonCategory, number>();
    for (const a of cards) {
      if (a.category) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    }
    return (Object.keys(ADDON_CATEGORY_LABEL) as AddonCategory[])
      .filter((c) => counts.has(c))
      .map((c) => ({
        value: c,
        label: ADDON_CATEGORY_LABEL[c],
        count: counts.get(c) ?? 0,
      }));
  }, [cards]);

  // ---- filter + search + sort ----
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = cards.filter((a) => {
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
  }, [cards, category, query, sort]);

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

  const handleToggle = async (id: string, next: boolean) => {
    // Optimistic — flip locally, revert on failure.
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isActive: next } : c)),
    );
    const result = await toggleAddonActiveAction(id, next);
    if (!result.ok) {
      setCards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isActive: !next } : c)),
      );
      toast.error(result.error);
    }
  };

  const showGhost = category === "all" && query.trim() === "";

  return (
    <div className="space-y-6">
      {/* ============ HEADER ============ */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="font-display text-[24px] font-bold tracking-tight text-brand-ink">
            Add-ons
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-mute">
            Optional extras guests can add to any booking — breakfast baskets,
            firewood, guided hikes and more. Build them once, offer them
            everywhere.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTemplatesOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 text-[13px] font-medium text-brand-ink transition hover:bg-brand-light"
          >
            <LayoutTemplate className="h-4 w-4 text-brand-primary" /> Templates
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating}
            className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {isCreating ? "Creating…" : "New add-on"}
          </button>
        </div>
      </div>

      {initial.length === 0 ? (
        <EmptyArchive
          cta={
            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating}
              className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {isCreating ? "Creating…" : "New add-on"}
            </button>
          }
        />
      ) : (
        <>
          {/* ============ STAT BAND ============ */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-brand-line bg-brand-line sm:grid-cols-4">
            <StatCell
              label="Active"
              value={String(activeCount)}
              hint="Live to guests"
              hintClass="text-status-confirmed"
            />
            <StatCell
              label="Drafts"
              value={String(draftCount)}
              hint="Hidden from guests"
            />
            <StatCell
              label="Categories"
              value={String(categoryCount)}
              hint="In use"
            />
            <div className="bg-brand-secondary p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                Range
              </div>
              <div className="mt-1.5 font-display text-[18px] font-bold leading-none text-white">
                {priceRange ?? "—"}
              </div>
              <div className="mt-1 text-[11px] text-brand-accent">
                Per add-on
              </div>
            </div>
          </div>

          {/* ============ FILTER + SORT ============ */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className="flex items-center gap-2 overflow-x-auto"
              style={{ scrollbarWidth: "none" }}
            >
              <CategoryChip
                active={category === "all"}
                label="All"
                count={cards.length}
                onClick={() => setCategory("all")}
              />
              {usedCategories.map((c) => (
                <CategoryChip
                  key={c.value}
                  active={category === c.value}
                  label={c.label}
                  count={c.count}
                  icon={CATEGORY_ICON[c.value]}
                  onClick={() => setCategory(c.value)}
                />
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="flex h-9 items-center gap-2 rounded-pill border border-brand-line bg-white px-3">
                <Search className="h-4 w-4 shrink-0 text-brand-mute" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search add-ons…"
                  className="w-full bg-transparent text-[13px] text-brand-ink outline-none placeholder:text-brand-mute lg:w-40"
                />
              </div>
              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="h-9 appearance-none rounded-pill border border-brand-line bg-white pl-3.5 pr-9 text-[12.5px] font-medium text-brand-ink outline-none transition hover:bg-brand-light"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-mute" />
              </div>
            </div>
          </div>

          {/* ============ GRID ============ */}
          {visible.length === 0 ? (
            <EmptyFiltered />
          ) : (
            <div className="grid gap-3.5 lg:grid-cols-2">
              {visible.map((a) => (
                <AddonGridCard key={a.id} addon={a} onToggle={handleToggle} />
              ))}
              {showGhost ? (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="flex items-center gap-3.5 rounded-[14px] border border-dashed border-brand-line bg-[#FAFCFB] p-3.5 text-left transition hover:border-brand-primary/50 disabled:opacity-60"
                >
                  <span className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[11px] bg-brand-accent text-brand-secondary">
                    <Plus className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-[14px] font-semibold text-brand-ink">
                      Create an add-on
                    </span>
                    <span className="block text-[11.5px] text-brand-mute">
                      Build from scratch or start from a template.
                    </span>
                  </span>
                </button>
              ) : null}
            </div>
          )}
        </>
      )}

      <AddonTemplatesModal
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
      />
    </div>
  );
}

function StatCell({
  label,
  value,
  hint,
  hintClass,
}: {
  label: string;
  value: string;
  hint: string;
  hintClass?: string;
}) {
  return (
    <div className="bg-[#FAFCFB] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div className="mt-1.5 font-display text-[22px] font-bold leading-none text-brand-ink">
        {value}
      </div>
      <div className={`mt-1 text-[11px] ${hintClass ?? "text-brand-mute"}`}>
        {hint}
      </div>
    </div>
  );
}

function CategoryChip({
  active,
  label,
  count,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  icon?: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold transition ${
        active
          ? "border-brand-accent bg-brand-accent text-brand-secondary"
          : "border-brand-line bg-white text-brand-mute hover:bg-[#F4F8F5] hover:text-brand-ink"
      }`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
      <span
        className={`rounded-pill px-1.5 text-[11px] tabular-nums ${
          active
            ? "bg-white text-brand-secondary"
            : "bg-brand-light text-brand-mute"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function AddonGridCard({
  addon: a,
  onToggle,
}: {
  addon: AddonCard;
  onToggle: (id: string, next: boolean) => void;
}) {
  const suffix = PRICING_MODEL_META[a.pricingModel].suffix;
  const scope =
    a.listingCount === 0
      ? "Not offered"
      : `${a.listingCount} listing${a.listingCount === 1 ? "" : "s"}`;
  return (
    <article
      className={`flex flex-col overflow-hidden rounded-[14px] border border-brand-line bg-white shadow-card transition hover:border-brand-primary/30 hover:shadow-lift ${
        a.isActive ? "" : "opacity-[0.92]"
      }`}
    >
      <div className="flex gap-3.5 p-3.5">
        <Link
          href={`/dashboard/addons/${a.id}`}
          className="relative h-[94px] w-[94px] shrink-0 overflow-hidden rounded-[11px] bg-brand-accent/40"
        >
          {a.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={a.imageUrl}
              alt={a.name}
              className={`h-full w-full object-cover ${
                a.isActive ? "" : "opacity-70 grayscale-[0.4]"
              }`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-brand-secondary/50">
              <PackagePlus className="h-7 w-7" />
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/dashboard/addons/${a.id}`}
              className="font-display text-[14.5px] font-bold leading-snug text-brand-ink hover:text-brand-secondary"
            >
              {a.name}
            </Link>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-[11.5px] font-semibold ${
                a.isActive
                  ? "border-[#C7F0DC] bg-[#ECFDF5] text-[#047857]"
                  : "border-brand-line bg-[#F4F7F5] text-[#5B7065]"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  a.isActive ? "bg-brand-primary" : "bg-status-draft"
                }`}
              />
              {a.isActive ? "Active" : "Draft"}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-brand-mute">
            {a.description ?? "No description yet."}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-display text-[16px] font-bold text-brand-ink">
                {formatMoney(a.unitPrice, a.currency)}
              </span>
              <span className="text-[11px] text-brand-mute"> {suffix}</span>
            </div>
            {a.category ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-brand-light px-2.5 py-1 text-[10.5px] font-medium text-brand-secondary">
                {ADDON_CATEGORY_LABEL[a.category]}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-brand-line px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-3 text-[11px] text-brand-mute">
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <Layers className="h-3.5 w-3.5" /> {scope}
          </span>
          <span className="hidden items-center gap-1 whitespace-nowrap sm:inline-flex">
            <Megaphone className="h-3.5 w-3.5" /> Checkout
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            role="switch"
            aria-checked={a.isActive}
            aria-label="Toggle active"
            title={
              a.isActive
                ? "Active — click to draft"
                : "Draft — click to activate"
            }
            onClick={() => onToggle(a.id, !a.isActive)}
            className={`relative h-[21px] w-[36px] shrink-0 rounded-pill transition-colors ${
              a.isActive ? "bg-brand-primary" : "bg-[#D9E7DF]"
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-[17px] w-[17px] rounded-full bg-white shadow transition-transform ${
                a.isActive ? "translate-x-[15px]" : "translate-x-0"
              }`}
            />
          </button>
          <Link
            href={`/dashboard/addons/${a.id}`}
            title="Edit"
            className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-brand-line bg-white text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
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
