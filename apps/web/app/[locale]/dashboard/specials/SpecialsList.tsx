"use client";

import {
  BarChart3,
  Globe,
  LayoutGrid,
  Link2,
  MoreHorizontal,
  Pause,
  Pencil,
  Percent,
  Play,
  Search,
  Sparkles,
  Star,
  Store,
  Table as TableIcon,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Link, useRouter } from "@/i18n/navigation";
import { Modal } from "@/components/ui/modal";
import { formatMoney } from "@/lib/format";

import { deleteSpecialAction, setSpecialStatusAction } from "./actions";

type SpecialsT = ReturnType<typeof useTranslations>;

export type SpecialStatus =
  | "draft"
  | "active"
  | "paused"
  | "expired"
  | "archived";

export type SpecialBucket =
  | "live"
  | "scheduled"
  | "draft"
  | "paused"
  | "expired"
  | "archived";

export type SpecialRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: SpecialStatus;
  bucket: SpecialBucket;
  quantity: number;
  redemptionsUsed: number;
  isFeatured: boolean;
  priceMode: "flat" | "per_night";
  flatTotal: number | null;
  perNightPrice: number | null;
  currency: string;
  savingsPct: number | null;
  dateMode: "fixed" | "flexible";
  fixedCheckIn: string | null;
  fixedCheckOut: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  bookBy: string | null;
  heroUrl: string | null;
  showInDirectory: boolean;
  showOnWebsite: boolean;
  propertyName: string;
};

// Pill class per derived bucket (mirrors the design's .tag colour set).
const BUCKET_CLS: Record<SpecialBucket, string> = {
  live: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  scheduled: "bg-indigo-50 text-indigo-600 border border-indigo-200",
  draft: "bg-brand-light text-brand-mute border border-brand-line",
  paused: "bg-amber-50 text-amber-700 border border-amber-200",
  expired: "bg-red-50 text-red-700 border border-red-200",
  archived: "bg-brand-light text-brand-mute border border-brand-line",
};
const BUCKET_DOT: Record<SpecialBucket, string> = {
  live: "bg-emerald-500",
  scheduled: "bg-indigo-500",
  draft: "bg-brand-mute",
  paused: "bg-amber-500",
  expired: "bg-red-500",
  archived: "bg-brand-mute",
};
const BUCKET_ORDER: Record<SpecialBucket, number> = {
  live: 0,
  scheduled: 1,
  draft: 2,
  paused: 3,
  expired: 4,
  archived: 5,
};

const CHIP_BUCKETS: SpecialBucket[] = [
  "live",
  "scheduled",
  "draft",
  "paused",
  "expired",
  "archived",
];

function bucketLabel(b: SpecialBucket, t: SpecialsT): string {
  switch (b) {
    case "live":
      return t("chipLive");
    case "scheduled":
      return t("chipScheduled");
    case "draft":
      return t("status_draft");
    case "paused":
      return t("status_paused");
    case "expired":
      return t("status_expired");
    case "archived":
      return t("status_archived");
  }
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function SpecialsList({ specials }: { specials: SpecialRow[] }) {
  const t = useTranslations("specials");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | SpecialBucket>("all");
  const [sort, setSort] = useState<"name" | "deal" | "status">("name");
  const [view, setView] = useState<"grid" | "table">("grid");

  // Counts per bucket (drive the filter chips).
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: specials.length };
    for (const s of specials) c[s.bucket] = (c[s.bucket] ?? 0) + 1;
    return c;
  }, [specials]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = specials.filter(
      (s) =>
        (filter === "all" || s.bucket === filter) &&
        (!q ||
          `${s.title} ${s.propertyName} ${s.description ?? ""}`
            .toLowerCase()
            .includes(q)),
    );
    out = [...out].sort((a, b) => {
      if (sort === "deal")
        return (
          (b.savingsPct ?? 0) - (a.savingsPct ?? 0) ||
          a.title.localeCompare(b.title)
        );
      if (sort === "status")
        return (
          BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] ||
          a.title.localeCompare(b.title)
        );
      return a.title.localeCompare(b.title);
    });
    return out;
  }, [specials, query, filter, sort]);

  // First-run empty (no specials at all) → the onboarding card.
  if (specials.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-brand-line bg-white p-12 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="font-display text-lg font-bold text-brand-ink">
          {t("emptyTitle")}
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
          {t("emptyBody")}
        </p>
        <Link
          href="/dashboard/specials/new"
          className="mt-5 inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
        >
          {t("emptyCta")}
        </Link>
      </div>
    );
  }

  const showGhost = filter === "all" && !query && view === "grid";

  return (
    <div className="space-y-4">
      {/* search */}
      <div className="flex items-center gap-2.5 rounded-pill border border-brand-line bg-white px-4 py-2.5 shadow-card focus-within:border-brand-primary">
        <Search className="h-4 w-4 shrink-0 text-brand-mute" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("mgrSearchPlaceholder")}
          className="flex-1 bg-transparent text-sm text-brand-ink outline-none placeholder:text-brand-mute"
        />
      </div>

      {/* filter chips + sort + view */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2 overflow-x-auto">
          <Chip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label={t("chipAll")}
            count={counts.all}
          />
          {CHIP_BUCKETS.filter((b) => (counts[b] ?? 0) > 0).map((b) => (
            <Chip
              key={b}
              active={filter === b}
              onClick={() => setFilter(b)}
              label={bucketLabel(b, t)}
              count={counts[b] ?? 0}
              dot={BUCKET_DOT[b]}
            />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[12px] text-brand-mute sm:inline">
            {t("mgrSort")}
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-9 rounded-pill border border-brand-line bg-white pl-3.5 pr-8 text-[12.5px] font-medium text-brand-ink outline-none hover:bg-brand-light"
          >
            <option value="name">{t("sortName")}</option>
            <option value="deal">{t("sortDeal")}</option>
            <option value="status">{t("sortStatus")}</option>
          </select>
          <div className="flex items-center rounded-pill border border-brand-line bg-white p-0.5">
            <ViewBtn
              active={view === "grid"}
              onClick={() => setView("grid")}
              label={t("viewCards")}
              icon={LayoutGrid}
            />
            <ViewBtn
              active={view === "table"}
              onClick={() => setView("table")}
              label={t("viewTable")}
              icon={TableIcon}
            />
          </div>
        </div>
      </div>

      {/* results */}
      {list.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand-mute">
            <Search className="h-6 w-6" />
          </div>
          <div className="mt-3 font-display text-[15px] font-bold text-brand-ink">
            {t("emptyMatchTitle")}
          </div>
          <p className="mt-1 text-[12.5px] text-brand-mute">
            {t("emptyMatchBody")}
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-3.5 lg:grid-cols-2">
          {list.map((s) => (
            <SpecialCard key={s.id} special={s} t={t} />
          ))}
          {showGhost ? <GhostCard t={t} /> : null}
        </div>
      ) : (
        <SpecialsTable list={list} t={t} />
      )}
    </div>
  );
}

/* ---------- grid card ---------- */

function SpecialCard({ special: s, t }: { special: SpecialRow; t: SpecialsT }) {
  return (
    <article
      className={`flex flex-col overflow-hidden rounded-card border border-brand-line bg-white shadow-card transition hover:-translate-y-0.5 hover:border-brand-primary/40 hover:shadow-lift ${
        s.bucket === "draft" || s.bucket === "archived" ? "opacity-90" : ""
      }`}
    >
      <div className="flex gap-3.5 p-3.5">
        <Thumb s={s} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="flex items-center gap-1.5 font-display text-[15px] font-bold leading-snug text-brand-ink">
              {s.isFeatured ? (
                <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
              ) : null}
              <span className="truncate">{s.title}</span>
            </h3>
            <StatusTag bucket={s.bucket} t={t} />
          </div>
          <span className="mt-1 inline-flex items-center gap-1 rounded-pill bg-brand-light px-2.5 py-0.5 text-[10.5px] font-semibold text-brand-secondary">
            {s.priceMode === "flat" ? t("pillPackage") : t("pillPerNight")}
          </span>
          {s.description ? (
            <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-brand-mute">
              {s.description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-brand-line px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-3 text-[11px] text-brand-mute">
          <span className="inline-flex items-center gap-1 truncate">
            <Store className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{s.propertyName}</span>
          </span>
          <span className="hidden shrink-0 items-center gap-1 whitespace-nowrap sm:inline-flex">
            {priceLabel(s, t)}
          </span>
        </div>
        <CardActions s={s} t={t} />
      </div>
    </article>
  );
}

function Thumb({ s }: { s: SpecialRow }) {
  return (
    <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[12px] bg-brand-accent">
      {s.heroUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={s.heroUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-brand-primary">
          <Sparkles className="h-7 w-7" />
        </div>
      )}
      {s.savingsPct ? (
        <span className="absolute left-0 top-2.5 inline-flex items-center gap-1 rounded-r-pill bg-brand-primary px-2 py-0.5 font-display text-[12px] font-extrabold text-white shadow">
          <Percent className="h-3 w-3" />
          {s.savingsPct}
        </span>
      ) : null}
    </div>
  );
}

function priceLabel(s: SpecialRow, t: SpecialsT): string {
  return s.priceMode === "flat"
    ? t("priceTotal", { amount: formatMoney(s.flatTotal, s.currency) })
    : t("pricePerNight", { amount: formatMoney(s.perNightPrice, s.currency) });
}

function datesLabel(s: SpecialRow, t: SpecialsT): string {
  return s.dateMode === "fixed"
    ? `${fmtDate(s.fixedCheckIn)} → ${fmtDate(s.fixedCheckOut)}`
    : t("datesWindow", {
        start: fmtDate(s.windowStart),
        end: fmtDate(s.windowEnd),
      });
}

function StatusTag({ bucket, t }: { bucket: SpecialBucket; t: SpecialsT }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-[11px] font-semibold ${BUCKET_CLS[bucket]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${BUCKET_DOT[bucket]}`} />
      {bucketLabel(bucket, t)}
    </span>
  );
}

/* ---------- shared card/row actions: toggle + edit + menu ---------- */

function CardActions({ s, t }: { s: SpecialRow; t: SpecialsT }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const isLive = s.bucket === "live" || s.bucket === "scheduled";

  function run(
    label: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
  ) {
    setMenuOpen(false);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(label);
        router.refresh();
      } else {
        toast.error(res.error ?? t("genericError"));
      }
    });
  }

  function toggleLive() {
    if (pending) return;
    const next = isLive ? "paused" : "active";
    run(next === "active" ? t("toastActivated") : t("toastPaused"), () =>
      setSpecialStatusAction(s.id, next),
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={isLive}
        aria-label={t("toggleLiveAria")}
        onClick={toggleLive}
        disabled={pending}
        className={`relative h-[21px] w-[37px] shrink-0 rounded-pill transition-colors disabled:opacity-60 ${
          isLive ? "bg-brand-primary" : "bg-brand-line"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-[17px] w-[17px] rounded-full bg-white shadow transition-transform ${
            isLive ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
      <Link
        href={`/dashboard/specials/${s.id}/edit`}
        title={t("edit")}
        className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-brand-line bg-white text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Link>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          disabled={pending}
          aria-label={t("actionsAria")}
          className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-brand-line bg-white text-brand-mute transition hover:bg-brand-light hover:text-brand-ink disabled:opacity-50"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen ? (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-card border border-brand-line bg-white py-1 shadow-lift">
              <MenuLink
                href={`/dashboard/specials/${s.id}`}
                icon={BarChart3}
                label={t("menuReport")}
              />
              <MenuLink
                href={`/dashboard/specials/${s.id}/edit`}
                icon={Pencil}
                label={t("menuEdit")}
              />
              {isLive ? (
                <MenuButton
                  icon={Pause}
                  label={t("menuPause")}
                  onClick={() =>
                    run(t("toastPaused"), () =>
                      setSpecialStatusAction(s.id, "paused"),
                    )
                  }
                />
              ) : (
                <MenuButton
                  icon={Play}
                  label={t("menuActivate")}
                  onClick={() =>
                    run(t("toastActivated"), () =>
                      setSpecialStatusAction(s.id, "active"),
                    )
                  }
                />
              )}
              {s.bucket !== "archived" ? (
                <MenuButton
                  icon={LayoutGrid}
                  label={t("menuArchive")}
                  onClick={() =>
                    run(t("toastArchived"), () =>
                      setSpecialStatusAction(s.id, "archived"),
                    )
                  }
                />
              ) : null}
              <MenuButton
                icon={Trash2}
                label={t("menuDelete")}
                danger
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmDelete(true);
                }}
              />
            </div>
          </>
        ) : null}
      </div>

      <Modal
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        intent="destructive"
        title={t("deleteTitle")}
        description={t("deleteBody", { title: s.title })}
        actions={[
          {
            label: t("delete"),
            kind: "danger",
            onClick: () =>
              run(t("toastDeleted"), () => deleteSpecialAction(s.id)),
          },
          { label: t("cancel"), kind: "ghost" },
        ]}
      />
    </div>
  );
}

/* ---------- table view ---------- */

function SpecialsTable({ list, t }: { list: SpecialRow[]; t: SpecialsT }) {
  return (
    <div className="overflow-x-auto rounded-card border border-brand-line bg-white shadow-card">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-brand-mute">
            <th className="px-4 pb-2.5 pt-3">{t("colSpecial")}</th>
            <th className="px-3 pb-2.5 pt-3">{t("colDeal")}</th>
            <th className="px-3 pb-2.5 pt-3">{t("colAppliesTo")}</th>
            <th className="px-3 pb-2.5 pt-3">{t("colDates")}</th>
            <th className="px-3 pb-2.5 pt-3">{t("colStatus")}</th>
            <th className="px-4 pb-2.5 pt-3 text-right">{t("colActive")}</th>
          </tr>
        </thead>
        <tbody>
          {list.map((s) => (
            <tr
              key={s.id}
              className="border-t border-brand-line transition hover:bg-brand-light/40"
            >
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-[10px] bg-brand-accent">
                    {s.heroUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.heroUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-brand-primary">
                        <Sparkles className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-display text-[13.5px] font-bold text-brand-ink">
                      {s.title}
                    </div>
                    <div className="text-[11px] text-brand-mute">
                      {s.priceMode === "flat"
                        ? t("pillPackage")
                        : t("pillPerNight")}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-accent px-2.5 py-1 font-display text-[12.5px] font-extrabold text-brand-secondary">
                  {s.savingsPct ? (
                    <>
                      <Percent className="h-3 w-3" />
                      {t("offPct", { pct: s.savingsPct })}
                    </>
                  ) : (
                    priceLabel(s, t)
                  )}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] text-brand-ink">
                {s.propertyName}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px] text-brand-mute">
                {datesLabel(s, t)}
              </td>
              <td className="px-3 py-2.5">
                <StatusTag bucket={s.bucket} t={t} />
              </td>
              <td className="px-4 py-2.5">
                <div className="flex justify-end">
                  <CardActions s={s} t={t} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- ghost card ---------- */

function GhostCard({ t }: { t: SpecialsT }) {
  return (
    <Link
      href="/dashboard/specials/new"
      className="flex items-center gap-3.5 rounded-card border border-dashed border-brand-line bg-[#FAFCFB] p-3.5 text-brand-mute transition hover:border-brand-primary/40 hover:text-brand-secondary"
    >
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[12px] bg-brand-accent text-brand-secondary">
        <Sparkles className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <div className="font-display text-[14px] font-semibold text-brand-ink">
          {t("ghostTitle")}
        </div>
        <div className="text-[11.5px]">{t("ghostBody")}</div>
      </div>
    </Link>
  );
}

/* ---------- visibility chips (unused in compact card but kept for reuse) ---------- */

export function VisibilityChips({
  special: s,
  t,
}: {
  special: SpecialRow;
  t: SpecialsT;
}) {
  const linkOnly = !s.showInDirectory && !s.showOnWebsite;
  if (linkOnly) {
    return (
      <span className="inline-flex items-center gap-1 text-brand-mute">
        <Link2 className="h-3.5 w-3.5" /> {t("chipLinkOnly")}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-brand-ink">
      {s.showInDirectory ? (
        <span className="inline-flex items-center gap-1">
          <Store className="h-3.5 w-3.5" /> {t("chipDirectory")}
        </span>
      ) : null}
      {s.showOnWebsite ? (
        <span className="inline-flex items-center gap-1">
          <Globe className="h-3.5 w-3.5" /> {t("chipWebsite")}
        </span>
      ) : null}
    </span>
  );
}

/* ---------- small building blocks ---------- */

function Chip({
  active,
  onClick,
  label,
  count,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold transition ${
        active
          ? "border-transparent bg-brand-accent text-brand-secondary"
          : "border-brand-line bg-white text-brand-mute hover:bg-brand-light hover:text-brand-ink"
      }`}
    >
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> : null}
      {label}
      <span
        className={`rounded-pill px-1.5 text-[11px] tabular-nums ${
          active ? "bg-white" : "bg-brand-light"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function ViewBtn({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: typeof LayoutGrid;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-8 w-8 items-center justify-center rounded-pill transition ${
        active
          ? "bg-brand-primary text-white"
          : "text-brand-mute hover:text-brand-ink"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Pencil;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 text-[13px] text-brand-ink transition-colors hover:bg-brand-light"
    >
      <Icon className="h-3.5 w-3.5 text-brand-mute" />
      {label}
    </Link>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-brand-light ${
        danger ? "text-red-600" : "text-brand-ink"
      }`}
    >
      <Icon
        className={`h-3.5 w-3.5 ${danger ? "text-red-500" : "text-brand-mute"}`}
      />
      {label}
    </button>
  );
}
