"use client";

import {
  ArrowDownAZ,
  ArrowRight,
  ArrowUpDown,
  Banknote,
  BedDouble,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  GitBranch,
  Home as HomeIcon,
  Mail,
  Menu,
  Rows3,
  Search,
  Star,
  Tag as TagIcon,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { modal } from "@/components/ui/modal-host";
import { formatMoney } from "@/lib/format";

import { AcceptedQuotePill } from "@/app/dashboard/_components/AcceptedQuotePill";

import { AddGuestModal } from "./AddGuestModal";
import { BroadcastModal } from "./BroadcastModal";
import { bulkTagAction, exportGuestsAction } from "./actions";

// ── Types (shape of the fetch_host_guests / _summary RPC json) ──────────
export type GuestRow = {
  gkey: string;
  guest_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  country: string | null;
  guest_since: string | null;
  channel: string | null;
  last_status: string | null;
  total_stays: number;
  total_nights: number;
  total_bookings: number;
  lifetime_value: number;
  direct_value: number;
  est_fees_saved: number;
  currency: string;
  first_stay: string | null;
  last_stay: string | null;
  next_stay: string | null;
  next_listing: string | null;
  avg_rating: number | null;
  review_count: number;
  is_vip: boolean;
  is_returning: boolean;
  is_new: boolean;
  is_ota: boolean;
  is_inhouse: boolean;
  is_lapsed: boolean;
  is_all_direct: boolean;
  is_verified: boolean;
  is_blocked: boolean;
  has_email: boolean;
  has_phone: boolean;
  tags: string[];
};

export type GuestSummary = {
  total_guests: number;
  total_count: number;
  new_last_30: number;
  returning_count: number;
  repeat_rate: number | null;
  avg_ltv: number;
  total_ltv: number;
  direct_value: number;
  est_fees_saved: number;
  avg_rating: number | null;
  review_count: number;
  staying_this_month: number;
  arriving_soon: number;
  missing_contact_count: number;
  tab_counts: {
    all: number;
    vip: number;
    returning: number;
    new: number;
    ota: number;
    lapsed: number;
  };
};

const SEG_TABS = [
  { key: "all", label: "All guests" },
  { key: "vip", label: "VIP" },
  { key: "returning", label: "Returning" },
  { key: "new", label: "New" },
  { key: "ota", label: "Via OTA" },
  { key: "lapsed", label: "Lapsed" },
] as const;

const SORTS = [
  { key: "recent", label: "Recently active", icon: Clock },
  { key: "value", label: "Lifetime value", icon: Banknote },
  { key: "stays", label: "Most stays", icon: BedDouble },
  { key: "name", label: "Name: A → Z", icon: ArrowDownAZ },
] as const;

const CHANNELS = [
  { key: "", label: "All channels" },
  { key: "direct", label: "Direct" },
  { key: "airbnb", label: "Airbnb" },
  { key: "booking", label: "Booking.com" },
  { key: "expedia", label: "Expedia" },
  { key: "other", label: "Other" },
];

const RATINGS = [
  { key: "", label: "Any rating" },
  { key: "4.5", label: "4.5+ ★" },
  { key: "4", label: "4+ ★" },
  { key: "3", label: "3+ ★" },
];

const GRID =
  "grid-cols-[34px_minmax(0,2.3fr)_1.1fr_64px_1fr_84px_minmax(0,1.3fr)_56px]";

// Deterministic pastel avatar colour hashed from the gkey (enhancement #4).
const AV_PALETTE = [
  "bg-brand-secondary text-white",
  "bg-brand-accent text-brand-secondary",
  "bg-brand-dark text-white",
  "bg-brand-mute text-white",
  "bg-amber-100 text-amber-800",
  "bg-indigo-100 text-indigo-700",
  "bg-sky-100 text-sky-700",
];
function avatarClass(gkey: string): string {
  let h = 0;
  for (let i = 0; i < gkey.length; i++) h = (h * 31 + gkey.charCodeAt(i)) | 0;
  return AV_PALETTE[Math.abs(h) % AV_PALETTE.length];
}
function initials(name: string | null): string {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "·";
}

const CANCELLED = new Set([
  "cancelled_by_host",
  "cancelled_by_guest",
  "declined",
  "expired",
  "no_show",
]);

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

function segMeta(g: GuestRow): { label: string; cls: string; bar: string } {
  if (g.is_vip)
    return {
      label: "VIP",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      bar: "bg-brand-primary",
    };
  if (g.is_returning)
    return {
      label: "Returning",
      cls: "bg-indigo-50 text-indigo-600 border-indigo-200",
      bar: "bg-status-completed",
    };
  if (g.is_ota)
    return {
      label: "Via OTA",
      cls: "bg-slate-50 text-slate-500 border-slate-200",
      bar: "bg-status-draft",
    };
  return {
    label: "New",
    cls: "bg-sky-50 text-sky-600 border-sky-200",
    bar: "bg-status-inhouse",
  };
}

function download(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type AcceptedQuoteLite = {
  id: string;
  amount: number;
  currency: string;
};

export function GuestsBoard({
  summary,
  guests,
  acceptedQuotes,
  totalCount,
  listings,
  seg,
  sort,
  q,
  listingId,
  channel,
  rating,
  page,
  pageSize,
}: {
  summary: GuestSummary | null;
  guests: GuestRow[];
  /** gkey → accepted-but-not-converted quote, drives the pulsing list pill. */
  acceptedQuotes: Record<string, AcceptedQuoteLite>;
  totalCount: number;
  listings: { id: string; name: string }[];
  seg: string;
  sort: string;
  q: string;
  listingId: string;
  channel: string;
  rating: string;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // URL is the source of truth for seg/sort/q/filters/page (server re-queries).
  const navigate = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  // Client-only state: density, search box (debounced into URL), selection.
  const [density, setDensity] = useState<"comfortable" | "compact">(
    "comfortable",
  );
  const [sortOpen, setSortOpen] = useState(false);
  const [search, setSearch] = useState(q);
  const [addOpen, setAddOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => setSearch(q), [q]);
  // Selection is per result set — reset when the visible rows change.
  useEffect(() => setSelected(new Set()), [guests]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (search !== q) navigate({ q: search || null, page: null });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const counts = summary?.tab_counts;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const showingFrom = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, totalCount);
  const currency = guests[0]?.currency ?? "ZAR";

  const toggle = (gkey: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(gkey)) next.delete(gkey);
      else next.add(gkey);
      return next;
    });
  const allOnPage =
    guests.length > 0 && guests.every((g) => selected.has(g.gkey));
  const toggleAll = () =>
    setSelected(allOnPage ? new Set() : new Set(guests.map((g) => g.gkey)));

  async function runExport(gkeys?: string[]) {
    setBusy(true);
    const res = await exportGuestsAction({
      seg,
      q,
      listingId,
      channel,
      minRating: rating ? Number.parseFloat(rating) : undefined,
      gkeys,
    });
    setBusy(false);
    if (!res.ok) {
      void modal.error({ title: "Export failed", description: res.error });
      return;
    }
    download(res.data!.filename, res.data!.csv, "text/csv;charset=utf-8");
  }

  async function runBulkTag(label: string) {
    setTagOpen(false);
    setBusy(true);
    const res = await bulkTagAction([...selected], label);
    setBusy(false);
    if (!res.ok) {
      void modal.error({ title: "Couldn't tag", description: res.error });
      return;
    }
    setSelected(new Set());
    void modal.success({
      title: "Tagged",
      description: `Added “${label}” to ${res.data!.tagged} guest${res.data!.tagged === 1 ? "" : "s"}.`,
    });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 lg:px-6">
      {/* ── Page header ── */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-tight text-brand-ink">
            Guests
          </h1>
          <p className="mt-1 text-[13.5px] text-brand-mute">
            <span className="font-semibold text-brand-ink">
              {summary?.total_guests ?? 0}
            </span>{" "}
            all-time ·{" "}
            <span className="font-semibold text-brand-primary">
              {counts?.vip ?? 0}
            </span>{" "}
            VIP ·{" "}
            <span className="font-semibold text-brand-ink">
              {summary?.staying_this_month ?? 0}
            </span>{" "}
            staying this month
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMailOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
          >
            <Mail className="h-4 w-4 text-brand-mute" /> Email guests
          </button>
          <button
            onClick={() => void runExport()}
            disabled={busy || totalCount === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3.5 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-brand-mute" /> Export
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-brand-primary px-5 text-[13.5px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary"
          >
            <UserPlus className="h-4 w-4" /> Add guest
          </button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Total guests"
          value={String(summary?.total_guests ?? 0)}
          chip={
            summary && summary.new_last_30 > 0
              ? { text: `+${summary.new_last_30}`, tone: "good" }
              : undefined
          }
          sub={
            summary && summary.missing_contact_count > 0
              ? `${summary.missing_contact_count} missing contact details`
              : "across all listings"
          }
        />
        <KpiCard
          label="Repeat-guest rate"
          value={`${summary?.repeat_rate ?? 0}%`}
          sub={`${summary?.returning_count ?? 0} returning guests`}
        />
        <KpiCard
          label="Avg lifetime value"
          value={formatMoney(summary?.avg_ltv ?? 0, currency)}
          sub={`${formatMoney(summary?.total_ltv ?? 0, currency)} all-time`}
        />
        <KpiCard
          label="Direct revenue"
          value={formatMoney(summary?.direct_value ?? 0, currency)}
          chip={
            summary && summary.est_fees_saved > 0
              ? { text: "Pillar", tone: "good" }
              : undefined
          }
          sub={`~${formatMoney(summary?.est_fees_saved ?? 0, currency)} saved in OTA fees`}
        />
        <KpiCard
          label="Avg rating left"
          value={summary?.avg_rating ? `${summary.avg_rating} / 5` : "—"}
          chip={
            summary?.avg_rating
              ? { text: String(summary.avg_rating), tone: "star" }
              : undefined
          }
          sub={`from ${summary?.review_count ?? 0} reviews`}
        />
      </section>

      {/* ── Table card ── */}
      <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        {/* segment tabs */}
        <div
          className="flex items-stretch gap-1 overflow-x-auto border-b border-brand-line px-4"
          style={{ scrollbarWidth: "none" }}
        >
          {SEG_TABS.map((t) => {
            const active = seg === t.key;
            const c = counts?.[t.key as keyof typeof counts];
            return (
              <button
                key={t.key}
                onClick={() => navigate({ seg: t.key, page: null })}
                className={`relative flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-[13px] font-semibold transition-colors ${
                  active
                    ? "text-brand-secondary"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                {t.label}
                {c !== undefined ? (
                  <span
                    className={`rounded-pill border px-1.5 py-px text-[10.5px] tabular-nums ${
                      active
                        ? "border-brand-accent bg-brand-accent text-brand-secondary"
                        : "border-brand-line bg-brand-light text-brand-mute"
                    }`}
                  >
                    {c}
                  </span>
                ) : null}
                {active ? (
                  <span className="absolute inset-x-2 -bottom-px h-[2.5px] rounded bg-brand-primary" />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* filter + toolbar row */}
        <div className="flex flex-wrap items-center gap-2 border-b border-brand-line bg-[#FBFDFC] px-4 py-2.5">
          <div className="flex h-9 min-w-[200px] items-center gap-2 rounded-pill border border-transparent bg-white px-3 ring-1 ring-brand-line focus-within:border-brand-primary focus-within:ring-brand-primary/30">
            <Search className="h-4 w-4 text-brand-mute" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or phone…"
              className="w-full bg-transparent text-[13px] text-brand-ink outline-none placeholder:text-brand-mute"
            />
          </div>

          <FilterMenu
            icon={HomeIcon}
            value={
              listings.find((l) => l.id === listingId)?.name ?? "All listings"
            }
            active={!!listingId}
            options={[
              { key: "", label: "All listings" },
              ...listings.map((l) => ({ key: l.id, label: l.name })),
            ]}
            onSelect={(k) => navigate({ listing: k || null, page: null })}
          />
          <FilterMenu
            icon={GitBranch}
            value={CHANNELS.find((c) => c.key === channel)?.label ?? "Channel"}
            active={!!channel}
            options={CHANNELS}
            onSelect={(k) => navigate({ channel: k || null, page: null })}
          />
          <FilterMenu
            icon={Star}
            value={RATINGS.find((r) => r.key === rating)?.label ?? "Any rating"}
            active={!!rating}
            options={RATINGS}
            onSelect={(k) => navigate({ rating: k || null, page: null })}
          />

          <div className="ml-auto flex items-center gap-2">
            <div className="inline-flex items-center rounded-[9px] border border-brand-line bg-white p-0.5">
              <button
                onClick={() => setDensity("comfortable")}
                title="Comfortable"
                className={`flex h-7 items-center rounded-[7px] px-2.5 ${
                  density === "comfortable"
                    ? "bg-brand-secondary text-white"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                <Rows3 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setDensity("compact")}
                title="Compact"
                className={`flex h-7 items-center rounded-[7px] px-2.5 ${
                  density === "compact"
                    ? "bg-brand-secondary text-white"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                <Menu className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="relative">
              <button
                onClick={() => setSortOpen((v) => !v)}
                onBlur={() => setTimeout(() => setSortOpen(false), 150)}
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-brand-line bg-white px-3 text-[12.5px] font-medium text-brand-ink hover:bg-brand-light"
              >
                <ArrowUpDown className="h-3.5 w-3.5 text-brand-mute" />
                {SORTS.find((s) => s.key === sort)?.label ?? "Sort"}
              </button>
              {sortOpen ? (
                <div className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[212px] rounded-xl border border-brand-line bg-white p-1.5 shadow-lift">
                  {SORTS.map((s) => {
                    const Icon = s.icon;
                    const on = sort === s.key;
                    return (
                      <button
                        key={s.key}
                        onMouseDown={() => navigate({ sort: s.key })}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] ${
                          on
                            ? "font-bold text-brand-secondary"
                            : "font-medium text-brand-ink hover:bg-brand-light"
                        }`}
                      >
                        <Icon className="h-4 w-4 text-brand-mute" />
                        {s.label}
                        {on ? (
                          <Check className="ml-auto h-4 w-4 text-brand-primary" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* column header / bulk bar */}
        <div className="relative border-b border-brand-line">
          {selected.size > 0 ? (
            <div className="flex items-center gap-2.5 bg-emerald-50 px-4 py-2.5">
              <input
                type="checkbox"
                checked={allOnPage}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
              />
              <span className="text-[13px] font-semibold text-brand-secondary">
                {selected.size} selected
              </span>
              <span className="mx-1 h-4 w-px bg-brand-primary/30" />
              <button
                onClick={() => setTagOpen(true)}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-light disabled:opacity-50"
              >
                <TagIcon className="h-3.5 w-3.5 text-brand-primary" /> Tag
              </button>
              <button
                onClick={() => void runExport([...selected])}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-light disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 text-brand-primary" /> Export
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="ml-auto text-[12.5px] font-medium text-brand-mute hover:text-brand-ink"
              >
                Clear
              </button>
            </div>
          ) : (
            <div
              className={`grid ${GRID} items-center gap-3 px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8AA89C]`}
            >
              <div>
                <input
                  type="checkbox"
                  checked={allOnPage}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
                />
              </div>
              <div>Guest</div>
              <div>Segment</div>
              <div className="text-center">Stays</div>
              <div>Lifetime</div>
              <div className="text-center">Rating</div>
              <div>Last / next stay</div>
              <div />
            </div>
          )}
        </div>

        {/* rows */}
        {guests.length === 0 ? (
          <EmptyState seg={seg} q={q} />
        ) : (
          <div>
            {guests.map((g) => (
              <GuestRowItem
                key={g.gkey}
                g={g}
                density={density}
                selected={selected.has(g.gkey)}
                onToggle={() => toggle(g.gkey)}
                acceptedQuote={acceptedQuotes[g.gkey] ?? null}
              />
            ))}
          </div>
        )}

        {/* footer / pagination */}
        {guests.length > 0 ? (
          <div className="flex items-center justify-between border-t border-brand-line bg-[#FBFDFC] px-4 py-3">
            <div className="text-[12px] tabular-nums text-brand-mute">
              Showing {showingFrom}–{showingTo} of {totalCount} guests
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => navigate({ page: String(page - 1) })}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-mute hover:bg-brand-light disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-[12px] font-semibold tabular-nums text-brand-ink">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => navigate({ page: String(page + 1) })}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-mute hover:bg-brand-light disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <AddGuestModal open={addOpen} onOpenChange={setAddOpen} />
      <BroadcastModal
        open={mailOpen}
        onOpenChange={setMailOpen}
        defaultAudience={seg === "all" ? "all" : seg}
      />
      <TagModal
        open={tagOpen}
        onOpenChange={setTagOpen}
        count={selected.size}
        onSubmit={runBulkTag}
      />
    </div>
  );
}

// ── Filter pill with dropdown ───────────────────────────────────────────
function FilterMenu({
  icon: Icon,
  value,
  active,
  options,
  onSelect,
}: {
  icon: typeof HomeIcon;
  value: string;
  active: boolean;
  options: { key: string; label: string }[];
  onSelect: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[12.5px] font-medium transition ${
          active
            ? "border-brand-primary bg-brand-light text-brand-secondary"
            : "border-brand-line bg-white text-brand-ink hover:bg-brand-light"
        }`}
      >
        <Icon className="h-3.5 w-3.5 text-brand-mute" />
        <span className="max-w-[140px] truncate">{value}</span>
        <ChevronDown className="h-3.5 w-3.5 text-brand-mute" />
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-72 min-w-[200px] overflow-y-auto rounded-xl border border-brand-line bg-white p-1.5 shadow-lift">
          {options.map((o) => (
            <button
              key={o.key || "all"}
              onMouseDown={() => {
                onSelect(o.key);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-brand-ink hover:bg-brand-light"
            >
              <span className="truncate">{o.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Tag modal (bulk) ────────────────────────────────────────────────────
function TagModal({
  open,
  onOpenChange,
  count,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onSubmit: (label: string) => void;
}) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (open) setLabel("");
  }, [open]);

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title="Tag guests"
      description={`Add a tag to ${count} selected guest${count === 1 ? "" : "s"}.`}
    >
      <form
        id="tag-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (label.trim()) onSubmit(label.trim());
        }}
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. VIP"
          autoFocus
          maxLength={40}
          className="h-10 w-full rounded-lg border border-brand-line bg-white px-3 text-sm text-brand-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        />
      </form>
      <FormModalFooter>
        <FormModalCancel>Cancel</FormModalCancel>
        <button
          type="submit"
          form="tag-form"
          disabled={!label.trim()}
          className="rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-secondary disabled:opacity-50"
        >
          Add tag
        </button>
      </FormModalFooter>
    </FormModal>
  );
}

// ── KPI card ────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  chip,
}: {
  label: string;
  value: string;
  sub: string;
  chip?: { text: string; tone: "good" | "star" };
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
          {label}
        </span>
        {chip ? (
          <span
            className={`inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[10.5px] font-semibold ${
              chip.tone === "star"
                ? "bg-amber-50 text-amber-600"
                : "bg-brand-light text-brand-primary"
            }`}
          >
            {chip.tone === "star" ? (
              <Star className="h-3 w-3 fill-current" />
            ) : (
              <TrendingUp className="h-3 w-3" />
            )}
            {chip.text}
          </span>
        ) : null}
      </div>
      <div className="mt-2 font-display text-[24px] font-bold leading-none text-brand-ink">
        {value}
      </div>
      <div className="mt-1.5 text-[11px] text-brand-mute">{sub}</div>
    </div>
  );
}

// ── Row ─────────────────────────────────────────────────────────────────
function GuestRowItem({
  g,
  density,
  selected,
  onToggle,
  acceptedQuote,
}: {
  acceptedQuote: AcceptedQuoteLite | null;
  g: GuestRow;
  density: "comfortable" | "compact";
  selected: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const seg = segMeta(g);
  const compact = density === "compact";
  const cancelled = !!g.last_status && CANCELLED.has(g.last_status);

  const copy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    void navigator.clipboard?.writeText(text);
  };

  return (
    <div
      onClick={() => router.push(`/dashboard/guests/${g.gkey}`)}
      className={`group relative grid ${GRID} cursor-pointer items-center gap-3 border-b border-[#F1F6F2] px-4 transition-colors hover:bg-[#F8FCF9] ${
        compact ? "py-2" : "py-3"
      } ${g.is_blocked ? "bg-red-50/30" : ""} ${selected ? "bg-brand-light/50" : ""}`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-[3px] transition-opacity ${
          g.is_blocked
            ? "bg-status-cancelled opacity-100"
            : `${seg.bar} opacity-0 group-hover:opacity-100`
        }`}
      />

      {/* select */}
      <div>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
        />
      </div>

      {/* guest identity */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          {g.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={g.avatar_url}
              alt=""
              className={`rounded-pill object-cover ring-2 ring-white ${compact ? "h-8 w-8" : "h-10 w-10"}`}
            />
          ) : (
            <div
              className={`flex items-center justify-center rounded-pill font-display font-bold ${avatarClass(g.gkey)} ${compact ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-[13px]"}`}
            >
              {initials(g.name)}
            </div>
          )}
          {g.is_inhouse ? (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-status-inhouse" />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold text-brand-ink">
              {g.name ?? "Guest"}
            </span>
            {acceptedQuote ? (
              <span onClick={(e) => e.stopPropagation()}>
                <AcceptedQuotePill
                  quoteId={acceptedQuote.id}
                  guestFirstName={(g.name ?? "Guest").split(/\s+/)[0]}
                  amount={acceptedQuote.amount}
                  currency={acceptedQuote.currency}
                  size="xs"
                />
              </span>
            ) : null}
            {g.is_verified ? (
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-status-confirmed" />
            ) : null}
            {g.is_blocked ? (
              <span className="rounded-pill bg-red-100 px-1.5 py-px text-[10px] font-bold text-red-600">
                Blocked
              </span>
            ) : null}
          </div>
          {!compact ? (
            <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-brand-mute">
              {g.is_ota && g.channel ? (
                <>
                  <span className="capitalize">{g.channel}</span>
                  <span className="text-brand-line">·</span>
                </>
              ) : null}
              <span className="truncate">{g.email ?? "No email"}</span>
              {!g.has_email ? (
                <span className="rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-600">
                  no email
                </span>
              ) : null}
              {!g.has_phone ? (
                <span className="rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-600">
                  no phone
                </span>
              ) : null}
              {g.is_all_direct && g.total_stays > 0 ? (
                <span className="rounded bg-brand-light px-1 text-[10px] font-semibold text-brand-primary">
                  All direct
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* segment */}
      <div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-pill border px-2 py-0.5 text-[11.5px] font-semibold ${seg.cls}`}
        >
          {seg.label}
        </span>
      </div>

      {/* stays */}
      <div className="text-center">
        <div className="text-[14px] font-bold tabular-nums text-brand-ink">
          {g.total_stays}
        </div>
        {!compact ? (
          <div className="text-[10.5px] text-brand-mute">
            {g.total_nights} nts
          </div>
        ) : null}
      </div>

      {/* lifetime */}
      <div>
        <div className="font-display text-[14px] font-bold tabular-nums text-brand-ink">
          {formatMoney(g.lifetime_value, g.currency)}
        </div>
        {!compact ? (
          <div className="mt-0.5 text-[10.5px] text-brand-mute">lifetime</div>
        ) : null}
      </div>

      {/* rating */}
      <div className="text-center">
        {g.avg_rating ? (
          <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold tabular-nums text-brand-ink">
            {g.avg_rating}
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          </span>
        ) : (
          <span className="text-[11.5px] text-brand-mute">—</span>
        )}
      </div>

      {/* last / next stay */}
      <div className="min-w-0">
        <StayCell g={g} cancelled={cancelled} compact={compact} />
      </div>

      {/* quick actions */}
      <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {g.email ? (
          <button
            title="Copy email"
            onClick={(e) => copy(e, g.email!)}
            className="flex h-8 w-8 items-center justify-center rounded-pill text-brand-mute hover:bg-brand-light hover:text-brand-ink"
          >
            <Copy className="h-[15px] w-[15px]" />
          </button>
        ) : null}
        <Link
          href="/dashboard/inbox"
          title="Message"
          onClick={(e) => e.stopPropagation()}
          className="flex h-8 w-8 items-center justify-center rounded-pill text-brand-mute hover:bg-brand-light hover:text-brand-ink"
        >
          <Mail className="h-[15px] w-[15px]" />
        </Link>
        <Link
          href={`/dashboard/guests/${g.gkey}`}
          title="Open profile"
          onClick={(e) => e.stopPropagation()}
          className="flex h-8 w-8 items-center justify-center rounded-pill text-brand-mute hover:bg-brand-light hover:text-brand-ink"
        >
          <ArrowRight className="h-[15px] w-[15px]" />
        </Link>
      </div>
    </div>
  );
}

function StayCell({
  g,
  cancelled,
  compact,
}: {
  g: GuestRow;
  cancelled: boolean;
  compact: boolean;
}) {
  if (g.is_inhouse) {
    return (
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-pill border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11.5px] font-semibold text-sky-600">
          <span className="h-1.5 w-1.5 rounded-full bg-status-inhouse" />{" "}
          In-house
        </span>
        {!compact && g.next_listing ? (
          <div className="mt-0.5 truncate text-[11px] text-brand-mute">
            {g.next_listing}
          </div>
        ) : null}
      </div>
    );
  }
  if (g.next_stay) {
    return (
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-pill border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11.5px] font-semibold text-amber-700">
          <span className="h-1.5 w-1.5 rounded-full bg-status-pending" />
          {fmtDate(g.next_stay)}
        </span>
        {!compact ? (
          <div className="mt-0.5 truncate text-[11px] text-brand-mute">
            upcoming{g.next_listing ? ` · ${g.next_listing}` : ""}
          </div>
        ) : null}
      </div>
    );
  }
  if (cancelled && !g.last_stay) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill border border-red-200 bg-red-50 px-2 py-0.5 text-[11.5px] font-semibold text-red-600">
        <span className="h-1.5 w-1.5 rounded-full bg-status-cancelled" />{" "}
        Cancelled
      </span>
    );
  }
  if (g.last_stay) {
    return (
      <div>
        <div className="text-[12.5px] font-semibold tabular-nums text-brand-ink">
          {fmtDate(g.last_stay)}
        </div>
        {!compact ? (
          <div className="mt-0.5 text-[11px] text-brand-mute">last stay</div>
        ) : null}
      </div>
    );
  }
  return <span className="text-[11.5px] text-brand-mute">No stays yet</span>;
}

// ── Empty states (enhancement #11: distinct "no guests" vs "no matches") ──
function EmptyState({ seg, q }: { seg: string; q: string }) {
  const filtered = seg !== "all" || q.length > 0;
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand-mute">
        <Users className="h-6 w-6" />
      </div>
      <div className="mt-3 text-[15px] font-semibold text-brand-ink">
        {filtered ? "No guests match" : "No guests yet"}
      </div>
      <div className="mt-1 max-w-sm text-[13px] text-brand-mute">
        {filtered
          ? "Try a different segment or clear your search."
          : "Guests appear here automatically as bookings and enquiries come in."}
      </div>
    </div>
  );
}
